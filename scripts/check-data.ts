import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const t = await p.interviewTranscript.count();
  const n = await p.interviewNote.count();
  const s = await p.interviewSummary.count();
  console.log(`Transcripts: ${t} | Notes: ${n} | Summaries: ${s}`);

  const interviews = await p.interview.findMany({
    where: { transcripts: { some: {} } },
    include: {
      candidate: { select: { name: true } },
      _count: { select: { transcripts: true, notes: true } },
      summary: { select: { recommendation: true } },
    },
  });

  for (const i of interviews) {
    console.log(`\nInterview: ${i.id}`);
    console.log(`  Candidate: ${i.candidate.name}`);
    console.log(`  Transcripts: ${i._count.transcripts}`);
    console.log(`  Notes: ${i._count.notes}`);
    console.log(`  Summary: ${i.summary ? i.summary.recommendation : "NONE"}`);
  }

  await p.$disconnect();
}
main();
