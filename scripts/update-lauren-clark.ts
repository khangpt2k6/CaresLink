import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Update candidate record name and position
  await prisma.candidate.updateMany({
    where: { email: "lauren.clark@example.com" },
    data: { name: "Lauren E Clark", position: "Certified Nursing Assistant" },
  });
  console.log("Updated candidate: Lauren E Clark | Certified Nursing Assistant");

  // Update profile license
  const user = await prisma.user.findUnique({
    where: { email: "lauren.clark@example.com" },
    include: { profile: { include: { licenses: true } } },
  });

  if (user?.profile) {
    await prisma.license.deleteMany({ where: { profileId: user.profile.id } });
    await prisma.license.create({
      data: {
        profileId: user.profile.id,
        type: "CNA",
        licenseNumber: "CNA362882",
        licenseState: "FL",
        boardName: "Florida Board of Nursing",
        status: "Delinquent/Active",
        issueDate: new Date("2020-01-01"),
      },
    });
    console.log("Updated license → CNA362882 | Delinquent/Active");
  } else {
    console.log("No user/profile found for lauren.clark@example.com");
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
