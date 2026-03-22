import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "sarah.williams@example.com" },
    include: { profile: { include: { licenses: true } } },
  });

  if (user?.profile) {
    await prisma.license.deleteMany({ where: { profileId: user.profile.id } });
    await prisma.license.create({
      data: {
        profileId: user.profile.id,
        type: "RPT",
        licenseNumber: "RPT119270",
        licenseState: "FL",
        boardName: "Florida Board of Nursing",
        status: "Clear/Active",
        issueDate: new Date("2020-01-01"),
      },
    });
    console.log("Updated Sarah Williams profile license → RPT119270");
  }

  // Also update any credential checks for Sarah Williams
  const updated = await prisma.credentialCheck.updateMany({
    where: { firstName: "SARAH", lastName: "WILLIAMS" },
    data: { licenseNumber: "RPT119270", licenseState: "FL" },
  });
  console.log(`Updated ${updated.count} credential checks`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
