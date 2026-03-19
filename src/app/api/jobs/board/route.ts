import { NextRequest, NextResponse } from "next/server";
import { requireCandidate } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// Returns open jobs for the candidate job board (no employer-only data)
export async function GET(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  try {
    const jobs = await prisma.job.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        createdAt: true,
      },
    });

    // Check which jobs this candidate has already applied to
    const applied = await prisma.candidate.findMany({
      where: { email: auth.user.email },
      select: { position: true },
    });
    const appliedPositions = new Set(applied.map(a => a.position.toLowerCase()));

    return NextResponse.json(
      jobs.map(job => ({
        ...job,
        applied: appliedPositions.has(job.title.toLowerCase()),
      }))
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
