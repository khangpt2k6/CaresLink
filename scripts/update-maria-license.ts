import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Update Maria Johnson's credential checks to use real Nursys-verified data
  // From Nursys QuickConfirm report (NCSBN ID: 21551977, March 25 2026):
  //   FL: RN9458458 — EXPIRED (Null & Void, 04/24/2017 - 07/31/2018)
  //   VT: 026.0052205 — EXPIRED (12/04/2009 - 03/31/2019)
  //   WA: RN60837175 — UNENCUMBERED (03/01/2018 - 04/22/2026, SINGLE STATE)
  const updated = await prisma.credentialCheck.updateMany({
    where: { firstName: "MARIA", lastName: "JOHNSON" },
    data: { licenseNumber: "RN9458458", roleType: "NURSE", licenseState: "FL" },
  });
  console.log(`Updated ${updated.count} credential checks → License: RN9458458 (NURSE, FL)`);

  // Also update her profile licenses
  const user = await prisma.user.findUnique({
    where: { email: "maria.johnson@email.com" },
    include: { profile: { include: { licenses: true } } },
  });

  if (user?.profile) {
    await prisma.license.deleteMany({ where: { profileId: user.profile.id } });

    // Vermont license (EXPIRED) — created first so it's oldest
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
    console.log("  + VT license: 026.0052205 — EXPIRED");

    // Washington license (UNENCUMBERED)
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
    console.log("  + WA license: RN60837175 — UNENCUMBERED (active, expires 04/22/2026)");

    // Florida license — created LAST so it's picked by `orderBy: createdAt desc`
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
    console.log("  + FL license: RN9458458 — EXPIRED (Null & Void) ← will be picked by form");
  }

  // Verify
  const checks = await prisma.credentialCheck.findMany({
    where: { firstName: "MARIA", lastName: "JOHNSON" },
    select: { firstName: true, lastName: true, licenseNumber: true, roleType: true, licenseState: true },
  });
  console.log("\nCredential checks:", JSON.stringify(checks, null, 2));

  if (user?.profile) {
    const licenses = await prisma.license.findMany({ where: { profileId: user.profile.id } });
    console.log("Licenses:", JSON.stringify(licenses.map((l) => ({ number: l.licenseNumber, state: l.licenseState, status: l.status })), null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
