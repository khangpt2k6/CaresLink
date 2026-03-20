/**
 * Test seed: creates open jobs that match Kevin's current preferences
 * Roles: RN (Staff Nurse)  →  title must contain "rn"
 * Job Types: Contract       →  type must be "Contract"
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-auto-apply-test.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_JOBS = [
  {
    title: "RN Staff Nurse – Weekend Contract",
    department: "Home Care",
    location: "Remote",
    type: "Contract",
    description:
      "Weekend contract position for a registered nurse providing in-home care. Active RN license required. Flexible scheduling, competitive pay.",
    status: "open",
  },
  {
    title: "RN Care Provider – Adult Day Care",
    department: "Adult Day Care",
    location: "Hybrid",
    type: "Contract",
    description:
      "Contract RN role supporting adult day care programs. Responsibilities include medication administration, vitals monitoring, and care coordination.",
    status: "open",
  },
  {
    title: "Contract RN – In-Home Day Care",
    department: "In-Home Day Care",
    location: "Remote",
    type: "Contract",
    description:
      "Short-term contract for an RN delivering in-home day care services. BSN preferred; current state RN license required.",
    status: "open",
  },
  {
    title: "Part-Time CNA – Nursing Home",
    department: "Nursing Homes",
    location: "Chicago, IL",
    type: "Part-time",
    description:
      "Certified nursing assistant needed for a long-term care facility. No match for Kevin's current filter — used to verify non-matching jobs are excluded.",
    status: "open",
  },
];

async function main() {
  console.log("Seeding auto-apply test jobs…\n");
  let created = 0;
  let skipped = 0;

  for (const job of TEST_JOBS) {
    const existing = await prisma.job.findFirst({ where: { title: job.title } });
    if (existing) {
      console.log(`  - SKIP  ${job.title}`);
      skipped++;
      continue;
    }
    await prisma.job.create({ data: job });
    console.log(`  + ADD   ${job.title}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
  console.log("\nExpected auto-apply matches for Kevin (RN + Contract):");
  console.log("  ✓ RN Staff Nurse – Weekend Contract");
  console.log("  ✓ RN Care Provider – Adult Day Care");
  console.log("  ✓ Contract RN – In-Home Day Care");
  console.log("  ✗ Part-Time CNA – Nursing Home  (should be excluded)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
