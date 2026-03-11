import { prisma } from "./db";
import { sendEmail } from "./sendgrid";

export type SendBookingLinkResult =
  | { success: true; booking_url: string }
  | { success: false; error: string; already_scheduled?: boolean; scheduled_at?: string };

/** Send booking link email to a candidate. No AI. Uses template with candidate data. */
export async function sendBookingLinkToCandidate(candidateId: string): Promise<SendBookingLinkResult> {
  const c = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!c) return { success: false, error: "Candidate not found" };

  const existingInterview = await prisma.interview.findFirst({
    where: {
      candidateId: c.id,
      cancelled: false,
      completed: false,
      noShow: false,
      scheduledAt: { gt: new Date() },
    },
  });
  if (existingInterview) {
    return {
      success: false,
      error: `Candidate already has an interview on ${existingInterview.scheduledAt.toLocaleString()}. Cancel it first to reschedule.`,
      already_scheduled: true,
      scheduled_at: existingInterview.scheduledAt.toISOString(),
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const bookingUrl = `${appUrl}/book?email=${encodeURIComponent(c.email)}`;
  const greeting = `Your job application for the ${c.position} position at CaresLink has been shortlisted by our recruiting team.`;

  const result = await sendEmail(
    c.email,
    `You've Been Shortlisted — ${c.position} at CaresLink`,
    `Hello ${c.name},\n\n${greeting}\n\nTo move forward, please book your interview at a time that works best for you:\n${bookingUrl}\n\nWe're excited to learn more about you and look forward to connecting soon.\n\nBest regards,\nCaresLink Recruiting Team`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
      <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #fff; font-size: 18px;">You've Been Shortlisted!</h2>
      </div>
      <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;">Hello ${c.name},</p>
        <p style="margin: 0 0 16px;">${greeting}</p>
        <p style="margin: 0 0 16px;">To move forward, please book your interview at a time that works best for you:</p>
        <div style="text-align: center; margin: 0 0 24px;">
          <a href="${bookingUrl}" style="display: inline-block; background: #0090d9; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Book Your Interview</a>
        </div>
        <p style="margin: 0 0 4px;">We're excited to learn more about you and look forward to connecting soon.</p>
        <p style="margin: 24px 0 0; color: #5a6b7c;">Best regards,<br/>CaresLink Recruiting Team</p>
      </div>
    </div>`
  );

  if (!result.success) {
    return { success: false, error: result.error || "Failed to send email" };
  }

  await prisma.event.create({
    data: { type: "booking_link_sent", candidateId: c.id, channel: "email", cost: 0.02 },
  });
  await prisma.candidate.update({
    where: { id: c.id },
    data: { status: c.status === "applied" ? "contacted" : c.status },
  });

  return { success: true, booking_url: bookingUrl };
}
