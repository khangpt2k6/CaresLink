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

export type OIGStatus = "clear" | "excluded" | "partial_match" | "error" | "manual_required";

export interface OIGResult {
  status: OIGStatus;
  searchedName: string;
  matches: OIGExclusion[];
  exactMatches: OIGExclusion[];   // confirmed exact first+last name hits
  partialMatches: OIGExclusion[]; // fuzzy hits that need human review
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

  // Use the web endpoint first (fast, name-specific query) instead of
  // downloading the full 15MB LEIE CSV which can take 30s+ and timeout.
  try {
    return await checkOIGViaWeb(firstName, lastName, searchedName, checkedAt);
  } catch {
    // Web endpoint failed — fall back to full CSV download
  }

  try {
    const leie = await loadLeie();

    const lastN = normalize(lastName);
    const firstN = normalize(firstName);
    const midN = middleName ? normalize(middleName) : "";

    // Exact: last name matches AND first name matches exactly (or near-exactly)
    const exactMatches = leie.filter((r) => {
      if (normalize(r.lastName) !== lastN) return false;
      const rFirst = normalize(r.firstName);
      // Exact first name match
      if (rFirst === firstN) return true;
      // Middle-initial disambiguation: if we have a middle name, check it
      if (midN && normalize(r.middleName) === midN && rFirst === firstN) return true;
      return false;
    });

    // Partial: last name matches AND first name starts with same 4+ chars (min 4 to avoid false positives)
    const partialMatches = leie.filter((r) => {
      if (normalize(r.lastName) !== lastN) return false;
      const rFirst = normalize(r.firstName);
      // Skip already captured exact matches
      if (rFirst === firstN) return false;
      // Require at least 4-char prefix match to reduce noise (e.g. "MARI" not just "MA")
      const prefixLen = Math.max(4, Math.min(firstN.length, 5));
      return firstN.length >= 4 && rFirst.startsWith(firstN.slice(0, prefixLen));
    });

    const allMatches = [...exactMatches, ...partialMatches];
    const status: OIGStatus =
      exactMatches.length > 0 ? "excluded" :
      partialMatches.length > 0 ? "partial_match" :
      "clear";

    return {
      status,
      searchedName,
      matches: allMatches,
      exactMatches,
      partialMatches,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "manual_required",
      searchedName,
      matches: [],
      exactMatches: [],
      partialMatches: [],
      error: msg,
      manualUrl: MANUAL_URL,
      checkedAt,
    };
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
      const exactMatches = rows.filter(
        (r) => normalize(r.lastName) === lastN && normalize(r.firstName) === firstN
      );
      const prefixLen = Math.max(4, Math.min(firstN.length, 5));
      const partialMatches = rows.filter(
        (r) => normalize(r.lastName) === lastN &&
          normalize(r.firstName) !== firstN &&
          firstN.length >= 4 &&
          normalize(r.firstName).startsWith(firstN.slice(0, prefixLen))
      );
      const allMatches = [...exactMatches, ...partialMatches];
      const status: OIGStatus =
        exactMatches.length > 0 ? "excluded" :
        partialMatches.length > 0 ? "partial_match" : "clear";
      return {
        status,
        searchedName,
        matches: allMatches,
        exactMatches,
        partialMatches,
        manualUrl: MANUAL_URL,
        checkedAt,
      };
    }

    // Could not determine from response
    return {
      status: "manual_required",
      searchedName,
      matches: [],
      exactMatches: [],
      partialMatches: [],
      error: "Could not parse OIG response",
      manualUrl: MANUAL_URL,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
