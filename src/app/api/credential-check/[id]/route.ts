import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/credential-check/[id]
export async function GET(
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

  // Strip the large base64 PDF from nursysData to keep the response small.
  // The PDF is served separately via /api/credential-check/[id]/nursys-pdf.
  // Replace with a boolean flag so the UI knows a PDF is available.
  const result = { ...check } as Record<string, unknown>;
  if (result.nursysData && typeof result.nursysData === "object") {
    const nd = { ...(result.nursysData as Record<string, unknown>) };
    if (nd.reportPdfBase64) {
      nd.reportPdfBase64 = "__available__"; // flag for UI — actual PDF served via dedicated endpoint
    }
    // Also strip screenshot base64 data URLs from the list response (they're huge)
    if (Array.isArray(nd.screenshots)) {
      nd.screenshots = (nd.screenshots as { label: string; dataUrl: string }[]).map((s) => ({
        label: s.label,
        dataUrl: s.dataUrl.slice(0, 60) + "...", // truncate for listing
      }));
    }
    result.nursysData = nd;
  }

  return NextResponse.json(result);
}

// DELETE /api/credential-check/[id]
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

  await prisma.credentialCheck.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
