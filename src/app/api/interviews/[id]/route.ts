import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
