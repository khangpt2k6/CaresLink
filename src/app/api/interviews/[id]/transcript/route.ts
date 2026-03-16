import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/interviews/[id]/transcript — fetch all transcript segments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const transcripts = await prisma.interviewTranscript.findMany({
    where: { interviewId: id },
    orderBy: { timestampMs: "asc" },
  });

  return NextResponse.json(transcripts);
}
