import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/sendgrid";

export async function POST(req: NextRequest) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  const { candidateId, type } = await req.json();

  if (!candidateId || !["rejection", "follow_up"].includes(type)) {
    return NextResponse.json({ error: "candidateId and type (rejection|follow_up) required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  let subject: string;
  let text: string;
  let html: string;

  if (type === "rejection") {
    subject = `Update on Your ${candidate.position} Application — CaresLink`;
    text = `Dear ${candidate.name},\n\nThank you for taking the time to interview with us for the ${candidate.position} position. We truly appreciate your interest in CaresLink and the effort you put into the process.\n\nAfter careful consideration, we've decided to move forward with other candidates whose qualifications more closely align with the current needs of this role.\n\nThis was not an easy decision, and we want you to know that your skills and experience are valued. We encourage you to apply for future opportunities with us as new roles become available.\n\nWe wish you all the best in your career journey.\n\nWarm regards,\nCaresLink Recruiting Team`;
    html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
      <div style="background: #1a2b3c; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">CaresLink</h1>
      </div>
      <div style="padding: 32px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;">Dear <strong>${candidate.name}</strong>,</p>
        <p style="margin: 0 0 16px;">Thank you for taking the time to interview with us for the <strong>${candidate.position}</strong> position. We truly appreciate your interest in CaresLink and the effort you put into the process.</p>
        <p style="margin: 0 0 16px;">After careful consideration, we've decided to move forward with other candidates whose qualifications more closely align with the current needs of this role.</p>
        <p style="margin: 0 0 16px;">This was not an easy decision, and we want you to know that your skills and experience are valued. We encourage you to apply for future opportunities with us as new roles become available.</p>
        <p style="margin: 0 0 16px;">We wish you all the best in your career journey.</p>
        <p style="margin: 0; color: #6b7280;">Warm regards,<br/><strong>CaresLink Recruiting Team</strong></p>
      </div>
    </div>`;
  } else {
    const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/book?email=${encodeURIComponent(candidate.email)}`;
    subject = `We'd Love to Reconnect — ${candidate.position} at CaresLink`;
    text = `Hi ${candidate.name},\n\nWe noticed we weren't able to connect during your scheduled interview for the ${candidate.position} position. No worries at all — we understand things come up!\n\nWe're still very interested in speaking with you and would love to find a time that works better. You can book a new interview slot at your convenience:\n${bookingUrl}\n\nIf you have any questions or need to discuss anything before scheduling, feel free to reply to this email.\n\nLooking forward to hearing from you!\n\nBest regards,\nCaresLink Recruiting Team`;
    html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
      <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">CaresLink</h1>
      </div>
      <div style="padding: 32px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;">Hi <strong>${candidate.name}</strong>,</p>
        <p style="margin: 0 0 16px;">We noticed we weren't able to connect during your scheduled interview for the <strong>${candidate.position}</strong> position. No worries at all — we understand things come up!</p>
        <p style="margin: 0 0 16px;">We're still very interested in speaking with you and would love to find a time that works better.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${bookingUrl}" style="display: inline-block; background: #0090d9; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Book a New Interview</a>
        </div>
        <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">If you have any questions or need to discuss anything before scheduling, feel free to reply to this email.</p>
        <p style="margin: 0;">Looking forward to hearing from you!</p>
        <p style="margin: 16px 0 0; color: #6b7280;">Best regards,<br/><strong>CaresLink Recruiting Team</strong></p>
      </div>
    </div>`;
  }

  const result = await sendEmail(candidate.email, subject, text, html);

  if (result.success) {
    await prisma.event.create({
      data: {
        type: "email_sent",
        candidateId: candidate.id,
        channel: "email",
        cost: 0.02,
        metadata: type === "rejection" ? "Rejection email sent" : "Follow-up email sent after no-show",
      },
    });
  }

  return NextResponse.json({ success: result.success, error: result.error });
}
