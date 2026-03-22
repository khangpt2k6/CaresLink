import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// POST /api/credential-check/[id]/review — recruiter approves or rejects
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { decision, note } = body as { decision: "APPROVED" | "REJECTED"; note?: string };

  if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "Decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const check = await prisma.credentialCheck.findFirst({
    where: { id, employerId: auth.user.id, status: "COMPLETED" },
  });

  if (!check) {
    return NextResponse.json({ error: "Not found or not completed" }, { status: 404 });
  }

  const updated = await prisma.credentialCheck.update({
    where: { id },
    data: {
      reviewedAt: new Date(),
      reviewedBy: auth.user.name || auth.user.email || "Recruiter",
      recruiterDecision: decision,
      recruiterNote: note || null,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/credential-check/[id]/review — undo review
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const check = await prisma.credentialCheck.findFirst({
    where: { id, employerId: auth.user.id },
  });

  if (!check) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.credentialCheck.update({
    where: { id },
    data: {
      reviewedAt: null,
      reviewedBy: null,
      recruiterDecision: null,
      recruiterNote: null,
    },
  });

  return NextResponse.json(updated);
}
