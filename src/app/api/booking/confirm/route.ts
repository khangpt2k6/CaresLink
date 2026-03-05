import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    if (interview.candidate.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match" }, { status: 403 });
    }

    if (interview.cancelled) {
      return NextResponse.json({ error: "Interview has been cancelled" }, { status: 400 });
    }

    await prisma.interview.update({
      where: { id: interviewId },
      data: { confirmed: true },
    });

    await prisma.event.create({
      data: {
        type: "interview_confirmed",
        candidateId: interview.candidateId,
        interviewId: interview.id,
        metadata: JSON.stringify({ confirmedBy: "candidate", email }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to confirm interview" }, { status: 500 });
  }
}
