/**
 * Fetch real CNA data from Florida DOH MQA portal and output a test CSV.
 *
 * Run from the project root:
 *   node scripts/fetch-florida-cna-data.js
 *
 * Output: scripts/test-cna-candidates.csv
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

const SEARCH_URL = "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { "User-Agent": UA, Accept: "text/html,*/*" } }, (res) => {
      let data = "";
      const cookies = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ html: data, cookies, status: res.statusCode }));
    }).on("error", reject);
  });
}

function httpPost(url, body, cookies) {
  const buf = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": buf.length,
          Cookie: cookies,
          Referer: SEARCH_URL,
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ html: data, status: res.statusCode }));
      }
    );
    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}

function mergeCookies(existing, header) {
  const all = [existing, header].filter(Boolean).join("; ");
  const map = new Map();
  for (const c of all.split("; ").filter(Boolean)) {
    const k = c.split("=")[0];
    map.set(k, c);
  }
  return [...map.values()].join("; ");
}

function parseResults(html) {
  const results = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableM;

  while ((tableM = tableRe.exec(html)) !== null) {
    const tableHtml = tableM[1];
    const rows = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trM;
    while ((trM = trRe.exec(tableHtml)) !== null) {
      const cells = [...trM[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
      );
      if (cells.length >= 3) rows.push(cells);
    }

    if (rows.length < 2) continue;

    const header = rows[0].map((h) => h.toLowerCase());
    const col = (keywords) => header.findIndex((h) => keywords.some((k) => h.includes(k)));
    const nameCol   = col(["name", "licensee"]);
    const licNumCol = col(["license #", "lic #", "license number", "lic."]);
    const statusCol = col(["status"]);
    const expCol    = col(["expir"]);
    const countyCol = col(["county"]);

    if (nameCol === -1 && licNumCol === -1) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (idx) => (idx >= 0 && idx < row.length ? row[idx] : "");
      const name    = nameCol   >= 0 ? get(nameCol)   : get(1);
      const licNum  = licNumCol >= 0 ? get(licNumCol) : get(0);
      const status  = statusCol >= 0 ? get(statusCol) : get(3);
      const expDate = expCol    >= 0 ? get(expCol)    : get(4);
      const county  = countyCol >= 0 ? get(countyCol) : "";

      if (!name && !licNum) continue;

      // Parse name into parts (FL DOH usually returns "LAST, FIRST MIDDLE")
      let firstName = "", middleName = "", lastName = "";
      if (name.includes(",")) {
        const [last, rest] = name.split(",").map((s) => s.trim());
        lastName = last;
        const nameParts = rest.split(/\s+/).filter(Boolean);
        firstName = nameParts[0] || "";
        middleName = nameParts.slice(1).join(" ") || "";
      } else {
        const parts = name.split(/\s+/).filter(Boolean);
        firstName = parts[0] || "";
        lastName = parts[parts.length - 1] || "";
        middleName = parts.slice(1, -1).join(" ") || "";
      }

      results.push({ firstName, middleName, lastName, licNum, status, expDate, county });
    }

    if (results.length > 0) break;
  }
  return results;
}

const SEARCH_NAMES = ["JOHNSON", "MARTINEZ", "GARCIA", "WILLIAMS", "BROWN", "TAYLOR"];

async function main() {
  console.log("Fetching CNA data from Florida DOH MQA portal...\n");

  // Step 1: Get CSRF token and cookies
  console.log("Loading search page...");
  const r1 = await httpGet(SEARCH_URL);
  let cookies = r1.cookies;
  const csrf = r1.html.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/)?.[1] ?? "";
  console.log("CSRF token:", csrf ? "obtained" : "NOT FOUND");

  const allResults = [];

  for (const lastName of SEARCH_NAMES) {
    if (allResults.length >= 20) break;

    console.log(`\nSearching for CNA with last name: ${lastName}...`);

    const body = new URLSearchParams({
      __RequestVerificationToken: csrf,
      "SearchDto.Board":         "17",
      "SearchDto.Profession":    "4401",
      "SearchDto.LastName":      lastName,
      "SearchDto.FirstName":     "",
      "SearchDto.LicenseNumber": "",
      "SearchDto.BusinessName":  "",
      "SearchDto.City":          "",
      "SearchDto.ZipCode":       "",
      "SearchDto.County":        "",
      "SearchDto.LicenseStatus": "ACT",
    }).toString();

    const r2 = await httpPost(SEARCH_URL, body, cookies);
    cookies = mergeCookies(cookies, r2.headers?.["set-cookie"]?.join("; ") ?? "");

    const results = parseResults(r2.html);
    console.log(`  Found ${results.length} matches`);

    for (const r of results.slice(0, 5)) {
      if (allResults.length >= 20) break;
      allResults.push(r);
    }

    // Brief pause between requests
    await new Promise((res) => setTimeout(res, 1000));
  }

  if (allResults.length === 0) {
    console.log("\n⚠️  No results found. The FL DOH website may be blocking automated requests.");
    console.log("Using sample data instead...\n");
    // Fallback sample data
    allResults.push(
      { firstName: "MARIA",   middleName: "E",    lastName: "JOHNSON",  licNum: "CNA101234", status: "Active", expDate: "02/28/2025", county: "MIAMI-DADE" },
      { firstName: "JESSICA", middleName: "",      lastName: "MARTINEZ", licNum: "CNA298456", status: "Active", expDate: "06/30/2025", county: "BROWARD" },
      { firstName: "ANGELA",  middleName: "MARIE", lastName: "GARCIA",   licNum: "CNA334521", status: "Active", expDate: "12/31/2024", county: "PALM BEACH" },
      { firstName: "TAMARA",  middleName: "",      lastName: "WILLIAMS", licNum: "CNA445678", status: "Active", expDate: "03/31/2025", county: "ORANGE" },
      { firstName: "DESTINY", middleName: "L",     lastName: "BROWN",    licNum: "CNA556789", status: "Active", expDate: "09/30/2025", county: "HILLSBOROUGH" }
    );
  }

  // Write CSV
  const csvPath = path.join(__dirname, "test-cna-candidates.csv");
  const header = "First Name,Middle Name,Last Name,Email Address,RN License Number,Phone Number,License State,Role Type";
  const rows = allResults.map((r) =>
    [r.firstName, r.middleName, r.lastName, "", r.licNum, "", "FL", "CNA"].map((v) =>
      v.includes(",") ? `"${v}"` : v
    ).join(",")
  );

  fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
  console.log(`\n✅ CSV written to: ${csvPath}`);
  console.log(`   ${allResults.length} CNA candidates\n`);
  console.log("Preview (first 5 rows):");
  console.log(header);
  rows.slice(0, 5).forEach((r) => console.log(r));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
