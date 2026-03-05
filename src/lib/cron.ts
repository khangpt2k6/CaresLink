import cron from "node-cron";
import { prisma } from "./db";
import { sendEmail } from "./sendgrid";
import { format, addHours } from "date-fns";

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

  console.log("[Cron] Auto-reminder scheduler started (runs every 30 min)");
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

    const dateStr = format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a");
    const confirmUrl = `${appUrl}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const cancelUrl = `${appUrl}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const meetPart = interview.meetLink ? `\nJoin video call: ${interview.meetLink}` : "";

    // 24h email reminder (only if not already sent)
    if (is24hWindow && !interview.reminderSent) {
      const result = await sendEmail(
        candidate.email,
        `Reminder: Your Interview is Tomorrow — ${interview.position}`,
        `Dear ${candidate.name},\n\nThis is a reminder that your interview for the ${interview.position} position is scheduled for tomorrow.\n\n📅 ${dateStr} EST${meetPart}\n\nPlease confirm your attendance:\n${confirmUrl}\n\nNeed to cancel or reschedule?\n${cancelUrl}\n\nThank you,\nCaresLink Recruiting`
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
        `Dear ${candidate.name},\n\nYour interview for the ${interview.position} position starts in 1 hour.\n\n📅 ${dateStr} EST${meetPart}\n\n${interview.meetLink ? "Join the video call when ready:\n" + interview.meetLink : ""}\n\nGood luck!\n\nCaresLink Recruiting`
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
    const dateStr = format(new Date(interview.scheduledAt), "EEEE, MMMM d 'at' h:mm a");
    const confirmUrl = `${appUrl}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;
    const cancelUrl = `${appUrl}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidate.email)}`;

    await sendEmail(
      candidate.email,
      `Please Confirm Your Interview — ${interview.position}`,
      `Dear ${candidate.name},\n\nWe noticed you haven't confirmed your upcoming interview yet.\n\n📅 ${dateStr} EST for the ${interview.position} position.\n\nPlease let us know:\n✅ Confirm attendance: ${confirmUrl}\n❌ Cancel or reschedule: ${cancelUrl}\n\nThank you,\nCaresLink Recruiting`
    ).catch(() => {});
  }
}
