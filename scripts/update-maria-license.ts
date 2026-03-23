import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Update Maria Johnson's credential checks to use real FL RN license
  const updated = await prisma.credentialCheck.updateMany({
    where: { firstName: "MARIA", lastName: "JOHNSON" },
    data: { licenseNumber: "RN9442195", roleType: "NURSE", licenseState: "FL" },
  });
  console.log(`Updated ${updated.count} credential checks → License: RN9442195 (NURSE, FL)`);

  // Also update her profile license
  const user = await prisma.user.findUnique({
    where: { email: "maria.johnson@email.com" },
    include: { profile: { include: { licenses: true } } },
  });

  if (user?.profile) {
    await prisma.license.deleteMany({ where: { profileId: user.profile.id } });
    await prisma.license.create({
      data: {
        profileId: user.profile.id,
        type: "RN",
        licenseNumber: "RN9442195",
        licenseState: "FL",
        boardName: "Florida Board of Nursing",
        status: "Clear/Active",
        issueDate: new Date("2020-01-01"),
      },
    });
    console.log("Updated Maria Johnson profile license → RN9442195");
  }

  // Verify
  const checks = await prisma.credentialCheck.findMany({
    where: { firstName: "MARIA", lastName: "JOHNSON" },
    select: { firstName: true, lastName: true, licenseNumber: true, roleType: true, licenseState: true },
  });
  console.log("\nVerification:", JSON.stringify(checks, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
