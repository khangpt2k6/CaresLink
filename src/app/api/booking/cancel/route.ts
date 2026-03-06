import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/sendgrid";
import { getTimezone, getTimezoneAbbr, formatInTimezone } from "@/lib/timezone";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interviewId, email } = body;

    if (!interviewId || !email) {
      return NextResponse.json(
        { error: "interviewId and email are required" },
        { status: 400 }
      );
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { candidate: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Verify email matches candidate
    if (interview.candidate.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match" }, { status: 403 });
    }

    if (interview.cancelled) {
      return NextResponse.json({ error: "Interview already cancelled" }, { status: 400 });
    }

    // Delete from Google Calendar
    if (interview.calendarEventId) {
      await deleteCalendarEvent(interview.calendarEventId).catch(() => {});
    }

    // Mark as cancelled
    await prisma.interview.update({
      where: { id: interviewId },
      data: { cancelled: true },
    });

    // Auto-complete any past interviews for this candidate
    await prisma.interview.updateMany({
      where: {
        candidateId: interview.candidateId,
        completed: false,
        cancelled: false,
        noShow: false,
        scheduledAt: { lt: new Date() },
      },
      data: { completed: true },
    });

    // Reset candidate status if no future active interviews remain
    const otherActive = await prisma.interview.count({
      where: {
        candidateId: interview.candidateId,
        completed: false,
        noShow: false,
        cancelled: false,
        scheduledAt: { gte: new Date() },
      },
    });
    if (otherActive === 0) {
      await prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: "contacted" },
      });
    }

    // Log cancellation event
    await prisma.event.create({
      data: {
        type: "interview_cancelled",
        candidateId: interview.candidateId,
        interviewId: interview.id,
        metadata: JSON.stringify({ cancelledBy: "candidate", email }),
      },
    });

    // Notify recruiter
    const recruiterEmail = process.env.RESEND_FROM_EMAIL;
    const tz = await getTimezone();
    const tzAbbr = getTimezoneAbbr(tz);
    const dateStr = formatInTimezone(new Date(interview.scheduledAt), tz, "") + " " + tzAbbr;
    if (recruiterEmail) {
      await sendEmail(
        recruiterEmail,
        `Interview Cancelled — ${interview.candidate.name}`,
        `${interview.candidate.name} (${interview.candidate.email}) has cancelled their interview for the ${interview.position} position.\n\nOriginal time: ${dateStr}\n\nYou may want to follow up or reschedule.`
      ).catch(() => {});
    }

    // Send cancellation confirmation to candidate with reschedule link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const rescheduleUrl = `${appUrl}/book`;
    const companyName = process.env.COMPANY_NAME || "CaresLink Team";

    await sendEmail(
      interview.candidate.email,
      `Interview Cancelled — Reschedule Available`,
      `Hi ${interview.candidate.name},\n\nThis email confirms that your interview for the ${interview.position} position originally scheduled for ${dateStr} has been successfully cancelled.\n\nIf you'd like to reschedule, you can book a new time at your convenience:\n${rescheduleUrl}\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\n${companyName}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
        <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #fff; font-size: 18px;">Interview Cancellation Confirmed</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Hi ${interview.candidate.name},</p>
          <p style="margin: 0 0 16px;">This email confirms that your interview for the <strong>${interview.position}</strong> position originally scheduled for:</p>
          <div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>${dateStr}</strong>
          </div>
          <p style="margin: 0 0 16px;">has been successfully cancelled.</p>
          <p style="margin: 0 0 16px;">If you'd like to reschedule, you can book a new interview time at your convenience:</p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${rescheduleUrl}" style="display: inline-block; background: #0090d9; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Reschedule Interview</a>
          </div>
          <p style="margin: 0 0 4px;">If you have any questions, feel free to reach out.</p>
          <p style="margin: 24px 0 0; color: #5a6b7c;">Best regards,<br/>${companyName}</p>
        </div>
      </div>`
    ).catch((err) => console.error("Failed to send cancellation confirmation email:", err));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to cancel interview" }, { status: 500 });
  }
}
