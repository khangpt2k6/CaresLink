import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/credential-check/[id]/nursys-pdf — serve the downloaded Nursys PDF report
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

  const nursysData = check.nursysData as Record<string, unknown> | null;
  const pdfBase64 = nursysData?.reportPdfBase64 as string | undefined;

  if (!pdfBase64) {
    return NextResponse.json(
      { error: "No Nursys PDF report available. Run verification first." },
      { status: 404 }
    );
  }

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  const name = `${check.lastName}_${check.firstName}`;
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="NursysReport_${name}_${date}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
