import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { searchFloridaDOH, type FloridaDOHResult } from "@/lib/florida-doh";
import { textCompletion } from "@/lib/ai-provider";

type Role = "CNA" | "NURSE" | "RN" | "LPN";

// POST /api/credential-check/verify
// Body: { firstName, middleName, lastName, email, phone, licenseNumber, roleType, candidateProfileId? }
// Runs FL DOH lookup, asks Claude for an employability recommendation,
// persists everything in credential_checks, returns the saved row.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const firstName = String(body.firstName ?? "").trim();
    const middleName = body.middleName ? String(body.middleName).trim() : null;
    const lastName = String(body.lastName ?? "").trim();
    if (!lastName) {
      return NextResponse.json({ error: "lastName is required" }, { status: 400 });
    }

    const email = body.email ? String(body.email).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const licenseNumber = body.licenseNumber
      ? String(body.licenseNumber).trim()
      : null;
    const raw = String(body.roleType ?? "RN").toUpperCase();
    const roleType = (["CNA", "NURSE", "RN", "LPN"].includes(raw)
      ? raw
      : "RN") as Role;
    // Map RN -> NURSE for the scraper (its board/profession code uses NURSE).
    const scraperRole: "CNA" | "NURSE" | "LPN" =
      roleType === "RN" ? "NURSE" : (roleType as "CNA" | "NURSE" | "LPN");

    const candidateProfileId = body.candidateProfileId
      ? String(body.candidateProfileId)
      : null;

    // 1. Scrape FL DOH.
    let source: FloridaDOHResult;
    try {
      source = await searchFloridaDOH(
        firstName,
        lastName,
        scraperRole,
        licenseNumber ?? undefined
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scrape failed";
      const failed = await prisma.credential_checks.create({
        data: {
          created_by_user_id: auth.user.id,
          candidate_profile_id: candidateProfileId,
          candidate_first_name: firstName || null,
          candidate_middle_name: middleName,
          candidate_last_name: lastName,
          candidate_email: email,
          candidate_phone: phone,
          license_number: licenseNumber,
          role_type: roleType === "NURSE" ? "RN" : roleType,
          state: "FL",
          status: "error",
          source_results: { error: msg },
          ai_recommendation: "review_required",
          ai_reason: `Lookup failed: ${msg}`,
        },
      });
      return NextResponse.json(failed);
    }

    // 2. Ask Claude for an employability recommendation.
    const ai = await classifyWithAi(source, { firstName, lastName, licenseNumber });

    // 3. Persist.
    const saved = await prisma.credential_checks.create({
      data: {
        created_by_user_id: auth.user.id,
        candidate_profile_id: candidateProfileId,
        candidate_first_name: firstName || null,
        candidate_middle_name: middleName,
        candidate_last_name: lastName,
        candidate_email: email,
        candidate_phone: phone,
        license_number: licenseNumber,
        role_type: roleType === "NURSE" ? "RN" : roleType,
        state: "FL",
        status: source.status === "error" ? "error" : "completed",
        source_results: source as unknown as object,
        ai_recommendation: ai.recommendation,
        ai_reason: ai.reason,
      },
    });

    return NextResponse.json(saved);
  } catch (e) {
    console.error("credential-check/verify error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 }
    );
  }
}

async function classifyWithAi(
  source: FloridaDOHResult,
  q: { firstName: string; lastName: string; licenseNumber: string | null }
): Promise<{ recommendation: "employable" | "review_required" | "not_employable"; reason: string }> {
  // Fast paths — no need to burn an LLM call when the rule is unambiguous.
  if (source.status === "not_found") {
    return {
      recommendation: "review_required",
      reason:
        "No matching record in the Florida DOH public database. Confirm name/license with the candidate.",
    };
  }
  if (source.status === "error" || source.status === "manual_required") {
    return {
      recommendation: "review_required",
      reason: "Automated lookup did not return a definitive result; run a manual check.",
    };
  }
  if (source.matches.length === 0) {
    return {
      recommendation: "review_required",
      reason: "FL DOH returned a match hit but with no detail rows.",
    };
  }

  const top = source.matches[0];
  const status = (top.status || "").toUpperCase();
  if (status.includes("NULL") || status.includes("VOID") || status.includes("REVOK") || status.includes("SUSPEND")) {
    return {
      recommendation: "not_employable",
      reason: `License status is "${top.status}". This candidate cannot practice in Florida.`,
    };
  }

  // Otherwise consult Claude for a nuanced read (Delinquent, Clear/Active, edge cases).
  try {
    const prompt = `You are a compliance reviewer. Return JSON { "recommendation": "employable"|"review_required"|"not_employable", "reason": "1-2 sentence justification" }.

Candidate searched: ${q.firstName} ${q.lastName}${q.licenseNumber ? ` (license ${q.licenseNumber})` : ""}
Top FL DOH match: ${JSON.stringify(top)}
All matches: ${source.matches.length}
Checked at: ${source.checkedAt}

Rules:
- Status "Active" or "Clear/Active" on a matching name/license -> employable.
- Status containing "Delinquent" or "Expired" -> review_required.
- Status containing "Null and Void", "Revoked", "Suspended" -> not_employable.
- Name mismatch or multiple matches with no license# -> review_required.
Respond with ONLY valid JSON, no prose.`;
    const text = await textCompletion({
      model: "claude-sonnet-4-20250514",
      maxTokens: 300,
      system: "Return only a JSON object as specified.",
      messages: [{ role: "user", content: prompt }],
    });
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rec = String(parsed.recommendation ?? "review_required");
    const allowed = new Set(["employable", "review_required", "not_employable"]);
    return {
      recommendation: (allowed.has(rec) ? rec : "review_required") as any,
      reason: String(parsed.reason ?? "AI did not provide a reason."),
    };
  } catch {
    return {
      recommendation: "review_required",
      reason: `Top match status "${top.status}" — confirm via manual DOH page before hiring.`,
    };
  }
}
