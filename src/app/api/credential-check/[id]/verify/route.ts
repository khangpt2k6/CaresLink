import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { runCredentialVerification } from "@/lib/credential-verify";
import { getCredentialVerifyQueue } from "@/lib/queue";

export const maxDuration = 120; // Puppeteer for CNA needs extra time

// POST /api/credential-check/[id]/verify — run all verifications
export async function POST(
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

  // Mark as in progress
  await prisma.credentialCheck.update({
    where: { id },
    data: { status: "IN_PROGRESS", errorMessage: null },
  });

  const asyncMode = process.env.CREDENTIAL_VERIFY_ASYNC === "1";
  if (asyncMode) {
    try {
      const queue = getCredentialVerifyQueue();
      await queue.add(
        "verify-credential",
        { checkId: id, employerId: auth.user.id },
        { jobId: `credential-verify-${id}` }
      );
      const queued = await prisma.credentialCheck.findUnique({ where: { id } });
      return NextResponse.json(
        {
          ...queued,
          queued: true,
          message: "Verification queued to desktop worker.",
        },
        { status: 202 }
      );
    } catch (err) {
      console.error("[verify] Queue enqueue failed, falling back to inline verify:", err);
    }
  }

  try {
    const updated = await runCredentialVerification(id, auth.user.id);
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Verification error:", err);
    await prisma.credentialCheck.update({
      where: { id },
      data: { status: "FAILED", errorMessage: msg },
    });
    return NextResponse.json({ error: "Verification failed", details: msg }, { status: 500 });
  }
}
