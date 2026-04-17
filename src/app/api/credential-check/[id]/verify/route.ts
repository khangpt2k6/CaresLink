import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { runCredentialVerification } from "@/lib/credential-verify";
import { getCredentialVerifyQueue } from "@/lib/queue";

export const maxDuration = 120; // Puppeteer for CNA needs extra time

/**
 * Queue to Redis only when async is wanted AND we are not in local `next dev`.
 * Otherwise verify runs inside this process so Playwright can open a browser on your machine.
 * Set CREDENTIAL_VERIFY_ASYNC_IN_DEV=1 to queue during development (requires worker).
 */
function useAsyncCredentialVerify(): boolean {
  if (process.env.CREDENTIAL_VERIFY_ASYNC !== "1") return false;
  if (process.env.CREDENTIAL_VERIFY_ASYNC_IN_DEV === "1") return true;
  if (process.env.VERCEL === "1") return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

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

  const asyncMode = useAsyncCredentialVerify();
  if (process.env.CREDENTIAL_VERIFY_ASYNC === "1" && !asyncMode) {
    console.log(
      "[verify] CREDENTIAL_VERIFY_ASYNC=1 ignored in development — running inline so Playwright can open a browser. " +
        "Set CREDENTIAL_VERIFY_ASYNC_IN_DEV=1 to queue to the worker instead."
    );
  }
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
