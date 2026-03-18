import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { computeAndStoreMatches } from "@/lib/matching-service";

// GET /api/matching/[jobId] — read pre-computed matches (instant)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const matches = await prisma.jobMatch.findMany({
    where: { jobId },
    include: {
      candidate: true,
    },
    orderBy: { score: "desc" },
  });

  // Find when this job's matches were last computed
  const lastComputed = matches.length > 0 ? matches[0].computedAt : null;

  return NextResponse.json({
    jobId: job.id,
    jobTitle: job.title,
    jobDepartment: job.department,
    lastComputed,
    total: matches.length,
    matches: matches.map((m) => ({
      id: m.id,
      candidateId: m.candidateId,
      candidateName: m.candidate.name,
      candidateEmail: m.candidate.email,
      candidatePhone: m.candidate.phone,
      candidatePosition: m.candidate.position,
      candidateStatus: m.candidate.status,
      score: m.score,
      label: m.label,
      reason: m.reason,
      computedAt: m.computedAt,
    })),
  });
}

// POST /api/matching/[jobId] — trigger re-computation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await params;

  try {
    const stored = await computeAndStoreMatches(jobId);

    return NextResponse.json({
      jobId,
      total: stored.length,
      matches: stored.map((m) => ({
        id: m.id,
        candidateId: m.candidateId,
        candidateName: m.candidate.name,
        candidateEmail: m.candidate.email,
        candidatePhone: m.candidate.phone,
        candidatePosition: m.candidate.position,
        candidateStatus: m.candidate.status,
        score: m.score,
        label: m.label,
        reason: m.reason,
        computedAt: m.computedAt,
      })),
    });
  } catch (e) {
    console.error("Match computation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to compute matches" },
      { status: 500 }
    );
  }
}
