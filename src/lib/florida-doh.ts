/**
 * Florida Department of Health – MQA Health Care Provider Search
 * Searches for CNA (and RN) licenses via the Florida DOH MQA portal.
 * URL: https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders
 */

export interface FloridaLicense {
  name: string;
  licenseNumber: string;
  licenseType: string;
  status: string;       // "Active", "Inactive", "Delinquent", "Null and Void", etc.
  expirationDate: string;
  county?: string;
  address?: string;
}

export type FloridaDOHStatus = "found" | "not_found" | "error" | "manual_required";

export interface FloridaDOHResult {
  status: FloridaDOHStatus;
  searchedName: string;
  licenseType: string;
  matches: FloridaLicense[];
  error?: string;
  manualUrl: string;
  checkedAt: string;
}

const SEARCH_URL =
  "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";
const MANUAL_URL = SEARCH_URL;

// Florida DOH license type codes
const LICENSE_TYPE_MAP: Record<string, string> = {
  CNA: "CNA",
  NURSE: "RN",
  RN: "RN",
  LPN: "LPN",
};

function parseDOHResults(html: string): FloridaLicense[] {
  const results: FloridaLicense[] = [];

  // Florida DOH returns results in an HTML table
  // Typical columns: Name | License # | License Type | Status | Expiration | County
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM: RegExpExecArray | null;
  while ((trM = trRe.exec(html)) !== null) {
    const cells = [...trM[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim()
    );
    // Skip header rows and short rows
    if (cells.length < 4 || /name|license|status|type/i.test(cells[0])) continue;
    if (!cells[0] || !cells[1]) continue;

    results.push({
      name: cells[0],
      licenseNumber: cells[1],
      licenseType: cells[2] || "",
      status: cells[3] || "",
      expirationDate: cells[4] || "",
      county: cells[5] || undefined,
    });
  }
  return results;
}

export async function searchFloridaDOH(
  firstName: string,
  lastName: string,
  roleType: "CNA" | "NURSE" | "RN" | "LPN" = "CNA"
): Promise<FloridaDOHResult> {
  const licenseType = LICENSE_TYPE_MAP[roleType] ?? roleType;
  const searchedName = `${firstName} ${lastName}`.toUpperCase();
  const checkedAt = new Date().toISOString();

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);

  try {
    // First GET the page to get any required session/VIEWSTATE
    const r1 = await fetch(SEARCH_URL, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    const h1 = await r1.text();
    let cookies = r1.headers.get("set-cookie") ?? "";
    // Simplify cookies: keep just key=value pairs
    cookies = cookies
      .split(/,(?=[^ ,;]+=)/)
      .map((c) => c.split(";")[0].trim())
      .join("; ");

    // Extract ViewState if present (ASP.NET)
    const vsMatch = h1.match(/name="__VIEWSTATE"\s+value="([^"]*)"/);
    const vs = vsMatch?.[1] ?? "";
    const vsgMatch = h1.match(/name="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/);
    const vsg = vsgMatch?.[1] ?? "";
    const evMatch = h1.match(/name="__EVENTVALIDATION"\s+value="([^"]*)"/);
    const ev = evMatch?.[1] ?? "";

    // Build search POST body
    const body = new URLSearchParams({
      ...(vs ? { __VIEWSTATE: vs } : {}),
      ...(vsg ? { __VIEWSTATEGENERATOR: vsg } : {}),
      ...(ev ? { __EVENTVALIDATION: ev } : {}),
      // Common Florida DOH MQA search fields
      LastName: lastName.toUpperCase(),
      FirstName: firstName.toUpperCase(),
      LicenseType: licenseType,
      LicenseStatus: "A", // Active
      LicenseNumber: "",
      County: "",
      btnSearch: "Search",
    });

    const r2 = await fetch(SEARCH_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: SEARCH_URL,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      body: body.toString(),
    });

    const h2 = await r2.text();

    if (/no\s+results?\s+found|no\s+records?\s+found|0\s+records?/i.test(h2)) {
      return {
        status: "not_found",
        searchedName,
        licenseType,
        matches: [],
        manualUrl: MANUAL_URL,
        checkedAt,
      };
    }

    const matches = parseDOHResults(h2);

    return {
      status: matches.length > 0 ? "found" : "not_found",
      searchedName,
      licenseType,
      matches,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "manual_required",
      searchedName,
      licenseType,
      matches: [],
      error: msg,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
