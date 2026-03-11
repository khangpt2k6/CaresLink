import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // List all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  });
  console.log("Current users:", JSON.stringify(users, null, 2));

  // Update all CANDIDATE users to EMPLOYER (for demo)
  const result = await prisma.user.updateMany({
    where: { role: "CANDIDATE" },
    data: { role: "EMPLOYER" },
  });
  console.log(`Updated ${result.count} user(s) to EMPLOYER`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
