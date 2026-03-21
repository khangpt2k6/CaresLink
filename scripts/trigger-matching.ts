import { PrismaClient } from "@prisma/client";
import { embedJob } from "../src/lib/embeddings";

const prisma = new PrismaClient();

async function run() {
  const jobs = await prisma.job.findMany({
    where: { status: "open" },
    select: { id: true, title: true },
  });

  console.log(`Scoring ${jobs.length} jobs (Claude AI, parallel)...\n`);

  // Run 3 jobs in parallel to balance speed vs rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (job) => {
        const before = await prisma.jobMatch.count({ where: { jobId: job.id } });
        if (before > 0) {
          console.log(`  ✓ ${job.title}: ${before} matches (cached)`);
          return;
        }
        console.log(`  ⏳ ${job.title}...`);
        await embedJob(job.id);
        const after = await prisma.jobMatch.count({ where: { jobId: job.id } });
        console.log(`  ✓ ${job.title}: ${after} matches`);
      })
    );
  }

  const total = await prisma.jobMatch.count();
  console.log(`\nDone! ${total} total matches.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
