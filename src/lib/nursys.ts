/**
 * Nursys® QuickConfirm License Verification
 * Automates the nursys.com QuickConfirm search to verify RN/PN licenses.
 * Falls back to manual_required if the site is unreachable or blocks automation.
 */

export interface NursysLicense {
  nameOnLicense: string;
  type: string;          // "RN", "PN", etc.
  licenseState: string;
  licenseNumber: string;
  active: boolean;
  status: string;        // "UNENCUMBERED", "EXPIRED", "REVOKED", etc.
  originalIssueDate: string;
  expirationDate: string;
  compactStatus: string; // "MULTISTATE", "SINGLE STATE", "NONE"
}

export interface NursysMatch {
  ncsbnId: string;
  displayName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  previewLicenses: Array<{ type: string; state: string; licenseNumber: string }>;
}

export interface NursysReport {
  ncsbnId: string;
  fullName: string;
  reportDate: string;
  licenses: NursysLicense[];
  boardMessages: string[];
  authorizedStates: string[];
}

export type NursysStatus = "found" | "not_found" | "multiple_found" | "error" | "manual_required";

export interface NursysResult {
  status: NursysStatus;
  matches: NursysMatch[];
  selectedMatch?: NursysMatch;
  report?: NursysReport;
  error?: string;
  manualUrl: string;
}

const BASE = "https://www.nursys.com";
const MANUAL_URL = `${BASE}/LQC/LQCSearch.aspx`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function field(html: string, name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`(?:name|id)="${esc}"[^>]*value="([^"]*)"`, "i")) ||
    html.match(new RegExp(`value="([^"]*)"[^>]*(?:name|id)="${esc}"`, "i"));
  return m?.[1] ?? "";
}

function mergeCookies(existing: string, header: string | null): string {
  if (!header) return existing;
  const incoming = header
    .split(/,(?=[^ ,;]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const c of existing.split("; ").filter(Boolean)) {
    const k = c.split("=")[0];
    map.set(k, c);
  }
  for (const c of incoming) {
    const k = c.split("=")[0];
    map.set(k, c);
  }
  return [...map.values()].join("; ");
}

function parseMatches(html: string): NursysMatch[] {
  const results: NursysMatch[] = [];
  // Nursys displays: "SARAH FLORENCE JOHNSON [NCSBN ID: 24189751]"
  const re = /([A-Z][A-Z\s\-.']+?)\s+\[NCSBN\s+ID:\s*(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const displayName = m[1].trim();
    const ncsbnId = m[2];
    const parts = displayName.split(/\s+/);
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined;
    results.push({ ncsbnId, displayName, lastName, firstName, middleName, previewLicenses: [] });
  }
  return results;
}

function parseReport(html: string, ncsbnId: string): NursysReport {
  const nameM = html.match(/([A-Z][A-Z\s\-.']+?)\s+\[NCSBN\s+ID:/);
  const fullName = nameM?.[1]?.trim() ?? "";

  const dateM = html.match(/As\s+of\s+([^\n<\r]+)/i);
  const reportDate = dateM?.[1]?.trim() ?? "";

  // Extract authorized states
  const authorizedStates: string[] = [];
  const stateRe = /([A-Z]{4,})\s*\((RN|PN|LPN|LVN)\)/g;
  let sm: RegExpExecArray | null;
  while ((sm = stateRe.exec(html)) !== null) {
    if (!authorizedStates.includes(sm[1])) authorizedStates.push(sm[1]);
  }

  // Board messages
  const boardMessages: string[] = [];
  const msgRe = /This (?:notification|license)[^<]{20,}/gi;
  let mm: RegExpExecArray | null;
  while ((mm = msgRe.exec(html)) !== null) {
    const msg = mm[0].replace(/\s+/g, " ").trim();
    if (!boardMessages.includes(msg)) boardMessages.push(msg);
  }

  // License rows from <table> tags — each <tr> with 8-9 <td> cells
  const licenses: NursysLicense[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    // Expect at least 8 non-header cells
    if (cells.length >= 7 && cells[0] && !/LAST|FIRST|LICENSE|STATE|TYPE/i.test(cells[0])) {
      licenses.push({
        nameOnLicense: cells[0] || fullName,
        type: cells[1] || "",
        licenseState: cells[2] || "",
        licenseNumber: cells[3] || "",
        active: cells[4]?.toUpperCase() === "YES",
        status: cells[5] || "",
        originalIssueDate: cells[6] || "",
        expirationDate: cells[7] || "",
        compactStatus: cells[8] || "NONE",
      });
    }
  }

  return { ncsbnId, fullName, reportDate, licenses, boardMessages, authorizedStates };
}

export async function searchNursysRN(
  firstName: string,
  lastName: string,
  middleName?: string,
  licenseNumber?: string,
  licenseState?: string
): Promise<NursysResult> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);

  try {
    // 1) Terms page — get VIEWSTATE + session cookie
    const r1 = await fetch(`${BASE}/NLV/NLVTerms.aspx`, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    const h1 = await r1.text();
    let cookies = mergeCookies("", r1.headers.get("set-cookie"));

    const vs1 = field(h1, "__VIEWSTATE");
    const vsg1 = field(h1, "__VIEWSTATEGENERATOR");
    const ev1 = field(h1, "__EVENTVALIDATION");

    if (!vs1) throw new Error("Could not load Nursys terms page (no VIEWSTATE)");

    // 2) Accept terms
    const body2 = new URLSearchParams({
      __VIEWSTATE: vs1,
      __VIEWSTATEGENERATOR: vsg1,
      __EVENTVALIDATION: ev1,
      btnAgree: "I Agree",
    });
    const r2 = await fetch(`${BASE}/NLV/NLVTerms.aspx`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: `${BASE}/NLV/NLVTerms.aspx`,
        "User-Agent": UA,
      },
      body: body2.toString(),
      redirect: "follow",
    });
    const h2 = await r2.text();
    cookies = mergeCookies(cookies, r2.headers.get("set-cookie"));

    const vs2 = field(h2, "__VIEWSTATE");
    const vsg2 = field(h2, "__VIEWSTATEGENERATOR");
    const ev2 = field(h2, "__EVENTVALIDATION");

    // 3) Submit search
    const body3 = new URLSearchParams({
      __VIEWSTATE: vs2,
      __VIEWSTATEGENERATOR: vsg2,
      __EVENTVALIDATION: ev2,
      txtLastName: lastName.toUpperCase(),
      txtFirstName: firstName.toUpperCase(),
      ddlLicType: "RN",
      ...(licenseState ? { ddlState: licenseState.toUpperCase() } : {}),
      ...(licenseNumber ? { txtLicNum: licenseNumber } : {}),
      btnSearch: "Search",
    });
    const r3 = await fetch(`${BASE}/NLV/NLVSearch.aspx`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: `${BASE}/NLV/NLVSearch.aspx`,
        "User-Agent": UA,
      },
      body: body3.toString(),
    });
    const h3 = await r3.text();
    cookies = mergeCookies(cookies, r3.headers.get("set-cookie"));

    if (/no\s+results?\s+found|no\s+records?\s+found|0\s+results?/i.test(h3)) {
      return { status: "not_found", matches: [], manualUrl: MANUAL_URL };
    }

    const matches = parseMatches(h3);
    if (matches.length === 0) {
      return { status: "not_found", matches: [], manualUrl: MANUAL_URL };
    }

    // Select best match by middle name when multiple
    let selected = matches[0];
    if (matches.length > 1 && middleName) {
      const norm = middleName.trim().toLowerCase();
      const byMiddle = matches.find((m) =>
        m.middleName?.toLowerCase().startsWith(norm.split(" ")[0])
      );
      if (byMiddle) selected = byMiddle;
    }

    // 4) Full report for selected NCSBN ID
    let report: NursysReport | undefined;
    try {
      const r4 = await fetch(`${BASE}/NLV/NLVViewRpt.aspx?ncsbnid=${selected.ncsbnId}`, {
        signal: ctrl.signal,
        headers: { Cookie: cookies, "User-Agent": UA },
      });
      const h4 = await r4.text();
      report = parseReport(h4, selected.ncsbnId);
    } catch {
      // Report fetch failed — partial result still usable
    }

    return {
      status: matches.length === 1 ? "found" : "multiple_found",
      matches,
      selectedMatch: selected,
      report,
      manualUrl: MANUAL_URL,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "manual_required", matches: [], error: msg, manualUrl: MANUAL_URL };
  } finally {
    clearTimeout(timeout);
  }
}
