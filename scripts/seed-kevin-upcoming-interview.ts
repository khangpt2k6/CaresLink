import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";

const prisma = new PrismaClient();

/** Seed a future interview for Kevin Phan so the candidate dashboard looks populated. */
async function main() {
  const candidate = await prisma.candidate.findFirst({
    where: { email: "kphan2729@gmail.com" },
  });

  if (!candidate) {
    console.error("Kevin Phan not found in Candidate table.");
    process.exit(1);
  }

  // 3 days from now, 10:00 AM
  const scheduledAt = addDays(new Date(), 3);
  scheduledAt.setHours(10, 0, 0, 0);

  const interview = await prisma.interview.create({
    data: {
      candidateId: candidate.id,
      position: "Registered Nurse",
      scheduledAt,
      duration: 60,
      location: "Video Call",
      meetLink: "https://meet.google.com/abc-defg-hij",
      reminderSent: false,
      completed: false,
      noShow: false,
      cancelled: false,
      confirmed: false,
    },
  });

  console.log(`Created upcoming interview for Kevin Phan:`);
  console.log(`  Candidate: ${candidate.name} (${candidate.email})`);
  console.log(`  Scheduled: ${scheduledAt.toLocaleString()}`);
  console.log(`  Interview ID: ${interview.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
