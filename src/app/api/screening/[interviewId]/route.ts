import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/screening/[interviewId] — get screening state (public, verified by email)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  const { interviewId } = await params;
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { candidate: true, screening: true },
  });

  if (!interview || interview.candidate.email !== email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create screening if it doesn't exist
  let screening = interview.screening;
  if (!screening) {
    screening = await prisma.screening.create({
      data: { interviewId, status: "pending", messages: [] },
    });
  }

  return NextResponse.json({
    screening: {
      id: screening.id,
      status: screening.status,
      messages: screening.messages,
      completedAt: screening.completedAt,
    },
    candidate: {
      name: interview.candidate.name,
      position: interview.position,
    },
  });
}
