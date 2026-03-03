import { prisma } from "./db";

export async function findNextAvailableSlots(
  candidateId: string,
  durationMinutes = 60
): Promise<Date[]> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { interviews: true },
  });
  if (!candidate) return [];

  const now = new Date();
  const slots: Date[] = [];
  for (let d = 1; d <= 7; d++) {
    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const start = new Date(now);
      start.setDate(start.getDate() + d);
      start.setHours(hour, 0, 0, 0);

      if (start <= now) continue;

      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const conflicts = candidate.interviews.some(
        (i) =>
          !i.completed &&
          !i.noShow &&
          i.scheduledAt < end &&
          new Date(i.scheduledAt.getTime() + i.duration * 60 * 1000) > start
      );
      if (!conflicts) slots.push(start);
    }
  }
  return slots.slice(0, 5);
}

export async function scheduleInterview(
  candidateId: string,
  scheduledAt: Date,
  duration = 60,
  location = "Video Call"
) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found");

  const interview = await prisma.interview.create({
    data: {
      candidateId,
      position: candidate.position,
      scheduledAt,
      duration,
      location,
    },
  });

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { status: "scheduled" },
  });

  await prisma.event.create({
    data: {
      type: "interview_scheduled",
      candidateId,
      interviewId: interview.id,
      metadata: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), duration }),
    },
  });

  return interview;
}

export async function sendReminder(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { candidate: true },
  });
  if (!interview) throw new Error("Interview not found");
  if (interview.reminderSent) return { alreadySent: true };
  return { interview, candidate: interview.candidate };
}
