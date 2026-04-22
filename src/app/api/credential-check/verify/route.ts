import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { searchFloridaDOH, type FloridaDOHResult } from "@/lib/florida-doh";
import {
  captureNursysScreenshots,
  type NursysBrowserResult,
} from "@/lib/browser-verify";
import { checkOIGExclusion, type OIGResult } from "@/lib/oig-exclusion";
import { checkSAMGov, type SAMGovResult } from "@/lib/sam-gov";
import { textCompletion } from "@/lib/ai-provider";

type Role = "CNA" | "NURSE" | "RN" | "LPN";

type Recommendation = "employable" | "review_required" | "not_employable";

interface CombinedSources {
  nursys?: NursysBrowserResult & { status: NursysSummaryStatus };
  oig?: OIGResult;
  samGov?: SAMGovResult;
  floridaDoh?: FloridaDOHResult;
  checkedAt: string;
}

type NursysSummaryStatus =
  | "license_found"
  | "no_license"
  | "blocked"
  | "error";

// POST /api/credential-check/verify
// Body: { firstName, middleName, lastName, email, phone, licenseNumber, roleType, candidateProfileId? }
// Runs Nursys (RN/LPN, headed Chromium via Playwright) + OIG + SAM.gov + FL DOH (CNA),
// asks Claude for an employability recommendation, persists everything in
// credential_checks, returns the saved row.
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
    const isNurse =
      roleType === "RN" || roleType === "NURSE" || roleType === "LPN";
    const scraperRole: "CNA" | "NURSE" | "LPN" =
      roleType === "RN" ? "NURSE" : (roleType as "CNA" | "NURSE" | "LPN");

    const candidateProfileId = body.candidateProfileId
      ? String(body.candidateProfileId)
      : null;
    const stateCode = String(body.state ?? "FL").toUpperCase();

    // 1. Run primary-source lookups in parallel.
    //    - RN/LPN: Nursys® via headed Chromium (real browser window).
    //    - CNA:    Florida DOH (text scrape) — Nursys does not cover CNA.
    //    - All:    OIG (HHS exclusion list, fast HTTP) + SAM.gov placeholder.
    const tasks = await Promise.allSettled([
      isNurse
        ? captureNursysScreenshots(firstName, lastName, stateCode, licenseNumber)
        : Promise.resolve<NursysBrowserResult | null>(null),
      checkOIGExclusion(firstName, lastName, middleName ?? undefined),
      checkSAMGov(firstName, lastName, licenseNumber ?? undefined, stateCode),
      !isNurse
        ? searchFloridaDOH(firstName, lastName, scraperRole, licenseNumber ?? undefined)
        : Promise.resolve<FloridaDOHResult | null>(null),
    ]);

    const nursysRaw =
      tasks[0].status === "fulfilled" ? tasks[0].value : null;
    const oig =
      tasks[1].status === "fulfilled"
        ? tasks[1].value
        : oigErrored(firstName, lastName, asMessage(tasks[1]));
    const samGov =
      tasks[2].status === "fulfilled"
        ? tasks[2].value
        : await checkSAMGov(firstName, lastName, licenseNumber ?? undefined, stateCode);
    const floridaDoh =
      tasks[3].status === "fulfilled" ? tasks[3].value : null;

    const nursys = nursysRaw
      ? { ...nursysRaw, status: summarizeNursys(nursysRaw) }
      : undefined;

    const sources: CombinedSources = {
      nursys,
      oig,
      samGov,
      floridaDoh: floridaDoh ?? undefined,
      checkedAt: new Date().toISOString(),
    };

    // 2. Ask Claude for an employability recommendation.
    const ai = await classifyWithAi(sources, {
      firstName,
      lastName,
      licenseNumber,
      isNurse,
    });

    // 3. Determine overall row status — "completed" unless every source errored.
    const everySourceErrored =
      (nursys?.status === "error" || nursys === undefined ? !floridaDoh : false) &&
      oig.status === "error" &&
      (floridaDoh ? floridaDoh.status === "error" : true);

    // 4. Persist.
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
        state: stateCode,
        status: everySourceErrored ? "error" : "completed",
        source_results: sources as unknown as object,
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

function asMessage(settled: PromiseSettledResult<unknown>): string {
  if (settled.status === "fulfilled") return "";
  const r = settled.reason;
  return r instanceof Error ? r.message : String(r);
}

function oigErrored(firstName: string, lastName: string, msg: string): OIGResult {
  return {
    status: "error",
    searchedName: `${firstName} ${lastName}`.toUpperCase(),
    matches: [],
    exactMatches: [],
    partialMatches: [],
    error: msg,
    manualUrl: "https://exclusions.oig.hhs.gov/",
    checkedAt: new Date().toISOString(),
  };
}

function summarizeNursys(r: NursysBrowserResult): NursysSummaryStatus {
  if (!r) return "error";
  const licenses = r.report?.licenses ?? [];
  if (licenses.length > 0) return "license_found";
  // No report but we got screenshots → site reachable, no license matched
  if (r.screenshots && r.screenshots.length > 0) {
    const labels = r.screenshots.map((s) => s.label.toLowerCase()).join(" ");
    if (labels.includes("denied") || labels.includes("blocked") || labels.includes("captcha")) {
      return "blocked";
    }
    return "no_license";
  }
  return "error";
}

async function classifyWithAi(
  sources: CombinedSources,
  q: {
    firstName: string;
    lastName: string;
    licenseNumber: string | null;
    isNurse: boolean;
  }
): Promise<{ recommendation: Recommendation; reason: string }> {
  // ── OIG hard fails first ───────────────────────────────────────────────
  if (sources.oig?.status === "excluded") {
    const top = sources.oig.exactMatches[0];
    return {
      recommendation: "not_employable",
      reason: `OIG LEIE exclusion match (${top?.exclusionType ?? "excluded"}). Federal law prohibits employment.`,
    };
  }

  // ── Nurse path: trust Nursys when it returned a license ────────────────
  if (q.isNurse && sources.nursys?.status === "license_found") {
    const licenses = sources.nursys.report?.licenses ?? [];
    const active = licenses.find((l) => l.active);
    const status = (active?.status || licenses[0]?.status || "").toUpperCase();

    if (active && status.includes("UNENCUMBERED")) {
      return {
        recommendation: "employable",
        reason: `Active unencumbered ${active.type} license #${active.licenseNumber} in ${active.licenseState}. OIG ${sources.oig?.status ?? "—"}.`,
      };
    }
    if (status.includes("REVOK") || status.includes("SUSPEND") || status.includes("VOID")) {
      return {
        recommendation: "not_employable",
        reason: `Nursys reports license status "${status}". Candidate cannot practice.`,
      };
    }
    if (status.includes("EXPIR") || status.includes("DELINQ")) {
      return {
        recommendation: "review_required",
        reason: `Nursys reports license "${status}". Confirm renewal before hire.`,
      };
    }
    // Otherwise let Claude decide
  }

  // ── CNA path: existing FL DOH logic ─────────────────────────────────────
  if (!q.isNurse && sources.floridaDoh) {
    const fl = sources.floridaDoh;
    if (fl.status === "not_found") {
      return {
        recommendation: "review_required",
        reason: "No matching record in the Florida DOH public database. Confirm name/license with the candidate.",
      };
    }
    if (fl.status === "error" || fl.status === "manual_required") {
      return {
        recommendation: "review_required",
        reason: "Automated FL DOH lookup did not return a definitive result; run a manual check.",
      };
    }
    const top = fl.matches[0];
    if (top) {
      const status = (top.status || "").toUpperCase();
      if (status.includes("NULL") || status.includes("VOID") || status.includes("REVOK") || status.includes("SUSPEND")) {
        return {
          recommendation: "not_employable",
          reason: `License status is "${top.status}". This candidate cannot practice in Florida.`,
        };
      }
    }
  }

  // ── Fallback: ask Claude with a compact summary of every source ─────────
  try {
    const summary = {
      query: q,
      nursys:
        sources.nursys && {
          status: sources.nursys.status,
          licenses: sources.nursys.report?.licenses ?? [],
          boardMessages: sources.nursys.report?.boardMessages?.slice(0, 4) ?? [],
        },
      oig: sources.oig && {
        status: sources.oig.status,
        exact: sources.oig.exactMatches.length,
        partial: sources.oig.partialMatches.length,
      },
      samGov: sources.samGov && { status: sources.samGov.status },
      floridaDoh:
        sources.floridaDoh && {
          status: sources.floridaDoh.status,
          matches: sources.floridaDoh.matches.slice(0, 2),
        },
    };

    const text = await textCompletion({
      maxTokens: 300,
      system: "Return only a JSON object as specified.",
      messages: [
        {
          role: "user",
          content: `You are a healthcare compliance reviewer. Given the verification results below, choose ONE of: "employable", "review_required", "not_employable". Reply with ONLY a JSON object: { "recommendation": "...", "reason": "1-2 sentence justification" }.

Rules:
- OIG exact exclusion -> not_employable.
- Nursys/Florida active+unencumbered license -> employable.
- Status containing Revoked/Suspended/Null/Void -> not_employable.
- Expired/Delinquent or no match -> review_required.
- SAM.gov status of "manual_required" alone is not a blocker — note it in the reason.

Verification: ${JSON.stringify(summary)}`,
        },
      ],
    });

    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const allowed = new Set<Recommendation>([
      "employable",
      "review_required",
      "not_employable",
    ]);
    const rec = String(parsed.recommendation ?? "review_required");
    return {
      recommendation: (allowed.has(rec as Recommendation)
        ? rec
        : "review_required") as Recommendation,
      reason: String(parsed.reason ?? "AI did not provide a reason."),
    };
  } catch {
    return {
      recommendation: "review_required",
      reason:
        "Verification completed. Please review and mark success to enable cache reuse.",
    };
  }
}
