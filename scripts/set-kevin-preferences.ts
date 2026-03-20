/**
 * Sets Kevin's job preferences directly in the DB so they appear
 * pre-selected on the frontend — perfect for testing auto-apply.
 *
 * Run: npm run set:kevin-prefs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Preferences chosen to match the 3 seeded test jobs
const PREFS = {
  roles:         ["RN (Staff Nurse)"],
  businessUnits: ["In-Home Day Care", "Adult Day Care"],
  jobTypes:      ["Contract"],
  shifts:        ["Weekends"],
};

async function main() {
  // Find Kevin (first CANDIDATE whose email starts with kp)
  const user = await prisma.user.findFirst({
    where: { role: "CANDIDATE", email: { startsWith: "kp" } },
    include: { profile: true },
  });

  if (!user) {
    // Fall back to any candidate
    const fallback = await prisma.user.findFirst({
      where: { role: "CANDIDATE" },
      include: { profile: true },
    });
    if (!fallback) { console.error("No candidate users found."); return; }
    await applyPrefs(fallback);
  } else {
    await applyPrefs(user);
  }
}

async function applyPrefs(user: any) {
  console.log(`Setting preferences for: ${user.name ?? user.email}`);

  // Ensure profile exists
  let profile = user.profile;
  if (!profile) {
    profile = await prisma.candidateProfile.create({
      data: { userId: user.id },
    });
    console.log("  Created CandidateProfile");
  }

  // Upsert preferences
  const prefs = await prisma.jobPreferences.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, ...PREFS },
    update: PREFS,
  });

  console.log("\nPreferences saved:");
  console.log("  Roles:         ", prefs.roles.join(", "));
  console.log("  Business Units:", prefs.businessUnits.join(", "));
  console.log("  Job Types:     ", prefs.jobTypes.join(", "));
  console.log("  Shifts:        ", prefs.shifts.join(", "));
  console.log("\nNow open Job Preferences — selections will appear pre-filled.");
  console.log("Click Auto-Apply to Matching Jobs to test.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
