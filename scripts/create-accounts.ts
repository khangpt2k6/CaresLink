/**
 * Creates the candidate and employer accounts.
 * Run: npx tsx scripts/create-accounts.ts
 *
 * Default password for both: CaresLink123!
 * Change it after first login.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "CaresLink123!";

async function main() {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const candidate = await prisma.user.upsert({
    where: { email: "2006tuankhang@gmail.com" },
    update: { role: "CANDIDATE", password: hashedPassword },
    create: {
      email: "2006tuankhang@gmail.com",
      name: "Candidate",
      password: hashedPassword,
      role: "CANDIDATE",
    },
  });

  const employer = await prisma.user.upsert({
    where: { email: "kvp.work27@gmail.com" },
    update: { role: "EMPLOYER", password: hashedPassword },
    create: {
      email: "kvp.work27@gmail.com",
      name: "Employer",
      password: hashedPassword,
      role: "EMPLOYER",
    },
  });

  console.log("Accounts created:");
  console.log("  Candidate:", candidate.email, "(role: CANDIDATE)");
  console.log("  Employer: ", employer.email, "(role: EMPLOYER)");
  console.log("\nDefault password for both: " + DEFAULT_PASSWORD);
  console.log("Change it after first login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
