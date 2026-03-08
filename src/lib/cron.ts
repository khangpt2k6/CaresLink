import cron from "node-cron";
import { prisma } from "./db";
import { sendEmail } from "./sendgrid";
import { generateICS } from "./ics";
import { addHours, addMinutes } from "date-fns";
import { getTimezone, getTimezoneAbbr, formatInTimezone } from "./timezone";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  // Run every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      await checkAndSendReminders();
    } catch (e) {
      console.error("[Cron] Reminder check failed:", e);
    }
  });

  // Run daily at 9am for follow-up sequence (Day 1, 3, 5)
  cron.schedule("0 9 * * *", async () => {
    try {
      await runFollowUpSequence();
    } catch (e) {
      console.error("[Cron] Follow-up sequence failed:", e);
    }
  });

  console.log("[Cron] Auto-reminder scheduler started (runs every 30 min)");
  console.log("[Cron] Follow-up sequence (Day 1, 3, 5) runs daily at 9am");
}

async function checkAndSendReminders() {
  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 24h reminder window: interviews scheduled between 23.5h and 24.5h from now
  const window24Start = addHours(now, 23.5);
  const window24End = addHours(now, 24.5);

  // 1h reminder window: interviews scheduled between 0.75h and 1.25h from now
  const window1Start = addHours(now, 0.75);
  const window1End = addHours(now, 1.25);

  const upcoming = await prisma.interview.findMany({
    where: {
      completed: false,
      noShow: false,
      cancelled: false,
      scheduledAt: { gte: window1Start, lte: window24End },
    },
    include: { candidate: true },
  });

  let sent24h = 0;
  let sent1h = 0;

  for (const interview of upcoming) {
    const { candidate } = interview;
    const scheduledAt = new Date(interview.scheduledAt);
    const is24hWindow = scheduledAt >= window24Start && scheduledAt <= window24End;
    const is1hWindow = scheduledAt >= window1Start && scheduledAt <= window1End;

    const tz = await getTimezone();
    const tzAbbr = getTimezoneAbbr(tz);
    const dateStr = formatInTimezone(scheduledAt, tz, "") + " " + tzAbbr;
    const confirmUrl = `${appUrl}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const cancelUrl = `${appUrl}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const meetPart = interview.meetLink ? `\nJoin video call: ${interview.meetLink}` : "";

    // 24h email reminder (only if not already sent)
    if (is24hWindow && !interview.reminderSent) {
      const icsContent = generateICS({
        title: `Interview — ${interview.position} at CaresLink`,
        description: `Your interview for the ${interview.position} position.${interview.meetLink ? `\n\nJoin: ${interview.meetLink}` : ""}`,
        startTime: scheduledAt,
        endTime: addMinutes(scheduledAt, interview.duration),
        location: interview.meetLink || undefined,
        organizer: { name: "CaresLink Recruiting", email: FROM_EMAIL },
        attendee: { name: candidate.name, email: candidate.email },
      });
      const result = await sendEmail(
        candidate.email,
        `Reminder: Your Interview is Tomorrow — ${interview.position}`,
        `Dear ${candidate.name},\n\nThis is a reminder that your interview for the ${interview.position} position is scheduled for tomorrow.\n\n📅 ${dateStr}${meetPart}\n\nPlease confirm your attendance:\n${confirmUrl}\n\nNeed to cancel or reschedule?\n${cancelUrl}\n\nThank you,\nCaresLink Recruiting`,
        undefined,
        icsContent
      );

      if (result.success) {
        await prisma.interview.update({
          where: { id: interview.id },
          data: { reminderSent: true },
        });
        await prisma.event.create({
          data: {
            type: "reminder_sent",
            candidateId: candidate.id,
            interviewId: interview.id,
            channel: "email",
            metadata: JSON.stringify({ type: "24h_reminder" }),
          },
        });
        sent24h++;
      }
    }

    // 1h email reminder (always, close to interview time)
    if (is1hWindow) {
      const result = await sendEmail(
        candidate.email,
        `Your Interview Starts in 1 Hour — ${interview.position}`,
        `Dear ${candidate.name},\n\nYour interview for the ${interview.position} position starts in 1 hour.\n\n📅 ${dateStr}${meetPart}\n\n${interview.meetLink ? "Join the video call when ready:\n" + interview.meetLink : ""}\n\nGood luck!\n\nCaresLink Recruiting`
      );

      if (result.success) {
        await prisma.event.create({
          data: {
            type: "reminder_sent",
            candidateId: candidate.id,
            interviewId: interview.id,
            channel: "email",
            metadata: JSON.stringify({ type: "1h_reminder" }),
          },
        });
        sent1h++;
      }
    }
  }

  if (sent24h > 0 || sent1h > 0) {
    console.log(`[Cron] Sent ${sent24h} 24h reminders, ${sent1h} 1h reminders`);
  }

  // Follow-up: find unconfirmed interviews scheduled in 48h that haven't been reminded
  const unconfirmedFollowups = await prisma.interview.findMany({
    where: {
      completed: false,
      noShow: false,
      cancelled: false,
      confirmed: false,
      reminderSent: true,
      scheduledAt: { gte: addHours(now, 47), lte: addHours(now, 49) },
    },
    include: { candidate: true },
  });

  for (const interview of unconfirmedFollowups) {
    const { candidate } = interview;
    const tz2 = await getTimezone();
    const tzAbbr2 = getTimezoneAbbr(tz2);
    const dateStr = formatInTimezone(new Date(interview.scheduledAt), tz2, "") + " " + tzAbbr2;
    const confirmUrl = `${appUrl}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const cancelUrl = `${appUrl}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;

    await sendEmail(
      candidate.email,
      `Please Confirm Your Interview — ${interview.position}`,
      `Dear ${candidate.name},\n\nWe noticed you haven't confirmed your upcoming interview yet.\n\n📅 ${dateStr} for the ${interview.position} position.\n\nPlease let us know:\n✅ Confirm attendance: ${confirmUrl}\n❌ Cancel or reschedule: ${cancelUrl}\n\nThank you,\nCaresLink Recruiting`
    ).catch(() => {});
  }

  await runFollowUpSequence();
}

/** Day 1, 3, 5 follow-up sequence for unresponsive candidates (email only) */
async function runFollowUpSequence() {
  const { getStaleCandidates } = await import("@/lib/insights");
  const stale = await getStaleCandidates(1); // min 1 day since outreach
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const companyName = process.env.COMPANY_NAME || "CaresLink Team";

  for (const c of stale) {
    const events = await prisma.event.findMany({
      where: { candidateId: c.id },
      orderBy: { createdAt: "desc" },
    });
    const outreachTypes = ["email_sent", "booking_link_sent"];
    const followUpType = "follow_up_sent";
    const lastOutreach = events.find((e) => outreachTypes.includes(e.type));
    if (!lastOutreach) continue;

    const lastFollowUp = events.find((e) => e.type === followUpType);
    const lastFollowUpDay = lastFollowUp?.metadata
      ? parseInt(JSON.parse(lastFollowUp.metadata || "{}").day || "0", 10)
      : 0;
    const outreachAt = new Date(lastOutreach.createdAt);
    const hoursSince = (Date.now() - outreachAt.getTime()) / (60 * 60 * 1000);
    const daysSince = Math.floor(hoursSince / 24);

    let sendDay: number | null = null;
    if (daysSince >= 5 && lastFollowUpDay < 5) sendDay = 5;
    else if (daysSince >= 3 && lastFollowUpDay < 3) sendDay = 3;
    else if (daysSince >= 1 && lastFollowUpDay < 1) sendDay = 1;

    if (!sendDay) continue;

    const bookingUrl = `${appUrl}/book`;
    const subject =
      sendDay === 1
        ? `Quick follow-up — ${c.position} at ${companyName}`
        : sendDay === 3
          ? `Re: ${c.position} — still interested?`
          : `Last chance — ${c.position} opportunity`;
    const body =
      sendDay === 1
        ? `Hi ${c.name},\n\nI wanted to follow up on my previous message about the ${c.position} position. We'd love to hear from you.\n\nIf you're still interested, you can pick a time that works for you here: ${bookingUrl}\n\nBest,\n${companyName}`
        : sendDay === 3
          ? `Hi ${c.name},\n\nI haven't heard back yet about the ${c.position} role. If you're still interested, please book a time here: ${bookingUrl}\n\nIf your situation has changed, no problem — just let us know.\n\nBest,\n${companyName}`
          : `Hi ${c.name},\n\nThis is a final follow-up about the ${c.position} position. We'll be moving forward with other candidates soon. If you'd like to interview, please book here: ${bookingUrl}\n\nBest,\n${companyName}`;

    const result = await sendEmail(c.email, subject, body);
    if (result.success) {
      await prisma.event.create({
        data: {
          type: followUpType,
          candidateId: c.id,
          channel: "email",
          metadata: JSON.stringify({ day: sendDay }),
        },
      });
      console.log(`[Cron] Sent Day ${sendDay} follow-up to ${c.email}`);
    }
  }
}
