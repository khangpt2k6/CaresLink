import { prisma } from "@/lib/db";
import { textCompletion } from "@/lib/ai-provider";

/**
 * Compute match scores for a job against all candidates,
 * then upsert results into the JobMatch table.
 *
 * Returns the stored matches sorted by score descending.
 */
export async function computeAndStoreMatches(jobId: string) {

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  // Fetch all candidates with their rich profile + interview data
  const candidates = await prisma.candidate.findMany({
    orderBy: { appliedAt: "desc" },
  });

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

      const interview = await prisma.interview.findFirst({
        where: { candidateId: c.id },
        include: { screening: true, summary: true },
        orderBy: { scheduledAt: "desc" },
      });

      const profile = user?.profile;
      const screening = interview?.screening;
      const interviewSummary = interview?.summary;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        position: c.position,
        status: c.status,
        profile: profile
          ? {
              headline: profile.headline,
              summary: profile.summary,
              city: profile.city,
              state: profile.state,
              experiences: profile.experiences.map((e) => ({
                title: e.title,
                company: e.company,
                description: e.description,
                startDate: e.startDate,
                endDate: e.endDate,
                current: e.current,
              })),
              educations: profile.educations.map((e) => ({
                school: e.school,
                degree: e.degree,
                field: e.field,
              })),
              skills: profile.skills.map((s) => s.name),
              certifications: profile.certifications.map((cert) => ({
                name: cert.name,
                issuer: cert.issuer,
              })),
            }
          : null,
        screening: screening?.answers
          ? {
              summary: screening.aiSummary,
              answers: screening.answers,
              flagged: screening.flagged,
            }
          : null,
        interviewSummary: interviewSummary
          ? {
              strengths: interviewSummary.strengths,
              concerns: interviewSummary.concerns,
              ratings: {
                technical: interviewSummary.technicalRating,
                communication: interviewSummary.communicationRating,
                cultureFit: interviewSummary.cultureFitRating,
                overall: interviewSummary.overallRating,
              },
              recommendation: interviewSummary.recommendation,
            }
          : null,
      };
    })
  );

  // Build AI prompt
  const systemPrompt = `You are an expert healthcare recruiter AI. Your job is to analyze candidates against a specific job posting and score how well each candidate matches.

For each candidate, evaluate:
1. **Position match** — Does their applied position align with the job?
2. **Experience relevance** — Do their work experiences match what the job needs?
3. **Skills & certifications** — Do they have the required skills/certs?
4. **Education** — Does their education background fit?
5. **Screening performance** — If screening data exists, how well did they perform?
6. **Interview performance** — If interview data exists, what were the results?
7. **Overall potential** — Even if not a perfect match, could they grow into the role?

Score each candidate from 0 to 100 where:
- 90-100: Excellent match — strongly recommended
- 75-89: Good match — solid candidate
- 50-74: Partial match — some relevant qualifications
- 25-49: Weak match — limited alignment
- 0-24: Poor match — not suitable

IMPORTANT: Be realistic. A candidate who applied for "Registered Nurse" matches well with a "Registered Nurse" posting but poorly with "Medical Billing Specialist". Consider ALL available data.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation:
[
  {
    "candidateId": "the_id",
    "score": 85,
    "label": "Good fit",
    "reason": "1-2 sentence explanation"
  }
]

Labels must be one of: "Excellent fit", "Good fit", "Partial fit", "Weak fit", "Not a fit"`;

  const userMessage = `## Job Posting
**Title:** ${job.title}
**Department:** ${job.department || "N/A"}
**Location:** ${job.location}
**Type:** ${job.type}
**Description:** ${job.description || "No description provided"}

## Candidates to Evaluate (${candidateProfiles.length} total)

${candidateProfiles
  .map(
    (c, i) => `### Candidate ${i + 1}: ${c.name}
- **ID:** ${c.id}
- **Applied Position:** ${c.position}
- **Status:** ${c.status}
${
  c.profile
    ? `- **Headline:** ${c.profile.headline || "N/A"}
- **Summary:** ${c.profile.summary || "N/A"}
- **Location:** ${[c.profile.city, c.profile.state].filter(Boolean).join(", ") || "N/A"}
- **Skills:** ${c.profile.skills.length > 0 ? c.profile.skills.join(", ") : "None listed"}
- **Certifications:** ${c.profile.certifications.length > 0 ? c.profile.certifications.map((cert) => cert.name).join(", ") : "None listed"}
- **Experience:** ${
        c.profile.experiences.length > 0
          ? c.profile.experiences
              .map((e) => `${e.title} at ${e.company}${e.description ? ` — ${e.description}` : ""}`)
              .join("; ")
          : "None listed"
      }
- **Education:** ${
        c.profile.educations.length > 0
          ? c.profile.educations
              .map((e) => `${e.degree || ""} ${e.field || ""} at ${e.school}`.trim())
              .join("; ")
          : "None listed"
      }`
    : "- **Profile:** No detailed profile available"
}
${c.screening ? `- **Screening Summary:** ${c.screening.summary || "Completed"}${c.screening.flagged ? " ⚠️ FLAGGED" : ""}` : ""}
${
  c.interviewSummary
    ? `- **Interview Results:** Overall rating: ${c.interviewSummary.ratings.overall}/5, Recommendation: ${c.interviewSummary.recommendation}
- **Strengths:** ${(c.interviewSummary.strengths as string[])?.join(", ") || "N/A"}
- **Concerns:** ${(c.interviewSummary.concerns as string[])?.join(", ") || "N/A"}`
    : ""
}`
  )
  .join("\n")}

Evaluate ALL ${candidateProfiles.length} candidates against the "${job.title}" position. Return the JSON array sorted by score descending.`;

  const text = await textCompletion({
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Parse AI response
  const cleaned = text
    .replace(/```json?\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  const matches: {
    candidateId: string;
    score: number;
    label: string;
    reason: string;
  }[] = JSON.parse(cleaned);

  // Upsert all matches into the database
  const now = new Date();
  await Promise.all(
    matches.map((m) =>
      prisma.jobMatch.upsert({
        where: {
          jobId_candidateId: { jobId: job.id, candidateId: m.candidateId },
        },
        create: {
          jobId: job.id,
          candidateId: m.candidateId,
          score: m.score,
          label: m.label,
          reason: m.reason,
          computedAt: now,
        },
        update: {
          score: m.score,
          label: m.label,
          reason: m.reason,
          computedAt: now,
        },
      })
    )
  );

  // Return the stored matches
  return prisma.jobMatch.findMany({
    where: { jobId: job.id },
    include: { candidate: true },
    orderBy: { score: "desc" },
  });
}

/**
 * RAG-enhanced matching: vector pre-filter → enrich top-K → Claude fine-score.
 * Falls back to legacy computeAndStoreMatches if no embeddings exist.
 */
export async function computeAndStoreMatchesRAG(jobId: string, topK: number = 20) {

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  // Step 1: Get or generate job embedding
  const { generateEmbedding, buildJobText } = await import("./embeddings");
  const { searchSimilarCandidates, getJobEmbeddingVector, upsertJobEmbedding } = await import("./vector-store");

  let jobEmbedding = await getJobEmbeddingVector(jobId);
  if (!jobEmbedding) {
    const text = buildJobText(job);
    jobEmbedding = await generateEmbedding(text);
    await upsertJobEmbedding(jobId, text, jobEmbedding);
  }

  // Step 2: Vector similarity pre-filter
  const similarCandidates = await searchSimilarCandidates(jobEmbedding, topK, 0.2);

  // Fallback: if no embeddings exist, use legacy approach
  if (similarCandidates.length === 0) {
    return computeAndStoreMatches(jobId);
  }

  // Step 3: Enrich only the pre-filtered candidates
  const candidateIds = similarCandidates.map((r) => r.candidateId);
  const candidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds } },
  });

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

      const interview = await prisma.interview.findFirst({
        where: { candidateId: c.id },
        include: { screening: true, summary: true },
        orderBy: { scheduledAt: "desc" },
      });

      const profile = user?.profile;
      const screening = interview?.screening;
      const interviewSummary = interview?.summary;
      const simResult = similarCandidates.find((s) => s.candidateId === c.id);

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        position: c.position,
        status: c.status,
        vectorSimilarity: simResult ? Number(simResult.similarity).toFixed(3) : "N/A",
        profile: profile
          ? {
              headline: profile.headline,
              summary: profile.summary,
              experiences: profile.experiences.map((e) => ({
                title: e.title,
                company: e.company,
                description: e.description,
              })),
              educations: profile.educations.map((e) => ({
                school: e.school,
                degree: e.degree,
                field: e.field,
              })),
              skills: profile.skills.map((s) => s.name),
              certifications: profile.certifications.map((cert) => ({
                name: cert.name,
                issuer: cert.issuer,
              })),
            }
          : null,
        screening: screening?.answers
          ? { summary: screening.aiSummary, flagged: screening.flagged }
          : null,
        interviewSummary: interviewSummary
          ? {
              strengths: interviewSummary.strengths,
              concerns: interviewSummary.concerns,
              ratings: {
                overall: interviewSummary.overallRating,
              },
              recommendation: interviewSummary.recommendation,
            }
          : null,
      };
    })
  );

  // Step 4: Claude fine-scoring (same prompt structure, smaller input)
  const systemPrompt = `You are an expert healthcare recruiter AI. Score each candidate against this job posting.

For each candidate, evaluate: position match, experience, skills, certifications, education, screening/interview performance.

Score 0-100: 90-100 excellent, 75-89 good, 50-74 partial, 25-49 weak, 0-24 poor.
Labels: "Excellent fit", "Good fit", "Partial fit", "Weak fit", "Not a fit"

These candidates were PRE-FILTERED by vector similarity. Their "vectorSimilarity" score shows semantic relevance to the job (0-1). Use this as a signal but make your own assessment.

Respond with ONLY a valid JSON array:
[{"candidateId": "id", "score": 85, "label": "Good fit", "reason": "1-2 sentence explanation"}]`;

  const userMessage = `## Job Posting
**Title:** ${job.title}
**Department:** ${job.department || "N/A"}
**Location:** ${job.location}
**Type:** ${job.type}
**Description:** ${job.description || "No description provided"}

## Pre-filtered Candidates (${candidateProfiles.length} via RAG)

${candidateProfiles
  .map(
    (c, i) => `### Candidate ${i + 1}: ${c.name}
- **ID:** ${c.id}
- **Vector Similarity:** ${c.vectorSimilarity}
- **Applied Position:** ${c.position}
${
  c.profile
    ? `- **Skills:** ${c.profile.skills.length > 0 ? c.profile.skills.join(", ") : "None"}
- **Certifications:** ${c.profile.certifications.length > 0 ? c.profile.certifications.map((cert) => cert.name).join(", ") : "None"}
- **Experience:** ${c.profile.experiences.length > 0 ? c.profile.experiences.map((e) => `${e.title} at ${e.company}`).join("; ") : "None"}`
    : "- **Profile:** No detailed profile"
}
${c.screening ? `- **Screening:** ${c.screening.summary || "Completed"}${c.screening.flagged ? " ⚠️" : ""}` : ""}
${c.interviewSummary ? `- **Interview:** Overall ${c.interviewSummary.ratings.overall}/5, ${c.interviewSummary.recommendation}` : ""}`
  )
  .join("\n")}`;

  const text = await textCompletion({
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const matches: { candidateId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

  // Step 5: Upsert results
  const now = new Date();
  await Promise.all(
    matches.map((m) =>
      prisma.jobMatch.upsert({
        where: { jobId_candidateId: { jobId: job.id, candidateId: m.candidateId } },
        create: { jobId: job.id, candidateId: m.candidateId, score: m.score, label: m.label, reason: m.reason, computedAt: now },
        update: { score: m.score, label: m.label, reason: m.reason, computedAt: now },
      })
    )
  );

  return prisma.jobMatch.findMany({
    where: { jobId: job.id },
    include: { candidate: true },
    orderBy: { score: "desc" },
  });
}
