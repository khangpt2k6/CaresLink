import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const interview = await prisma.interview.findUnique({ where: { id } });
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Delete from Google Calendar if linked
    if (interview.calendarEventId) {
      await deleteCalendarEvent(interview.calendarEventId);
    }

    // Delete related events first, then the interview
    await prisma.event.deleteMany({ where: { interviewId: id } });
    await prisma.interview.delete({ where: { id } });

    // Reset candidate status if no other interviews
    const remaining = await prisma.interview.count({
      where: { candidateId: interview.candidateId },
    });
    if (remaining === 0) {
      await prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: "applied" },
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
      where: upcoming ? { completed: false, noShow: false, scheduledAt: { gte: new Date() } } : undefined,
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
