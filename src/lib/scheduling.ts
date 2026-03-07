import { prisma } from "./db";
import {
  createCalendarEvent,
  getFreeBusySlots,
  isCalendarConfigured,
} from "./google-calendar";
import { sendEmail } from "./sendgrid";
import { generateICS } from "./ics";
import { getTimezone, getTimezoneAbbr, formatInTimezone, getDefaultDuration } from "./timezone";
import { addMinutes } from "date-fns";

// Sanitize hour values — detect corrupted denormalized floats
function sanitizeHour(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 24) return fallback;
  if (value > 0 && value < 0.01) return fallback;
  return value;
}

// Get available slot start times for a specific date (supports 30-min granularity)
async function getAvailableSlotStarts(date: Date): Promise<{ hour: number; minute: number }[]> {
  const dayOfWeek = date.getDay();

  // Check for date override first
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  const override = await prisma.dateOverride.findUnique({ where: { date: dateOnly } });

  let startHour: number;
  let endHour: number;

  if (override) {
    if (!override.available) return []; // Blocked date
    startHour = override.startHour ?? 9;
    endHour = override.endHour ?? 17;
  } else {
    const schedule = await prisma.availability.findUnique({ where: { dayOfWeek } });
    if (!schedule || !schedule.enabled) return [];
    startHour = sanitizeHour(schedule.startHour, 9);
    endHour = sanitizeHour(schedule.endHour, 17);
  }

  if (startHour >= endHour) return [];

  // Generate 30-min slot starts from startHour to endHour
  const slots: { hour: number; minute: number }[] = [];
  let current = startHour;
  while (current < endHour) {
    const h = Math.floor(current);
    const m = Math.round((current - h) * 60);
    slots.push({ hour: h, minute: m });
    current += 0.5;
  }
  return slots;
}

export async function findNextAvailableSlots(
  candidateId: string,
  durationMinutes?: number
): Promise<Date[]> {
  const duration = durationMinutes ?? await getDefaultDuration();
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { interviews: true },
  });
  if (!candidate) return [];

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get busy slots from Google Calendar if configured
  const busySlots = (await isCalendarConfigured())
    ? await getFreeBusySlots(now, weekFromNow)
    : [];

  const slots: Date[] = [];
  for (let d = 1; d <= 7; d++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + d);

    const slotStarts = await getAvailableSlotStarts(dayDate);

    for (const { hour, minute } of slotStarts) {
      const start = new Date(dayDate);
      start.setHours(hour, minute, 0, 0);

      if (start <= now) continue;

      const end = new Date(start.getTime() + duration * 60 * 1000);

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
  durationMinutes?: number
): Promise<Date[]> {
  const duration = durationMinutes ?? await getDefaultDuration();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
  const now = new Date();

  const rangeStart = startOfMonth > now ? startOfMonth : now;
  if (endOfMonth < now) return [];

  // Batch all DB queries upfront (3 queries instead of 31+)
  const [weeklySchedule, dateOverrides, existingInterviews, busySlots] = await Promise.all([
    prisma.availability.findMany(),
    prisma.dateOverride.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    prisma.interview.findMany({
      where: {
        scheduledAt: { gte: rangeStart, lte: endOfMonth },
        completed: false,
        noShow: false,
        cancelled: false,
      },
    }),
    isCalendarConfigured().then((configured) =>
      configured ? getFreeBusySlots(rangeStart, endOfMonth) : []
    ),
  ]);

  // Index weekly schedule by dayOfWeek
  const scheduleByDay = new Map(weeklySchedule.map((s) => [s.dayOfWeek, s]));

  // Index overrides by date string
  const overrideByDate = new Map(
    dateOverrides.map((o) => {
      const d = new Date(o.date);
      d.setHours(0, 0, 0, 0);
      return [d.toISOString().split("T")[0], o];
    })
  );

  // Helper: get slot starts for a date from cached data
  function getSlotStartsFromCache(date: Date): { hour: number; minute: number }[] {
    const dateKey = new Date(date);
    dateKey.setHours(0, 0, 0, 0);
    const dateStr = dateKey.toISOString().split("T")[0];
    const override = overrideByDate.get(dateStr);

    let startHour: number;
    let endHour: number;

    if (override) {
      if (!override.available) return [];
      startHour = override.startHour ?? 9;
      endHour = override.endHour ?? 17;
    } else {
      const schedule = scheduleByDay.get(date.getDay());
      if (!schedule || !schedule.enabled) return [];
      startHour = sanitizeHour(schedule.startHour, 9);
      endHour = sanitizeHour(schedule.endHour, 17);
    }

    if (startHour >= endHour) return [];

    const slotsList: { hour: number; minute: number }[] = [];
    let cur = startHour;
    while (cur < endHour) {
      const h = Math.floor(cur);
      const m = Math.round((cur - h) * 60);
      slotsList.push({ hour: h, minute: m });
      cur += 0.5;
    }
    return slotsList;
  }

  const slots: Date[] = [];
  const current = new Date(rangeStart);
  current.setHours(0, 0, 0, 0);
  if (current < now) current.setDate(current.getDate() + 1);

  while (current <= endOfMonth) {
    const slotStarts = getSlotStartsFromCache(current);

    if (slotStarts.length === 0) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    for (const { hour, minute } of slotStarts) {
      const start = new Date(current);
      start.setHours(hour, minute, 0, 0);
      if (start <= now) continue;

      const end = new Date(start.getTime() + duration * 60 * 1000);

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
  durationOverride?: number,
  location = "Video Call"
) {
  const duration = durationOverride ?? await getDefaultDuration();
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found");

  // Create Google Calendar event if configured
  let calendarEventId: string | null = null;
  let calendarLink: string | null = null;
  let meetLink: string | null = null;

  if (await isCalendarConfigured()) {
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
  const tz = await getTimezone();
  const tzAbbr = getTimezoneAbbr(tz);
  const startTime = scheduledAt;
  const endTime = addMinutes(startTime, duration);
  const dateStr = formatInTimezone(startTime, tz, "") + " " + tzAbbr;
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
    `Interview Invitation — ${candidate.position} at CaresLink | ${dateStr}`,
    `Dear ${candidate.name},\n\nYou have been invited to interview for the ${candidate.position} position.\n\nScheduled: ${dateStr}${meetLink ? `\nVideo Call: ${meetLink}` : ""}\n\nConfirm attendance: ${confirmUrl}\nReschedule: ${APP_URL}/book\nCancel: ${cancelUrl}\n\nWe look forward to speaking with you.\n\nBest regards,\nCaresLink Team`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
        <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #fff; font-size: 18px;">Interview Invitation</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Dear ${candidate.name},</p>
          <p style="margin: 0 0 16px;">You have been invited to interview for the <strong>${candidate.position}</strong> position at CaresLink.</p>
          <div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>${dateStr}</strong><br/>
            <span style="font-size: 13px; color: #5a6b7c;">${duration} minutes</span>
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
