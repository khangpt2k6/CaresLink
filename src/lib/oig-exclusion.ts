/**
 * OIG LEIE (List of Excluded Individuals/Entities) Check
 * Downloads the monthly exclusion CSV from oig.hhs.gov and does a local name lookup.
 * Falls back to the OIG search form if the download fails.
 */

export interface OIGExclusion {
  lastName: string;
  firstName: string;
  middleName: string;
  exclusionType: string;
  exclusionDate: string;
  waiverState: string;
  specialty: string;
  address: string;
  city: string;
  state: string;
}

export type OIGStatus = "clear" | "excluded" | "error" | "manual_required";

export interface OIGResult {
  status: OIGStatus;
  searchedName: string;
  matches: OIGExclusion[];
  error?: string;
  manualUrl: string;
  checkedAt: string;
}

const LEIE_CSV_URL =
  "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv";
const MANUAL_URL = "https://exclusions.oig.hhs.gov/";

// Module-level cache — refreshed every 24 hours
let leieCache: OIGExclusion[] | null = null;
let leieLastFetch = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function parseLeieCSV(csv: string): OIGExclusion[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Find header row to map column indices
  const header = lines[0].split(",").map((h) => h.replace(/["\r]/g, "").toUpperCase().trim());
  const col = (name: string) => header.indexOf(name);

  const lastNameIdx = col("LASTNAME");
  const firstNameIdx = col("FIRSTNAME");
  const midNameIdx = col("MIDNAME");
  const exclTypeIdx = col("EXCL_TYPE");
  const exclDateIdx = col("EXCL_DATE");
  const waiverIdx = col("WAIVERSTATE");
  const specialtyIdx = col("SPECIALTY");
  const addressIdx = col("ADDRESS");
  const cityIdx = col("CITY");
  const stateIdx = col("STATE");

  const results: OIGExclusion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[lastNameIdx]) continue;
    results.push({
      lastName: (cols[lastNameIdx] ?? "").trim(),
      firstName: (cols[firstNameIdx] ?? "").trim(),
      middleName: (cols[midNameIdx] ?? "").trim(),
      exclusionType: (cols[exclTypeIdx] ?? "").trim(),
      exclusionDate: (cols[exclDateIdx] ?? "").trim(),
      waiverState: (cols[waiverIdx] ?? "").trim(),
      specialty: (cols[specialtyIdx] ?? "").trim(),
      address: (cols[addressIdx] ?? "").trim(),
      city: (cols[cityIdx] ?? "").trim(),
      state: (cols[stateIdx] ?? "").trim(),
    });
  }
  return results;
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

async function loadLeie(): Promise<OIGExclusion[]> {
  const now = Date.now();
  if (leieCache && now - leieLastFetch < CACHE_TTL_MS) return leieCache;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(LEIE_CSV_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; healthcare-verification/1.0)" },
    });
    if (!res.ok) throw new Error(`LEIE download returned ${res.status}`);
    const text = await res.text();
    leieCache = parseLeieCSV(text);
    leieLastFetch = now;
    return leieCache;
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(s: string) {
  return s.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export async function checkOIGExclusion(
  firstName: string,
  lastName: string,
  middleName?: string
): Promise<OIGResult> {
  const searchedName = [firstName, middleName, lastName].filter(Boolean).join(" ").toUpperCase();
  const checkedAt = new Date().toISOString();

  try {
    const leie = await loadLeie();

    const lastN = normalize(lastName);
    const firstN = normalize(firstName);

    const matches = leie.filter((r) => {
      const lMatch = normalize(r.lastName) === lastN;
      if (!lMatch) return false;
      // Fuzzy first name: must start with same first 2 chars
      const fMatch = normalize(r.firstName).startsWith(firstN.slice(0, 2));
      return fMatch;
    });

    return {
      status: matches.length > 0 ? "excluded" : "clear",
      searchedName,
      matches,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Try fallback: OIG web search form
    try {
      return await checkOIGViaWeb(firstName, lastName, searchedName, checkedAt);
    } catch {
      return {
        status: "manual_required",
        searchedName,
        matches: [],
        error: msg,
        manualUrl: MANUAL_URL,
        checkedAt,
      };
    }
  }
}

async function checkOIGViaWeb(
  firstName: string,
  lastName: string,
  searchedName: string,
  checkedAt: string
): Promise<OIGResult> {
  // OIG exclusion search via their form endpoint
  const params = new URLSearchParams({
    SearchType: "N",
    LastName: lastName.toUpperCase(),
    FirstName: firstName.toUpperCase(),
    DOB: "",
    ExclusionType: "",
    ExclusionDate: "",
    ExclusionState: "",
  });

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://oig.hhs.gov/exclusions/exclusions_download.asp", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        Referer: MANUAL_URL,
      },
      body: params.toString(),
    });
    const text = await res.text();

    // If response contains CSV data with results
    if (text.includes(",") && text.length > 200) {
      const rows = parseLeieCSV(text);
      const lastN = normalize(lastName);
      const firstN = normalize(firstName);
      const matches = rows.filter(
        (r) =>
          normalize(r.lastName) === lastN &&
          normalize(r.firstName).startsWith(firstN.slice(0, 2))
      );
      return {
        status: matches.length > 0 ? "excluded" : "clear",
        searchedName,
        matches,
        manualUrl: MANUAL_URL,
        checkedAt,
      };
    }

    // Could not determine from response
    return {
      status: "manual_required",
      searchedName,
      matches: [],
      error: "Could not parse OIG response",
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
