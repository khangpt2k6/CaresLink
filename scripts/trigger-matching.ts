import { PrismaClient } from "@prisma/client";
import { embedJob } from "../src/lib/embeddings";

const prisma = new PrismaClient();

async function run() {
  const jobs = await prisma.job.findMany({
    where: { status: "open" },
    select: { id: true, title: true },
  });

  console.log(`Triggering auto-match for ${jobs.length} open jobs...\n`);

  for (const job of jobs) {
    const existingCount = await prisma.jobMatch.count({ where: { jobId: job.id } });
    if (existingCount > 0) {
      console.log(`  ✓ ${job.title}: ${existingCount} matches (already computed)`);
      continue;
    }

    console.log(`  ⏳ ${job.title}: computing...`);
    await embedJob(job.id);
    const newCount = await prisma.jobMatch.count({ where: { jobId: job.id } });
    console.log(`  ✓ ${job.title}: ${newCount} matches`);
  }

  const total = await prisma.jobMatch.count();
  console.log(`\nDone! Total matches in database: ${total}`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
