import { prisma } from "./db";
import {
  createCalendarEvent,
  getFreeBusySlots,
  isCalendarConfigured,
} from "./google-calendar";

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
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get busy slots from Google Calendar if configured
  const busySlots = isCalendarConfigured()
    ? await getFreeBusySlots(now, weekFromNow)
    : [];

  const slots: Date[] = [];
  for (let d = 1; d <= 7; d++) {
    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const start = new Date(now);
      start.setDate(start.getDate() + d);
      start.setHours(hour, 0, 0, 0);

      if (start <= now) continue;

      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      // Check against existing DB interviews
      const dbConflict = candidate.interviews.some(
        (i) =>
          !i.completed &&
          !i.noShow &&
          i.scheduledAt < end &&
          new Date(i.scheduledAt.getTime() + i.duration * 60 * 1000) > start
      );
      if (dbConflict) continue;

      // Check against Google Calendar busy slots
      const calConflict = busySlots.some((b) => {
        const bStart = new Date(b.start);
        const bEnd = new Date(b.end);
        return bStart < end && bEnd > start;
      });
      if (calConflict) continue;

      slots.push(start);
    }
  }
  return slots.slice(0, 8);
}

export async function scheduleInterview(
  candidateId: string,
  scheduledAt: Date,
  duration = 60,
  location = "Video Call"
) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found");

  // Create Google Calendar event if configured
  let calendarEventId: string | null = null;
  let calendarLink: string | null = null;
  let meetLink: string | null = null;

  if (isCalendarConfigured()) {
    const calResult = await createCalendarEvent({
      summary: `Interview: ${candidate.name} - ${candidate.position}`,
      description: `Interview with ${candidate.name} for the ${candidate.position} position.\n\nCandidate email: ${candidate.email}${candidate.phone ? `\nPhone: ${candidate.phone}` : ""}`,
      startTime: scheduledAt,
      durationMinutes: duration,
      attendeeEmail: candidate.email,
      location,
    });
    if (calResult) {
      calendarEventId = calResult.eventId;
      calendarLink = calResult.calendarLink;
      meetLink = calResult.meetLink;
    }
  }

  const interview = await prisma.interview.create({
    data: {
      candidateId,
      position: candidate.position,
      scheduledAt,
      duration,
      location: meetLink ? "Google Meet" : location,
      calendarEventId,
      calendarLink,
      meetLink,
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
      metadata: JSON.stringify({
        scheduledAt: scheduledAt.toISOString(),
        duration,
        calendarEventId,
      }),
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
