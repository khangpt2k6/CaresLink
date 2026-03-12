import { NextRequest, NextResponse } from "next/server";

interface LicenseResult {
  name: string;
  licenseType: string;
  licenseNumber: string;
  status: string;
  expiration: string;
  city: string;
}

async function scrapeFLMQA(args: {
  first_name?: string;
  last_name?: string;
  license_number?: string;
}): Promise<{
  source: string;
  url: string;
  found: boolean;
  count?: number;
  results?: LicenseResult[];
  message?: string;
  error?: string;
}> {
  const baseUrl =
    "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";

  const formData = new URLSearchParams();
  formData.append("Board", "BOARD OF NURSING");
  formData.append("Profession", "");
  formData.append("LicenseNumber", args.license_number || "");
  formData.append("BusinessName", "");
  formData.append("LastName", args.last_name || "");
  formData.append("FirstName", args.first_name || "");
  formData.append("City", "");
  formData.append("County", "");
  formData.append("ZipCode", "");
  formData.append("LicenseStatus", "");

  const resp = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: formData.toString(),
  });

  if (!resp.ok) {
    return {
      source: "FL DOH MQA",
      url: baseUrl,
      found: false,
      error: `FL MQA returned status ${resp.status}`,
    };
  }

  const html = await resp.text();
  const results: LicenseResult[] = [];

  const rowRegex =
    /<tr[^>]*class="[^"]*SearchResultsRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length >= 5) {
      results.push({
        name: cells[0] || "",
        licenseType: cells[1] || "",
        licenseNumber: cells[2] || "",
        status: cells[3] || "",
        expiration: cells[4] || "",
        city: cells[5] || "",
      });
    }
  }

  if (results.length === 0) {
    if (html.includes("No results found") || html.includes("0 results")) {
      return {
        source: "FL DOH MQA (Board of Nursing)",
        url: baseUrl,
        found: false,
        message: `No nursing license found for the given search criteria.`,
      };
    }

    const simpleRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let simpleMatch;
    let rowCount = 0;
    while ((simpleMatch = simpleRowRegex.exec(html)) !== null) {
      rowCount++;
      if (rowCount <= 1) continue;
      const cells: string[] = [];
      const cellRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch2;
      while ((cellMatch2 = cellRegex2.exec(simpleMatch[1])) !== null) {
        cells.push(cellMatch2[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length >= 4) {
        results.push({
          name: cells[0] || "",
          licenseType: cells[1] || "",
          licenseNumber: cells[2] || "",
          status: cells[3] || "",
          expiration: cells[4] || "",
          city: cells[5] || "",
        });
      }
      if (results.length >= 5) break;
    }
  }

  if (results.length === 0) {
    return {
      source: "FL DOH MQA (Board of Nursing)",
      url: baseUrl,
      found: false,
      message: "No results found. Try checking the spelling or use a license number.",
    };
  }

  return {
    source: "FL DOH MQA (Board of Nursing)",
    url: baseUrl,
    found: true,
    count: results.length,
    results: results.slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { first_name, last_name, license_number } = body;

    if (!first_name && !last_name && !license_number) {
      return NextResponse.json(
        { error: "Provide at least a name or license number." },
        { status: 400 }
      );
    }

    const result = await scrapeFLMQA({ first_name, last_name, license_number });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Verification service unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
