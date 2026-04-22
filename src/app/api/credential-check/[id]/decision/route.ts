import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// POST /api/credential-check/[id]/decision
// Body: { decision: "approved" | "rejected", note?: string }
// Records the recruiter's manual review decision. Stored under
// `source_results.recruiterDecision` so we don't need a schema migration.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;

  const row = await prisma.credential_checks.findUnique({ where: { id } });
  if (!row || row.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { decision?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const decision = String(body.decision ?? "");
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: 'decision must be "approved" or "rejected"' },
      { status: 400 }
    );
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const existing =
    (row.source_results as Record<string, unknown> | null) ?? {};
  const merged: Record<string, unknown> = {
    ...existing,
    recruiterDecision: {
      decision,
      note: note || null,
      decidedAt: new Date().toISOString(),
      decidedByUserId: auth.user.id,
    },
  };

  // `status` is CHECK-constrained to ('pending','completed','error'), so the
  // recruiter decision lives in source_results.recruiterDecision and is
  // mirrored to ai_recommendation for list-view filtering. We also normalize
  // status → 'completed' to scrub legacy rows that earlier code wrote
  // 'approved'/'rejected' into (any UPDATE on such a row otherwise re-fails
  // the CHECK against the existing bad value).
  const updated = await prisma.credential_checks.update({
    where: { id },
    data: {
      source_results: merged as object,
      status: "completed",
      ai_recommendation:
        decision === "approved" ? "employable" : "not_employable",
    },
  });

  return NextResponse.json(updated);
}
