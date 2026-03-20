import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { searchNursysRN } from "@/lib/nursys";
import { checkOIGExclusion } from "@/lib/oig-exclusion";
import { checkSAMGov } from "@/lib/sam-gov";
import { captureFloridaDOHScreenshots } from "@/lib/browser-verify";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export const maxDuration = 120; // Puppeteer for CNA needs extra time

// POST /api/credential-check/[id]/verify — run all verifications + AI analysis
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

  try {
    const { firstName, middleName, lastName, licenseNumber, licenseState, roleType } = check;

    // ── TEMPORARY: Florida DOH only mode for CNA testing ──────────────────
    // OIG and SAM.gov are disabled for CNA until Florida DOH is fully verified.
    // Re-enable by restoring the parallel Promise.all block below.
    // ─────────────────────────────────────────────────────────────────────

    let nursysData = null;
    let floridaDohData = null;
    let oigResult = null;
    let samGovResult = null;

    if (roleType === "NURSE") {
      // RNs: run all three checks in parallel (unchanged)
      const [oig, sam, nursys] = await Promise.all([
        checkOIGExclusion(firstName, lastName, middleName ?? undefined),
        checkSAMGov(firstName, lastName, licenseNumber ?? undefined, licenseState ?? undefined),
        searchNursysRN(
          firstName, lastName,
          middleName ?? undefined,
          licenseNumber ?? undefined,
          licenseState ?? undefined
        ),
      ]);
      oigResult = oig;
      samGovResult = sam;
      nursysData = nursys;
    } else {
      // CNAs: use Puppeteer for accurate FL DOH verification + screenshot capture
      const dohResult = await captureFloridaDOHScreenshots(firstName, lastName, licenseNumber ?? undefined);
      floridaDohData = {
        status: dohResult.found ? "found" : "not_found",
        searchedName: `${firstName} ${lastName}`.toUpperCase(),
        licenseType: "Certified Nursing Assistant",
        matches: dohResult.matches.map((m) => ({
          name: m.name,
          licenseNumber: m.licenseNumber,
          licenseType: m.licenseType || "Certified Nursing Assistant",
          status: m.status,
          expirationDate: m.expirationDate,
          county: m.county || undefined,
        })),
        manualUrl: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders",
        checkedAt: new Date().toISOString(),
        // Store screenshots so the UI can display them without re-running Puppeteer
        screenshots: dohResult.screenshots.map((s) => ({ label: s.label, dataUrl: s.dataUrl })),
      };
    }

    // AI analysis
    const { aiRecommendation, aiSummary } = await analyzeWithAI({
      firstName,
      lastName,
      roleType,
      nursysData,
      floridaDohData,
      oigResult,
      samGovResult,
    });

    const updated = await prisma.credentialCheck.update({
      where: { id },
      data: {
        status: "COMPLETED",
        nursysData: nursysData ? (nursysData as unknown as Prisma.InputJsonValue) : roleType === "CNA" ? Prisma.JsonNull : undefined,
        floridaDohData: floridaDohData ? (floridaDohData as unknown as Prisma.InputJsonValue) : undefined,
        oigData: oigResult ? (oigResult as unknown as Prisma.InputJsonValue) : roleType === "CNA" ? Prisma.JsonNull : undefined,
        samGovData: samGovResult ? (samGovResult as unknown as Prisma.InputJsonValue) : roleType === "CNA" ? Prisma.JsonNull : undefined,
        aiRecommendation,
        aiSummary,
      },
    });

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

async function analyzeWithAI({
  firstName,
  lastName,
  roleType,
  nursysData,
  floridaDohData,
  oigResult,
  samGovResult,
}: {
  firstName: string;
  lastName: string;
  roleType: string;
  nursysData: unknown;
  floridaDohData: unknown;
  oigResult: unknown;
  samGovResult: unknown;
}): Promise<{ aiRecommendation: string; aiSummary: string }> {
  try {
    const isCNA = roleType === "CNA";
    const prompt = `You are a healthcare compliance analyst. Analyze the following credential verification results for ${firstName} ${lastName} (Role: ${roleType}) and provide:
1. An employability recommendation: "EMPLOYABLE", "REVIEW_REQUIRED", or "NOT_EMPLOYABLE"
2. A concise 2-3 sentence summary explaining the recommendation

Verification Results:
${!isCNA && nursysData ? `Nursys License Verification: ${JSON.stringify(nursysData, null, 2)}` : ""}
${isCNA && floridaDohData ? `Florida DOH CNA License Verification: ${JSON.stringify(floridaDohData, null, 2)}` : ""}
${!isCNA && oigResult ? `OIG Exclusion List: ${JSON.stringify(oigResult, null, 2)}` : ""}
${!isCNA && samGovResult ? `SAM.gov: ${JSON.stringify(samGovResult, null, 2)}` : ""}

Rules for CNA:
- EMPLOYABLE if: Florida DOH license status is "Clear/Active" or "Active" (not expired)
- REVIEW_REQUIRED if: license not found, expired, has restrictions, probation, or is unclear
- NOT_EMPLOYABLE if: license is revoked, suspended, or surrendered
- Do NOT mention OIG or SAM.gov — they are not checked for CNAs

Rules for NURSE:
- NOT_EMPLOYABLE if: OIG status is "excluded", or license is revoked/suspended/surrendered
- REVIEW_REQUIRED if: license is expired, probation, restriction, or manual verification needed
- EMPLOYABLE if: license is active/unencumbered AND OIG clear AND SAM clear

Respond in JSON format: {"recommendation": "EMPLOYABLE|REVIEW_REQUIRED|NOT_EMPLOYABLE", "summary": "..."}`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        aiRecommendation: parsed.recommendation || "REVIEW_REQUIRED",
        aiSummary: parsed.summary || "",
      };
    }
  } catch (err) {
    console.error("AI analysis error:", err);
  }

  return { aiRecommendation: "REVIEW_REQUIRED", aiSummary: "Automated AI analysis unavailable. Please review verification results manually." };
}
