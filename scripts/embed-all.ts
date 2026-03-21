/**
 * Batch embedding script — backfills embeddings for all existing candidates and jobs.
 *
 * Usage: npm run embed:all
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// We import these dynamically so the model only loads once
async function run() {
  const { generateEmbedding, buildCandidateText, buildJobText } = await import("../src/lib/embeddings");
  const { upsertCandidateEmbedding, upsertJobEmbedding } = await import("../src/lib/vector-store");

  console.log("Starting batch embedding...\n");

  // ─── Embed Candidates ──────────────────────────────────────
  const candidates = await prisma.candidate.findMany({
    orderBy: { appliedAt: "desc" },
  });

  console.log(`Found ${candidates.length} candidates to embed.`);
  let candidateCount = 0;

  for (const candidate of candidates) {
    try {
      // Try to find linked user profile
      const user = await prisma.user.findFirst({
        where: { email: { equals: candidate.email, mode: "insensitive" } },
        include: {
          profile: {
            include: {
              experiences: true,
              educations: true,
              skills: true,
              certifications: true,
              licenses: true,
              preferences: true,
            },
          },
        },
      });

      const profile = user?.profile;
      const text = buildCandidateText(candidate, profile ? {
        ...profile,
        preferences: profile.preferences ?? null,
      } : null);

      const embedding = await generateEmbedding(text);
      await upsertCandidateEmbedding(candidate.id, text, embedding);
      candidateCount++;
      process.stdout.write(`  Candidates: ${candidateCount}/${candidates.length}\r`);
    } catch (e) {
      console.error(`  Failed to embed candidate ${candidate.name}:`, e);
    }
  }
  console.log(`\n  Embedded ${candidateCount} candidates.`);

  // ─── Embed Jobs ────────────────────────────────────────────
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nFound ${jobs.length} jobs to embed.`);
  let jobCount = 0;

  for (const job of jobs) {
    try {
      const text = buildJobText(job);
      const embedding = await generateEmbedding(text);
      await upsertJobEmbedding(job.id, text, embedding);
      jobCount++;
      process.stdout.write(`  Jobs: ${jobCount}/${jobs.length}\r`);
    } catch (e) {
      console.error(`  Failed to embed job ${job.title}:`, e);
    }
  }
  console.log(`\n  Embedded ${jobCount} jobs.`);

  console.log(`\nDone! Embedded ${candidateCount} candidates and ${jobCount} jobs.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("Batch embedding failed:", e);
  process.exit(1);
});
