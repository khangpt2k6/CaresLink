import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "maria.johnson@email.com";

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: { include: { licenses: true } } },
  });

  if (!user || !user.profile) {
    console.error("Maria Johnson user/profile not found. Run seed-maria-johnson.ts first.");
    process.exit(1);
  }

  if (user.profile.licenses.length > 0) {
    console.log("License already exists for Maria Johnson, skipping...");
    return;
  }

  await prisma.license.create({
    data: {
      profileId: user.profile.id,
      type: "RN",
      licenseNumber: "RN9421873",
      licenseState: "FL",
      boardName: "Florida Board of Nursing",
      status: "Active",
      issueDate: new Date("2019-06-15"),
      expiryDate: new Date("2027-06-15"),
    },
  });

  console.log("+ Created FL RN license for Maria Johnson (RN9421873)");
  console.log("  Board: Florida Board of Nursing");
  console.log("  Status: Active");
  console.log("  Expires: Jun 2027");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
