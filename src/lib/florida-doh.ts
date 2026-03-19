/**
 * Florida Department of Health – MQA Health Care Provider Search
 * Searches for CNA and RN licenses via the Florida DOH MQA portal.
 * URL: https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders
 *
 * The portal is ASP.NET MVC (not WebForms), so it uses __RequestVerificationToken,
 * not __VIEWSTATE. Form fields use SearchDto.* prefix.
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
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Florida DOH Board and Profession codes
// Board 17 = Board of Nursing
const PROFESSION_MAP: Record<string, { board: string; profession: string; label: string }> = {
  CNA:   { board: "17", profession: "4401", label: "Certified Nursing Assistant" },
  NURSE: { board: "17", profession: "1701", label: "Registered Nurse" },
  RN:    { board: "17", profession: "1701", label: "Registered Nurse" },
  LPN:   { board: "17", profession: "1702", label: "Licensed Practical Nurse" },
};

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

function parseDOHResults(html: string): FloridaLicense[] {
  const results: FloridaLicense[] = [];

  // Find the results table — look for <table> elements with <tr> rows
  // Typical columns: License # | Name | Profession | Board | Status | Expiration | County
  // The header row helps us determine actual column order
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableM: RegExpExecArray | null;

  while ((tableM = tableRe.exec(html)) !== null) {
    const tableHtml = tableM[1];
    const rows: string[][] = [];

    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trM: RegExpExecArray | null;
    while ((trM = trRe.exec(tableHtml)) !== null) {
      const cells = [...trM[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .replace(/&#\d+;/g, "")
          .replace(/\s+/g, " ")
          .trim()
      );
      if (cells.length >= 3) rows.push(cells);
    }

    if (rows.length < 2) continue;

    // Detect column indices from header row
    const header = rows[0].map((h) => h.toLowerCase());
    const col = (keywords: string[]) =>
      header.findIndex((h) => keywords.some((k) => h.includes(k)));

    const licNumCol = col(["license #", "license#", "lic #", "license number", "lic."]);
    const nameCol   = col(["name", "licensee"]);
    const typeCol   = col(["profession", "license type", "type"]);
    const statusCol = col(["status"]);
    const expCol    = col(["expir", "exp date", "expiration"]);
    const countyCol = col(["county"]);

    // If no recognizable header, skip this table
    if (licNumCol === -1 && nameCol === -1) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : "");

      // Flexible: if we can identify license # and name columns, use them; else fall back to positional
      const name       = nameCol   >= 0 ? get(nameCol)   : get(1);
      const licNum     = licNumCol >= 0 ? get(licNumCol) : get(0);
      const licType    = typeCol   >= 0 ? get(typeCol)   : get(2);
      const status     = statusCol >= 0 ? get(statusCol) : get(3);
      const expDate    = expCol    >= 0 ? get(expCol)    : get(4);
      const county     = countyCol >= 0 ? get(countyCol) : get(5);

      if (!name && !licNum) continue;

      results.push({
        name,
        licenseNumber: licNum,
        licenseType: licType,
        status,
        expirationDate: expDate,
        county: county || undefined,
      });
    }

    // If we found results in this table, stop looking
    if (results.length > 0) break;
  }

  return results;
}

export async function searchFloridaDOH(
  firstName: string,
  lastName: string,
  roleType: "CNA" | "NURSE" | "RN" | "LPN" = "CNA",
  licenseNumber?: string
): Promise<FloridaDOHResult> {
  const profConfig = PROFESSION_MAP[roleType] ?? PROFESSION_MAP.CNA;
  const searchedName = `${firstName} ${lastName}`.toUpperCase();
  const checkedAt = new Date().toISOString();

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 25000);

  try {
    // Step 1: GET the search page to obtain cookies and CSRF token
    const r1 = await fetch(SEARCH_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    const h1 = await r1.text();
    let cookies = mergeCookies("", r1.headers.get("set-cookie"));

    // Extract ASP.NET MVC CSRF token (not ViewState — this site is MVC, not WebForms)
    const csrfMatch = h1.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/);
    const csrf = csrfMatch?.[1] ?? "";

    if (!csrf && !cookies) {
      throw new Error("Could not load Florida DOH search page");
    }

    // Step 2: POST the search with correct SearchDto.* field names
    const body = new URLSearchParams({
      __RequestVerificationToken: csrf,
      "SearchDto.Board":         profConfig.board,
      "SearchDto.Profession":    profConfig.profession,
      "SearchDto.LastName":      lastName.toUpperCase(),
      "SearchDto.FirstName":     firstName.toUpperCase(),
      "SearchDto.LicenseNumber": licenseNumber?.trim() ?? "",
      "SearchDto.BusinessName":  "",
      "SearchDto.City":          "",
      "SearchDto.ZipCode":       "",
      "SearchDto.County":        "",
      "SearchDto.LicenseStatus": "ACT", // Practicing statuses (Active)
    });

    const r2 = await fetch(SEARCH_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: SEARCH_URL,
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      body: body.toString(),
    });

    cookies = mergeCookies(cookies, r2.headers.get("set-cookie"));
    const h2 = await r2.text();

    // Check for "no results" indicators
    if (/no\s+results?\s+found|no\s+records?\s+found|0\s+results?/i.test(h2)) {
      return { status: "not_found", searchedName, licenseType: profConfig.label, matches: [], manualUrl: MANUAL_URL, checkedAt };
    }

    const matches = parseDOHResults(h2);

    return {
      status: matches.length > 0 ? "found" : "not_found",
      searchedName,
      licenseType: profConfig.label,
      matches,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "manual_required",
      searchedName,
      licenseType: profConfig.label,
      matches: [],
      error: msg,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
