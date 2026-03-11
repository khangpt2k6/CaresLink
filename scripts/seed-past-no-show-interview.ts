import { PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

/** Create a past interview (candidate no-show) for testing the Mark no-show flow. */
async function main() {
  // Find a candidate — prefer Testing candidate or first available
  const candidate = await prisma.candidate.findFirst({
    where: { email: { in: ["2006tuankhang@gmail.com", "kphan2729@gmail.com"] } },
  }) ?? await prisma.candidate.findFirst();

  if (!candidate) {
    console.error("No candidate found. Add candidates first.");
    process.exit(1);
  }

  // 2 days ago, 10:00 AM — within "last 7 days"
  const scheduledAt = subDays(new Date(), 2);
  scheduledAt.setHours(10, 0, 0, 0);

  const interview = await prisma.interview.create({
    data: {
      candidateId: candidate.id,
      position: candidate.position,
      scheduledAt,
      duration: 60,
      location: "Video Call",
      reminderSent: true,
      completed: false,
      noShow: false, // recruiter can mark as no-show
      cancelled: false,
    },
  });

  console.log(`Created past interview (no-show test):`);
  console.log(`  Candidate: ${candidate.name} (${candidate.email})`);
  console.log(`  Scheduled: ${scheduledAt.toLocaleString()}`);
  console.log(`  Interview ID: ${interview.id}`);
  console.log(`\nRefresh Interviews page → "Past (last 7 days)" → Mark no-show`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
