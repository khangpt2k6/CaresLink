/**
 * List recent events to verify analytics data.
 * Run: npx tsx scripts/check-events.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  console.log(`Events in last 30 days: ${events.length}\n`);
  const byType = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log("By type:", byType);
  console.log("\nSample events:");
  for (const e of events.slice(0, 10)) {
    console.log(`  ${e.type} | ${e.createdAt.toISOString()} | candidateId: ${e.candidateId || "null"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
