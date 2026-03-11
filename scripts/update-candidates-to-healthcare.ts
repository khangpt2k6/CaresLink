import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HEALTHCARE_POSITIONS = [
  "Registered Nurse",
  "Medical Assistant",
  "Patient Care Coordinator",
  "Clinical Coordinator",
  "Care Coordinator",
  "Healthcare Administrator",
  "Medical Billing Specialist",
  "Pharmacy Technician",
  "Medical Records Technician",
];

async function main() {
  const candidates = await prisma.candidate.findMany({ orderBy: { appliedAt: "asc" } });
  let updated = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const newPosition = HEALTHCARE_POSITIONS[i % HEALTHCARE_POSITIONS.length];

    await prisma.candidate.update({
      where: { id: c.id },
      data: { position: newPosition },
    });

    // Update interviews to match
    await prisma.interview.updateMany({
      where: { candidateId: c.id },
      data: { position: newPosition },
    });

    updated++;
    console.log(`  ${c.name} → ${newPosition}`);
  }

  console.log(`\nDone: ${updated} candidates updated to healthcare roles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
