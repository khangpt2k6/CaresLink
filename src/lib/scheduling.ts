import { prisma } from "./db";
import {
  createCalendarEvent,
  getFreeBusySlots,
  isCalendarConfigured,
} from "./google-calendar";
import { sendEmail } from "./sendgrid";
import { generateICS } from "./ics";
import { format, addMinutes } from "date-fns";

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

export async function findPublicAvailableSlots(
  month: number, // 0-indexed (0 = January)
  year: number,
  durationMinutes = 60
): Promise<Date[]> {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
  const now = new Date();

  const rangeStart = startOfMonth > now ? startOfMonth : now;
  if (endOfMonth < now) return [];

  const busySlots = isCalendarConfigured()
    ? await getFreeBusySlots(rangeStart, endOfMonth)
    : [];

  const existingInterviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: rangeStart, lte: endOfMonth },
      completed: false,
      noShow: false,
      cancelled: false,
    },
  });

  const slots: Date[] = [];
  const current = new Date(rangeStart);
  current.setHours(0, 0, 0, 0);
  if (current < now) current.setDate(current.getDate() + 1);

  while (current <= endOfMonth) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const start = new Date(current);
      start.setHours(hour, 0, 0, 0);
      if (start <= now) continue;

      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const dbConflict = existingInterviews.some(
        (i) =>
          i.scheduledAt < end &&
          new Date(i.scheduledAt.getTime() + i.duration * 60 * 1000) > start
      );
      if (dbConflict) continue;

      const calConflict = busySlots.some((b) => {
        const bStart = new Date(b.start);
        const bEnd = new Date(b.end);
        return bStart < end && bEnd > start;
      });
      if (calConflict) continue;

      slots.push(new Date(start));
    }

    current.setDate(current.getDate() + 1);
  }

  return slots;
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

  // Send confirmation email with calendar invite to candidate
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const startTime = scheduledAt;
  const endTime = addMinutes(startTime, duration);
  const dateStr = format(startTime, "EEEE, MMMM d, yyyy 'at' h:mm a");
  const cancelUrl = `${APP_URL}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
  const confirmUrl = `${APP_URL}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;

  const icsContent = generateICS({
    title: `Interview — ${candidate.position} at CaresLink`,
    description: `Your interview for the ${candidate.position} position.${meetLink ? `\n\nJoin: ${meetLink}` : ""}`,
    startTime,
    endTime,
    location: meetLink || undefined,
    organizer: { name: "CaresLink Recruiting", email: FROM_EMAIL },
    attendee: { name: candidate.name, email: candidate.email },
  });

  const meetSection = meetLink
    ? `<div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>Video Call Link:</strong><br/>
            <a href="${meetLink}" style="color: #0090d9; text-decoration: none;">${meetLink}</a>
          </div>`
    : "";

  await sendEmail(
    candidate.email,
    `Interview Invitation — ${candidate.position} at CaresLink`,
    `Dear ${candidate.name},\n\nYou have been invited to interview for the ${candidate.position} position.\n\nScheduled: ${dateStr} EST${meetLink ? `\nVideo Call: ${meetLink}` : ""}\n\nConfirm attendance: ${confirmUrl}\nReschedule: ${APP_URL}/book\nCancel: ${cancelUrl}\n\nWe look forward to speaking with you.\n\nBest regards,\nCaresLink Team`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
        <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #fff; font-size: 18px;">Interview Invitation</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Dear ${candidate.name},</p>
          <p style="margin: 0 0 16px;">You have been invited to interview for the <strong>${candidate.position}</strong> position at CaresLink.</p>
          <div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>${dateStr} EST</strong>
          </div>
          ${meetSection}
          <p style="margin: 0 0 16px;">Please confirm your attendance or let us know if you need to make changes:</p>
          <div style="text-align: center; margin: 0 0 12px;">
            <a href="${confirmUrl}" style="display: inline-block; background: #0090d9; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Confirm Attendance</a>
          </div>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${APP_URL}/book" style="color: #0090d9; text-decoration: none; font-size: 13px; margin-right: 16px;">Reschedule</a>
            <span style="color: #ccc;">|</span>
            <a href="${cancelUrl}" style="color: #e53e3e; text-decoration: none; font-size: 13px; margin-left: 16px;">Cancel Interview</a>
          </div>
          <p style="margin: 0 0 4px;">We look forward to speaking with you.</p>
          <p style="margin: 24px 0 0; color: #5a6b7c;">Best regards,<br/>CaresLink Team</p>
        </div>
      </div>`,
    icsContent
  ).catch((err) => console.error("Failed to send interview confirmation:", err));

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
