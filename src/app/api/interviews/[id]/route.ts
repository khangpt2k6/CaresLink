import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if (result.error) return result.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { noShow, completed } = body;

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: { candidate: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }
    if (interview.cancelled) {
      return NextResponse.json({ error: "Interview is cancelled" }, { status: 400 });
    }

    const scheduledDate = new Date(interview.scheduledAt);
    if (scheduledDate > new Date()) {
      return NextResponse.json({ error: "Cannot mark future interviews. Wait until after the scheduled time." }, { status: 400 });
    }

    if (noShow === true) {
      await prisma.interview.update({
        where: { id },
        data: { noShow: true, completed: false },
      });
      await prisma.event.create({
        data: {
          type: "interview_no_show",
          candidateId: interview.candidateId,
          interviewId: id,
          channel: "email",
        },
      });
      return NextResponse.json({ success: true, noShow: true });
    }

    if (completed === true) {
      await prisma.interview.update({
        where: { id },
        data: { completed: true },
      });
      return NextResponse.json({ success: true, completed: true });
    }

    return NextResponse.json({ error: "Provide noShow or completed" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const email = new URL(request.url).searchParams.get("email");

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // If email provided, verify it matches (for public cancel page)
    if (email && interview.candidate.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match" }, { status: 403 });
    }

    if (interview.cancelled) {
      return NextResponse.json({ error: "Interview already cancelled" }, { status: 400 });
    }

    return NextResponse.json({
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      duration: interview.duration,
      position: interview.position,
      candidate: {
        name: interview.candidate.name,
        email: interview.candidate.email,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch interview" }, { status: 500 });
  }
}
