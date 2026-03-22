import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const checks = await prisma.credentialCheck.findMany({
    where: { lastName: "CLARK" },
  });
  console.log("Existing checks:", JSON.stringify(checks, null, 2));
  
  const candidates = await prisma.candidate.findMany({
    where: { email: "lauren.clark@example.com" },
    select: { id: true, name: true, email: true, phone: true, position: true },
  });
  console.log("\nCandidate record:", JSON.stringify(candidates, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
