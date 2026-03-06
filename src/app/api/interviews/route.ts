import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/sendgrid";
import { format } from "date-fns";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: { candidate: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Delete from Google Calendar if linked
    if (interview.calendarEventId) {
      await deleteCalendarEvent(interview.calendarEventId).catch(() => {});
    }

    // Notify candidate about cancellation
    const dateStr = format(
      new Date(interview.scheduledAt),
      "EEEE, MMMM d, yyyy 'at' h:mm a"
    );
    const companyName = process.env.COMPANY_NAME || "CaresLink Team";

    await sendEmail(
      interview.candidate.email,
      `Interview Update — Your ${interview.position} Interview Has Been Rescheduled`,
      `Hi ${interview.candidate.name},\n\nWe're writing to let you know that your interview for the ${interview.position} position originally scheduled for ${dateStr} EST has been cancelled.\n\nPlease don't worry — this is not a reflection of your candidacy. A member of ${companyName} will reach out to you shortly to arrange a new time that works for both of us.\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nBest regards,\n${companyName}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
        <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #fff; font-size: 18px;">Interview Update</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Hi ${interview.candidate.name},</p>
          <p style="margin: 0 0 16px;">We're writing to let you know that your interview for the <strong>${interview.position}</strong> position originally scheduled for:</p>
          <div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>${dateStr} EST</strong>
          </div>
          <p style="margin: 0 0 16px;">has been cancelled.</p>
          <p style="margin: 0 0 16px;">Please don't worry — <strong>this is not a reflection of your candidacy</strong>. A member of ${companyName} will reach out to you shortly to arrange a new time that works for both of us.</p>
          <p style="margin: 0 0 4px;">We apologize for any inconvenience and appreciate your understanding.</p>
          <p style="margin: 24px 0 0; color: #5a6b7c;">Best regards,<br/>${companyName}</p>
        </div>
      </div>`
    ).catch((err) => console.error("Failed to send cancellation email:", err));

    // Delete related events first, then the interview
    await prisma.event.deleteMany({ where: { interviewId: id } });
    await prisma.interview.delete({ where: { id } });

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
    const activeRemaining = await prisma.interview.count({
      where: {
        candidateId: interview.candidateId,
        completed: false,
        noShow: false,
        cancelled: false,
        scheduledAt: { gte: new Date() },
      },
    });
    if (activeRemaining === 0) {
      await prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: "contacted" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") !== "false";

    const interviews = await prisma.interview.findMany({
      where: upcoming ? { completed: false, noShow: false, cancelled: false, scheduledAt: { gte: new Date() } } : undefined,
      orderBy: { scheduledAt: "asc" },
      include: { candidate: true },
    });
    return NextResponse.json(interviews);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch interviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, scheduledAt, duration = 60, location = "Video Call" } = body;
    if (!candidateId || !scheduledAt) {
      return NextResponse.json(
        { error: "candidateId and scheduledAt are required" },
        { status: 400 }
      );
    }

    const { scheduleInterview } = await import("@/lib/scheduling");
    const interview = await scheduleInterview(
      candidateId,
      new Date(scheduledAt),
      duration,
      location
    );
    return NextResponse.json(interview);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to schedule interview" }, { status: 500 });
  }
}
