import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
