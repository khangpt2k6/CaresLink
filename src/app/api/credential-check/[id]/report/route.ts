import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import {
  captureNursysScreenshots,
  captureCnaStateRegistryScreenshots,
  type VerificationScreenshot,
} from "@/lib/browser-verify";
import { buildReportHTML, type AllScreenshots, type ReportCheckData } from "@/lib/report-html";
import { chromium } from "playwright";

export const maxDuration = 300; // 5 minutes — browser automation takes time

// GET /api/credential-check/[id]/report
// Launches visible browsers, takes screenshots, and returns a PDF report.
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

  if (check.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Run verification first before generating the report." },
      { status: 400 }
    );
  }

  const { firstName, middleName, lastName, licenseNumber, licenseState, roleType, targetState } = check;

  // ── 1. Take live browser screenshots ─────────────────────────────────
  console.log(`[report] Starting browser verification for ${firstName} ${lastName} (${roleType})`);

  let nursysScreenshots: VerificationScreenshot[] = [];
  let floridaDohScreenshots: VerificationScreenshot[] = [];
  let floridaDohData = check.floridaDohData as unknown as ReportCheckData["floridaDohData"] & { screenshots?: { label: string; dataUrl: string }[] };

  if (roleType === "NURSE") {
    // Reuse stored screenshots from verify step if available
    const nursysStored = check.nursysData as unknown as { screenshots?: { label: string; dataUrl: string }[] };
    if (nursysStored?.screenshots && nursysStored.screenshots.length > 0) {
      console.log(`[report] Using ${nursysStored.screenshots.length} stored Nursys screenshots from verify step`);
      nursysScreenshots = nursysStored.screenshots.map((s) => ({ label: s.label, url: "", dataUrl: s.dataUrl }));
    } else {
      // Fallback: run browser verification again
      const nursysResult = await captureNursysScreenshots(
        firstName, lastName, licenseState, licenseNumber
      );
      nursysScreenshots = nursysResult.screenshots;
    }
    console.log(`[report] Nursys screenshots: ${nursysScreenshots.length}`);
  } else {
    // CNA: check if verify step already stored screenshots — if so, reuse them (no extra browser)
    const storedShots = floridaDohData?.screenshots;
    if (storedShots && storedShots.length > 0) {
      console.log(`[report] Using ${storedShots.length} stored CNA registry screenshots from verify step`);
      floridaDohScreenshots = storedShots.map((s) => ({ label: s.label, url: "", dataUrl: s.dataUrl }));
    } else {
      const dohResult = await captureCnaStateRegistryScreenshots(
        firstName,
        lastName,
        licenseNumber,
        licenseState,
        targetState
      );
      floridaDohScreenshots = dohResult.screenshots;
      console.log(`[report] CNA registry screenshots: ${floridaDohScreenshots.length}`);
    }
  }

  const screenshots: AllScreenshots = {
    nursys: nursysScreenshots,
    floridaDoh: floridaDohScreenshots,
    oig: [],
    samGov: [],
  };

  // ── 2. Build HTML report ──────────────────────────────────────────────
  const reportData: ReportCheckData = {
    firstName,
    middleName,
    lastName,
    email: check.email,
    phone: check.phone,
    address: check.address,
    licenseNumber,
    licenseState,
    roleType,
    targetState: check.targetState,
    aiRecommendation: check.aiRecommendation,
    aiSummary: check.aiSummary,
    nursysData: check.nursysData as ReportCheckData["nursysData"],
    floridaDohData,
    oigData: check.oigData as ReportCheckData["oigData"],
    samGovData: check.samGovData as ReportCheckData["samGovData"],
    updatedAt: check.updatedAt.toISOString(),
  };

  const html = buildReportHTML(reportData, screenshots);

  // ── 3. Render HTML → PDF with headless Playwright ────────────────────
  console.log(`[report] Generating PDF for ${firstName} ${lastName}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "12mm", left: "0", right: "0" },
    });
    const name = `${lastName}_${firstName}`;
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CredentialReport_${name}_${date}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } finally {
    await browser.close();
  }
}
