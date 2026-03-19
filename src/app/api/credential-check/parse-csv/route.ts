import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";

// POST /api/credential-check/parse-csv
// Accepts a CSV file with columns:
// First Name, Middle Name (optional), Last Name, Email (optional),
// License Number (optional), Phone (optional), License State (optional), Role Type (optional)
export async function POST(req: NextRequest) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const header = rows[0].map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

    // Map common header variants to canonical names
    function colIdx(variants: string[]): number {
      for (const v of variants) {
        const i = header.findIndex((h) => h.includes(v));
        if (i >= 0) return i;
      }
      return -1;
    }

    const firstIdx = colIdx(["first_name", "first", "firstname"]);
    const middleIdx = colIdx(["middle_name", "middle", "middlename"]);
    const lastIdx = colIdx(["last_name", "last", "lastname", "surname"]);
    const emailIdx = colIdx(["email", "email_address"]);
    const phoneIdx = colIdx(["phone", "phone_number", "telephone"]);
    const licNumIdx = colIdx(["license_number", "license_num", "license#", "rn_license", "license"]);
    const licStateIdx = colIdx(["license_state", "state", "lic_state"]);
    const roleIdx = colIdx(["role_type", "role", "type", "position"]);

    if (firstIdx === -1 || lastIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have at least 'First Name' and 'Last Name' columns" },
        { status: 400 }
      );
    }

    const candidates = rows.slice(1).map((row) => {
      const raw = (i: number) => (i >= 0 ? row[i]?.trim() || null : null);

      // Auto-detect role type from text
      let roleType = "NURSE";
      const rawRole = raw(roleIdx)?.toUpperCase() ?? "";
      if (rawRole.includes("CNA") || rawRole.includes("AIDE") || rawRole.includes("ASSISTANT")) {
        roleType = "CNA";
      }

      return {
        firstName: raw(firstIdx) ?? "",
        middleName: raw(middleIdx),
        lastName: raw(lastIdx) ?? "",
        email: raw(emailIdx),
        phone: raw(phoneIdx),
        licenseNumber: raw(licNumIdx),
        licenseState: raw(licStateIdx),
        roleType,
      };
    }).filter((c) => c.firstName && c.lastName);

    return NextResponse.json({ candidates, count: candidates.length });
  } catch (e) {
    console.error("CSV parse error:", e);
    return NextResponse.json({ error: "Failed to parse CSV" }, { status: 500 });
  }
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}
