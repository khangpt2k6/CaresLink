/**
 * Check availability data for employer and candidate.
 * Run: npx tsx scripts/check-availability.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function main() {
  console.log("=== Availability Check ===\n");

  // 1. Recruiter availability (kvp.work27@gmail.com) - stored in Availability table (HR schedule)
  console.log("RECRUITER (kvp.work27@gmail.com) - Availability table (HR weekly schedule):");
  const recruiterSchedule = await prisma.availability.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  if (recruiterSchedule.length === 0) {
    console.log("  No availability set. Recruiter should set this in Calendar page.\n");
  } else {
    for (const row of recruiterSchedule) {
      const range = row.enabled
        ? `${row.startHour}:00 - ${row.endHour}:00`
        : "disabled";
      console.log(`  ${DAYS[row.dayOfWeek]}: ${range}`);
    }
    console.log("");
  }

  // 2. Candidate availability (2006tuankhang@gmail.com) - stored in CandidateAvailability
  const candidateUser = await prisma.user.findFirst({
    where: { email: { equals: "2006tuankhang@gmail.com", mode: "insensitive" }, role: "CANDIDATE" },
  });
  console.log("CANDIDATE (2006tuankhang@gmail.com):");
  if (!candidateUser) {
    console.log("  User not found in database.\n");
  } else {
    const candidateAvail = await prisma.candidateAvailability.findMany({
      where: { userId: candidateUser.id },
      orderBy: { dayOfWeek: "asc" },
    });
    if (candidateAvail.length === 0) {
      console.log("  No availability set. Candidate should set this in My Availability page.\n");
    } else {
      for (const row of candidateAvail) {
        const range = row.enabled
          ? `${row.startHour}:00 - ${row.endHour}:00`
          : "disabled";
        console.log(`  ${DAYS[row.dayOfWeek]}: ${range}`);
      }
      console.log("");
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
