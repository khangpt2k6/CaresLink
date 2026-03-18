import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();

async function main() {
  // 1. Find an open job
  const jobs = await prisma.job.findMany({ where: { status: "open" }, take: 3 });
  if (jobs.length === 0) {
    console.log("No open jobs found. Create one first.");
    return;
  }

  console.log(`\nFound ${jobs.length} open job(s):`);
  jobs.forEach((j) => console.log(`  - ${j.title} (${j.id})`));

  const job = jobs[0];
  console.log(`\nTesting matching for: "${job.title}"\n`);

  // 2. Check if we have candidates
  const candidateCount = await prisma.candidate.findMany();
  console.log(`Total candidates: ${candidateCount.length}`);

  // 3. Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("\n⚠ ANTHROPIC_API_KEY not set — skipping AI call, testing DB layer only.\n");

    // Insert mock matches to test the DB layer
    const mockMatches = candidateCount.slice(0, 5).map((c, i) => ({
      candidateId: c.id,
      score: 90 - i * 15,
      label: i === 0 ? "Excellent fit" : i < 3 ? "Good fit" : "Partial fit",
      reason: `Mock match for testing: ${c.name} vs ${job.title}`,
    }));

    console.log("Inserting mock matches into JobMatch table...");
    for (const m of mockMatches) {
      await prisma.jobMatch.upsert({
        where: { jobId_candidateId: { jobId: job.id, candidateId: m.candidateId } },
        create: { jobId: job.id, ...m },
        update: { score: m.score, label: m.label, reason: m.reason, computedAt: new Date() },
      });
    }

    const stored = await prisma.jobMatch.findMany({
      where: { jobId: job.id },
      include: { candidate: true },
      orderBy: { score: "desc" },
    });

    console.log(`\n✓ Stored ${stored.length} matches in DB:\n`);
    stored.forEach((m) => {
      console.log(`  ${m.score.toString().padStart(3)} | ${m.label.padEnd(14)} | ${m.candidate.name}`);
    });
    return;
  }

  // 4. Full AI matching
  console.log("Running AI matching (this calls Claude)...\n");

  const anthropic = new Anthropic({ apiKey });

  // Build candidate data
  const candidates = await prisma.candidate.findMany({ orderBy: { appliedAt: "desc" } });
  const candidateProfiles = await Promise.all(
    candidates.map(async (c) => {
      const user = await prisma.user.findFirst({
        where: { email: { equals: c.email, mode: "insensitive" } },
        include: {
          profile: {
            include: {
              experiences: { orderBy: { startDate: "desc" } },
              educations: { orderBy: { startDate: "desc" } },
              skills: true,
              certifications: true,
            },
          },
        },
      });

      const profile = user?.profile;
      return {
        id: c.id,
        name: c.name,
        position: c.position,
        profile: profile
          ? {
              headline: profile.headline,
              skills: profile.skills.map((s) => s.name),
              experiences: profile.experiences.map((e) => `${e.title} at ${e.company}`),
            }
          : null,
      };
    })
  );

  console.log(`Sending ${candidateProfiles.length} candidates to Claude for matching...\n`);

  const systemPrompt = `You are an expert healthcare recruiter AI. Score candidates 0-100 against the job.
Labels: "Excellent fit" (90-100), "Good fit" (75-89), "Partial fit" (50-74), "Weak fit" (25-49), "Not a fit" (0-24).
Respond with ONLY a JSON array: [{"candidateId":"id","score":85,"label":"Good fit","reason":"brief reason"}]`;

  const userMessage = `Job: ${job.title} (${job.department || "N/A"}) - ${job.description || "No description"}

Candidates:
${candidateProfiles.map((c) => `- ID: ${c.id}, Name: ${c.name}, Position: ${c.position}${c.profile ? `, Skills: ${c.profile.skills.join(", ")}, Experience: ${c.profile.experiences.join("; ")}` : ""}`).join("\n")}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const matches: { candidateId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

  console.log(`AI returned ${matches.length} matches. Storing in DB...\n`);

  // Upsert into DB
  const now = new Date();
  for (const m of matches) {
    await prisma.jobMatch.upsert({
      where: { jobId_candidateId: { jobId: job.id, candidateId: m.candidateId } },
      create: { jobId: job.id, candidateId: m.candidateId, score: m.score, label: m.label, reason: m.reason, computedAt: now },
      update: { score: m.score, label: m.label, reason: m.reason, computedAt: now },
    });
  }

  // Read back
  const stored = await prisma.jobMatch.findMany({
    where: { jobId: job.id },
    include: { candidate: true },
    orderBy: { score: "desc" },
  });

  console.log(`✓ Stored ${stored.length} matches for "${job.title}":\n`);
  stored.forEach((m) => {
    console.log(`  ${m.score.toString().padStart(3)} | ${m.label.padEnd(14)} | ${m.candidate.name}`);
    console.log(`       ${m.reason}\n`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
