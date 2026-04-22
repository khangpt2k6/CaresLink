import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { computeAndStoreMatches } from "@/lib/matching-service";

function profileName(p: { first_name: string | null; last_name: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

// GET /api/matching/[jobId] — read pre-computed matches (instant)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await params;

  const job = await prisma.jobs.findUnique({ where: { job_id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const matches = await prisma.job_match_scores.findMany({
    where: { job_id: jobId },
    include: { profile: true },
    orderBy: { score: "desc" },
  });

  const lastComputed = matches.length > 0 ? matches[0].computed_at : null;

  return NextResponse.json({
    jobId: job.job_id,
    jobTitle: job.job_title,
    jobRole: job.role,
    lastComputed,
    total: matches.length,
    matches: matches.map((m) => ({
      id: m.id,
      candidateId: m.profile_id,
      candidateName: profileName(m.profile),
      candidateEmail: m.profile.email,
      candidatePhone: m.profile.phone_number,
      candidateRole: m.profile.role,
      candidateUserType: m.profile.user_type,
      score: m.score,
      label: m.label,
      reason: m.reason,
      computedAt: m.computed_at,
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
    // Shape the response the same way GET does — the raw Prisma rows include
    // BigInt fields (country_id, state_id, ...) that JSON.stringify cannot
    // serialize, and Flutter wants a stable candidate-centric shape anyway.
    return NextResponse.json({
      jobId,
      total: stored.length,
      matches: stored.map((m) => ({
        id: m.id,
        candidateId: m.profile_id,
        candidateName: profileName(m.profile),
        candidateEmail: m.profile.email,
        candidatePhone: m.profile.phone_number,
        candidateRole: m.profile.role,
        candidateUserType: m.profile.user_type,
        score: m.score,
        label: m.label,
        reason: m.reason,
        computedAt: m.computed_at,
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
