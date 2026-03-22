import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/credential-check/[id]/ai-review — re-run AI analysis on existing verification data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const check = await prisma.credentialCheck.findFirst({
    where: { id, employerId: auth.user.id, status: "COMPLETED" },
  });

  if (!check) {
    return NextResponse.json({ error: "Not found or not completed" }, { status: 404 });
  }

  try {
    const { firstName, lastName, roleType } = check;
    const nursysData = check.nursysData as unknown;
    const floridaDohData = check.floridaDohData as unknown;
    const oigResult = check.oigData as unknown;
    const samGovResult = check.samGovData as unknown;

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
      data: { aiRecommendation, aiSummary },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI review error:", err);
    return NextResponse.json({ error: "AI review failed", details: msg }, { status: 500 });
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

  throw new Error("Failed to parse AI response");
}
