import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent as deleteGoogleEvent } from "@/lib/google-calendar";
import { deleteCalendarEvent as deleteMicrosoftEvent } from "@/lib/microsoft-calendar";
import { sendEmail } from "@/lib/sendgrid";
import { getTimezone, getTimezoneAbbr, formatInTimezone } from "@/lib/timezone";

export async function DELETE(request: NextRequest) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

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

    // Delete from connected calendars if linked
    if (interview.calendarEventId) {
      await Promise.all([
        deleteGoogleEvent(interview.calendarEventId).catch(() => {}),
        deleteMicrosoftEvent(interview.calendarEventId).catch(() => {}),
      ]);
    }

    // Notify candidate about cancellation
    const tz = await getTimezone();
    const tzAbbr = getTimezoneAbbr(tz);
    const dateStr = formatInTimezone(new Date(interview.scheduledAt), tz, "") + " " + tzAbbr;
    const companyName = process.env.COMPANY_NAME || "CaresLink Team";

    await sendEmail(
      interview.candidate.email,
      `Interview Update — Your ${interview.position} Interview Has Been Rescheduled`,
      `Hi ${interview.candidate.name},\n\nWe're writing to let you know that your interview for the ${interview.position} position originally scheduled for ${dateStr} has been cancelled.\n\nPlease don't worry — this is not a reflection of your candidacy. A member of ${companyName} will reach out to you shortly to arrange a new time that works for both of us.\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nBest regards,\n${companyName}`,
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
        <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #fff; font-size: 18px;">Interview Update</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Hi ${interview.candidate.name},</p>
          <p style="margin: 0 0 16px;">We're writing to let you know that your interview for the <strong>${interview.position}</strong> position originally scheduled for:</p>
          <div style="background: #f5f7fa; padding: 12px 16px; border-radius: 6px; margin: 0 0 16px; border-left: 3px solid #0090d9;">
            <strong>${dateStr}</strong>
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
  const result = await requireUser(request);
  if ("error" in result) return result.error;
  const { user } = result;

  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") !== "false";
    const past = searchParams.get("past") === "true";
    const completed = searchParams.get("completed") === "true";
    const pastDays = Math.min(30, Math.max(1, parseInt(searchParams.get("days") || "7", 10)));

    let baseWhere: Record<string, unknown> = {};
    if (completed && user.role === "EMPLOYER") {
      // Show completed interviews (last 30 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      baseWhere = {
        completed: true,
        scheduledAt: { gte: cutoff },
      };
    } else if (past && user.role === "EMPLOYER") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - pastDays);
      baseWhere = {
        completed: false,
        cancelled: false,
        scheduledAt: { gte: cutoff, lt: new Date() },
      };
    } else if (upcoming) {
      baseWhere = {
        completed: false,
        noShow: false,
        cancelled: false,
        scheduledAt: { gte: new Date() },
      };
    }

    // Candidates only see their own interviews (matched by email)
    const where =
      user.role === "CANDIDATE" && user.email
        ? { ...baseWhere, candidate: { email: { equals: String(user.email), mode: "insensitive" } } }
        : baseWhere;

    const interviews = await prisma.interview.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { scheduledAt: (past || completed) ? "desc" : "asc" },
      include: { candidate: true },
    });
    return NextResponse.json(interviews);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch interviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const { candidateId, scheduledAt, duration = 60, location = "Video Call" } = body;
    if (!candidateId || !scheduledAt) {
      return NextResponse.json(
        { error: "candidateId and scheduledAt are required" },
        { status: 400 }
      );
    }

    const existingInterview = await prisma.interview.findFirst({
      where: {
        candidateId,
        cancelled: false,
        completed: false,
        noShow: false,
        scheduledAt: { gt: new Date() },
      },
    });
    if (existingInterview) {
      return NextResponse.json(
        { error: `This candidate already has an upcoming interview scheduled for ${existingInterview.scheduledAt.toLocaleString()}. Please cancel it first before scheduling a new one.` },
        { status: 409 }
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
