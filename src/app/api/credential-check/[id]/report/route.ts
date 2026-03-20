import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import {
  captureNursysScreenshots,
  captureFloridaDOHScreenshots,
  type VerificationScreenshot,
} from "@/lib/browser-verify";
import { buildReportHTML, type AllScreenshots, type ReportCheckData } from "@/lib/report-html";
import puppeteer from "puppeteer";

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

  const { firstName, middleName, lastName, licenseNumber, licenseState, roleType } = check;

  // ── 1. Take live browser screenshots ─────────────────────────────────
  console.log(`[report] Starting browser verification for ${firstName} ${lastName} (${roleType})`);

  let nursysScreenshots: VerificationScreenshot[] = [];
  let floridaDohScreenshots: VerificationScreenshot[] = [];
  let floridaDohData = check.floridaDohData as ReportCheckData["floridaDohData"] & { screenshots?: { label: string; dataUrl: string }[] };

  if (roleType === "NURSE") {
    nursysScreenshots = await captureNursysScreenshots(
      firstName, lastName, licenseState, licenseNumber
    );
    console.log(`[report] Nursys screenshots: ${nursysScreenshots.length}`);
  } else {
    // CNA: check if verify step already stored screenshots — if so, reuse them (no extra browser)
    const storedShots = floridaDohData?.screenshots;
    if (storedShots && storedShots.length > 0) {
      console.log(`[report] Using ${storedShots.length} stored FL DOH screenshots from verify step`);
      floridaDohScreenshots = storedShots.map((s) => ({ label: s.label, url: "", dataUrl: s.dataUrl }));
    } else {
      // Fallback: run Puppeteer if no screenshots stored
      const dohResult = await captureFloridaDOHScreenshots(firstName, lastName, licenseNumber);
      floridaDohScreenshots = dohResult.screenshots;
      console.log(`[report] Florida DOH screenshots: ${floridaDohScreenshots.length}`);
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

  // ── 3. Render HTML → PDF with headless Puppeteer ─────────────────────
  console.log(`[report] Generating PDF for ${firstName} ${lastName}`);

  const browser = await puppeteer.launch({
    headless: true, // always headless for PDF generation
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });

    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "12mm", left: "0", right: "0" },
    });

    const pdfBuffer = Buffer.from(pdfUint8);
    const name = `${lastName}_${firstName}`;
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CredentialReport_${name}_${date}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } finally {
    await browser.close();
  }
}
