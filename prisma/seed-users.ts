import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("test1234", 12);

  // Create employer account
  const employer = await prisma.user.upsert({
    where: { email: "employer@test.com" },
    update: { password, role: "EMPLOYER" },
    create: {
      name: "Test Employer",
      email: "employer@test.com",
      password,
      role: "EMPLOYER",
    },
  });
  console.log("Employer created:", employer.email);

  // Create candidate account
  const candidate = await prisma.user.upsert({
    where: { email: "candidate@test.com" },
    update: { password, role: "CANDIDATE" },
    create: {
      name: "Test Candidate",
      email: "candidate@test.com",
      password,
      role: "CANDIDATE",
    },
  });
  console.log("Candidate created:", candidate.email);

  // List all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  console.log("\nAll users:", JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
