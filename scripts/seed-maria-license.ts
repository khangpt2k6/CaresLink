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

  // Real Nursys-verified data (NCSBN ID: 21551977, March 25 2026)
  // Active license — Washington (UNENCUMBERED)
  await prisma.license.create({
    data: {
      profileId: user.profile.id,
      type: "RN",
      licenseNumber: "RN60837175",
      licenseState: "WA",
      boardName: "Washington State Nursing Commission",
      status: "UNENCUMBERED",
      issueDate: new Date("2018-03-01"),
      expiryDate: new Date("2026-04-22"),
    },
  });

  // Expired license — Florida (Null & Void)
  await prisma.license.create({
    data: {
      profileId: user.profile.id,
      type: "RN",
      licenseNumber: "RN9458458",
      licenseState: "FL",
      boardName: "Florida Board of Nursing",
      status: "EXPIRED",
      issueDate: new Date("2017-04-24"),
      expiryDate: new Date("2018-07-31"),
    },
  });

  // Expired license — Vermont
  await prisma.license.create({
    data: {
      profileId: user.profile.id,
      type: "RN",
      licenseNumber: "026.0052205",
      licenseState: "VT",
      boardName: "Vermont Board of Nursing",
      status: "EXPIRED",
      issueDate: new Date("2009-12-04"),
      expiryDate: new Date("2019-03-31"),
    },
  });

  console.log("+ Created 3 licenses for Maria Johnson (Nursys-verified):");
  console.log("  WA: RN60837175 — UNENCUMBERED (active, expires 04/22/2026)");
  console.log("  FL: RN9458458 — EXPIRED (Null & Void)");
  console.log("  VT: 026.0052205 — EXPIRED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
