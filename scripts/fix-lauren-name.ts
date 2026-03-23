import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.candidate.updateMany({
    where: { email: "lauren.clark@example.com" },
    data: { name: "Lauren Clark" },
  });
  console.log("Fixed name → Lauren Clark");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
