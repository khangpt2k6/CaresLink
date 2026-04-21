import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { computeAndStoreMatches } from "@/lib/matching-service";

// POST /api/jobs/match { jobId } — score all professional candidates against
// the given job and persist the results in job_match_scores.
// (The ranked list is read back via /api/matching/[jobId].)
export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const stored = await computeAndStoreMatches(jobId);

    return NextResponse.json({
      jobId,
      total: stored.length,
      matches: stored.map((m) => ({
        candidateId: m.profile_id,
        candidateName:
          [m.profile.first_name, m.profile.last_name].filter(Boolean).join(" ").trim() || null,
        candidateEmail: m.profile.email,
        score: m.score,
        label: m.label,
        reason: m.reason,
      })),
    });
  } catch (e) {
    console.error("Job matching error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to run job matching" },
      { status: 500 }
    );
  }
}
