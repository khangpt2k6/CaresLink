/**
 * Creates the candidate and employer users in the database.
 * Run: npx tsx scripts/create-accounts.ts
 *
 * Users must sign up via Clerk (sign-in/sign-up) with these emails to get linked.
 * Once they sign up with Clerk, getOrCreateUser will link their Clerk account to these records.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.user.upsert({
    where: { email: "2006tuankhang@gmail.com" },
    update: { role: "CANDIDATE" },
    create: {
      email: "2006tuankhang@gmail.com",
      name: "Candidate",
      role: "CANDIDATE",
    },
  });

  const employer = await prisma.user.upsert({
    where: { email: "kvp.work27@gmail.com" },
    update: { role: "EMPLOYER" },
    create: {
      email: "kvp.work27@gmail.com",
      name: "Employer",
      role: "EMPLOYER",
    },
  });

  console.log("Accounts created:");
  console.log("  Candidate:", candidate.email, "(role: CANDIDATE)");
  console.log("  Employer: ", employer.email, "(role: EMPLOYER)");
  console.log("\nSign up via Clerk at /sign-up with these emails to get linked.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
