import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { searchNursysRN } from "@/lib/nursys";
import { checkOIGExclusion } from "@/lib/oig-exclusion";
import { searchFloridaDOH } from "@/lib/florida-doh";
import { checkSAMGov } from "@/lib/sam-gov";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

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

    // Run all verifications in parallel
    const [oigResult, samGovResult, licenseResult] = await Promise.all([
      checkOIGExclusion(firstName, lastName, middleName ?? undefined),
      checkSAMGov(firstName, lastName, licenseNumber ?? undefined, licenseState ?? undefined),
      roleType === "NURSE"
        ? searchNursysRN(
            firstName,
            lastName,
            middleName ?? undefined,
            licenseNumber ?? undefined,
            licenseState ?? undefined
          )
        : searchFloridaDOH(firstName, lastName, "CNA", licenseNumber ?? undefined),
    ]);

    const nursysData = roleType === "NURSE" ? licenseResult : null;
    const floridaDohData = roleType === "CNA" ? licenseResult : null;

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
        nursysData: nursysData ? (nursysData as object) : undefined,
        floridaDohData: floridaDohData ? (floridaDohData as object) : undefined,
        oigData: oigResult as object,
        samGovData: samGovResult as object,
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
    const prompt = `You are a healthcare compliance analyst. Analyze the following credential verification results for ${firstName} ${lastName} (Role: ${roleType}) and provide:
1. An employability recommendation: "EMPLOYABLE", "REVIEW_REQUIRED", or "NOT_EMPLOYABLE"
2. A concise 2-3 sentence summary explaining the recommendation

Verification Results:
${roleType === "NURSE" ? `Nursys License Verification: ${JSON.stringify(nursysData, null, 2)}` : ""}
${roleType === "CNA" ? `Florida DOH CNA Verification: ${JSON.stringify(floridaDohData, null, 2)}` : ""}
OIG Exclusion List: ${JSON.stringify(oigResult, null, 2)}
SAM.gov: ${JSON.stringify(samGovResult, null, 2)}

Rules:
- NOT_EMPLOYABLE if: OIG status is "excluded", or license is revoked/suspended/surrendered
- REVIEW_REQUIRED if: license is expired, probation, restriction, or manual verification needed
- EMPLOYABLE if: license is active/unencumbered, not on OIG exclusion list
- If any check is "manual_required", default to REVIEW_REQUIRED unless other checks are clearly negative

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
