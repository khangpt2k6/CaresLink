/**
 * Browser-based verification with live screenshots.
 * Opens visible Chrome windows (in dev) so you can watch the verification happen,
 * captures screenshots at key steps, and embeds them into the PDF report.
 */

import puppeteer, { Browser, Page } from "puppeteer";

export interface VerificationScreenshot {
  label: string;
  url: string;
  dataUrl: string; // base64 PNG data URL
}

const IS_HEADLESS = process.env.NODE_ENV === "production";

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: IS_HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });
}

async function snap(page: Page, label: string): Promise<VerificationScreenshot> {
  await new Promise((r) => setTimeout(r, 800)); // brief render pause
  const buf = await page.screenshot({ type: "png", fullPage: false }) as Buffer;
  return {
    label,
    url: page.url(),
    dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
  };
}

// ─────────────────────────────────────────────────────────────
// 1.  NURSYS® — License Verification
// ─────────────────────────────────────────────────────────────
export async function captureNursysScreenshots(
  firstName: string,
  lastName: string,
  licenseState?: string | null,
  licenseNumber?: string | null
): Promise<VerificationScreenshot[]> {
  const shots: VerificationScreenshot[] = [];
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    // ── Step 1: Terms page ──────────────────────────────────
    await page.goto("https://www.nursys.com/NLV/NLVTerms.aspx", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    shots.push(await snap(page, "Nursys® — Terms & Conditions"));

    // Accept terms
    await page.click('input[name="btnAgree"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });
    shots.push(await snap(page, "Nursys® — License Search Form"));

    // ── Step 2: Fill search form ────────────────────────────
    await page.$eval(
      'input[name="txtLastName"]',
      (el, v) => ((el as HTMLInputElement).value = v),
      lastName.toUpperCase()
    );
    await page.$eval(
      'input[name="txtFirstName"]',
      (el, v) => ((el as HTMLInputElement).value = v),
      firstName.toUpperCase()
    );

    try { await page.select('select[name="ddlLicType"]', "RN"); } catch {}
    if (licenseState) {
      try { await page.select('select[name="ddlState"]', licenseState.toUpperCase()); } catch {}
    }
    if (licenseNumber) {
      try {
        await page.$eval(
          'input[name="txtLicNum"]',
          (el, v) => ((el as HTMLInputElement).value = v),
          licenseNumber
        );
      } catch {}
    }

    shots.push(await snap(page, "Nursys® — Search Form Filled"));

    // ── Step 3: Submit and capture results ─────────────────
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
      page.click('input[name="btnSearch"]'),
    ]);
    shots.push(await snap(page, "Nursys® — Search Results"));

    // ── Step 4: Click first result to see full report ──────
    const resultLink = await page.$('a[href*="NLVViewRpt"]');
    if (resultLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        resultLink.click(),
      ]);
      shots.push(await snap(page, "Nursys® — Full License Report"));

      // Scroll down to capture license table
      await page.evaluate(() => window.scrollBy(0, 400));
      await new Promise((r) => setTimeout(r, 600));
      shots.push(await snap(page, "Nursys® — License Details"));
    }
  } catch (err) {
    console.error("[browser-verify] Nursys error:", err);
  } finally {
    await browser.close();
  }

  return shots;
}

// ─────────────────────────────────────────────────────────────
// 2.  OIG Exclusion List
// ─────────────────────────────────────────────────────────────
export async function captureOIGScreenshots(
  firstName: string,
  lastName: string
): Promise<VerificationScreenshot[]> {
  const shots: VerificationScreenshot[] = [];
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.goto("https://exclusions.oig.hhs.gov/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    shots.push(await snap(page, "OIG Exclusion List — Search Form"));

    // Fill the form — try multiple selector strategies since it's a React SPA
    await page.evaluate(
      (first, last) => {
        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')
        );
        for (const input of inputs) {
          const key = (input.name + input.id + input.placeholder + (input.getAttribute("aria-label") || ""))
            .toLowerCase();
          if (!input.value && (key.includes("last") || key === "ln")) {
            input.value = last;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          } else if (!input.value && (key.includes("first") || key === "fn")) {
            input.value = first;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      },
      firstName.toUpperCase(),
      lastName.toUpperCase()
    );

    // Fallback: try known field IDs
    try { await page.$eval("#LAST_NAME", (el, v) => ((el as HTMLInputElement).value = v), lastName.toUpperCase()); } catch {}
    try { await page.$eval("#FIRST_NAME", (el, v) => ((el as HTMLInputElement).value = v), firstName.toUpperCase()); } catch {}

    await new Promise((r) => setTimeout(r, 500));
    shots.push(await snap(page, "OIG Exclusion List — Form Filled"));

    // Click the search/submit button
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button, input[type='submit']"));
      for (const btn of btns) {
        const text = (btn.textContent || btn.getAttribute("value") || "").toLowerCase();
        if (text.includes("search") || text.includes("submit") || text.includes("find")) {
          btn.click();
          return true;
        }
      }
      // Fallback: try any submit button
      const submit = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
      if (submit) { submit.click(); return true; }
      return false;
    });

    if (clicked) {
      // Wait for results to render
      await new Promise((r) => setTimeout(r, 4000));
      shots.push(await snap(page, "OIG Exclusion List — Results"));

      // Scroll to show results if they appeared below
      const hasResults = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes("result") ||
        document.querySelector("table") !== null
      );
      if (hasResults) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise((r) => setTimeout(r, 600));
        shots.push(await snap(page, "OIG Exclusion List — Results Detail"));
      }
    } else {
      // Try navigating with form submit
      await page.keyboard.press("Enter");
      await new Promise((r) => setTimeout(r, 3000));
      shots.push(await snap(page, "OIG Exclusion List — Results"));
    }
  } catch (err) {
    console.error("[browser-verify] OIG error:", err);
  } finally {
    await browser.close();
  }

  return shots;
}

// ─────────────────────────────────────────────────────────────
// 3.  Florida DOH — CNA License Verification
// ─────────────────────────────────────────────────────────────
interface FloridaDOHRow {
  name: string; licenseNumber: string; licenseType: string;
  status: string; expirationDate: string; county: string;
}

export interface FloridaDOHBrowserResult {
  screenshots: VerificationScreenshot[];
  matches: FloridaDOHRow[];
  found: boolean;
}

export async function captureFloridaDOHScreenshots(
  firstName: string,
  lastName: string,
  licenseNumber?: string | null
): Promise<FloridaDOHBrowserResult> {
  const shots: VerificationScreenshot[] = [];
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    const SEARCH_URL =
      "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";

    await page.goto(SEARCH_URL, { waitUntil: "networkidle2", timeout: 30000 });
    shots.push(await snap(page, "Florida DOH — MQA Search Form"));

    // Select Board of Nursing (17) and Certified Nursing Assistant profession (4401)
    try { await page.select('select[name="SearchDto.Board"]', "17"); } catch {}
    await new Promise((r) => setTimeout(r, 500)); // wait for profession list to update
    try { await page.select('select[name="SearchDto.Profession"]', "4401"); } catch {}

    // Fill last name
    try {
      await page.$eval(
        'input[name="SearchDto.LastName"]',
        (el, v) => ((el as HTMLInputElement).value = v),
        lastName.toUpperCase()
      );
    } catch {}

    // Fill first name
    try {
      await page.$eval(
        'input[name="SearchDto.FirstName"]',
        (el, v) => ((el as HTMLInputElement).value = v),
        firstName.toUpperCase()
      );
    } catch {}

    // Fill license number if provided (more precise match)
    if (licenseNumber) {
      try {
        await page.$eval(
          'input[name="SearchDto.LicenseNumber"]',
          (el, v) => ((el as HTMLInputElement).value = v),
          licenseNumber.trim()
        );
      } catch {}
    }

    await new Promise((r) => setTimeout(r, 500));
    shots.push(await snap(page, "Florida DOH — Form Filled"));

    // Submit the form
    const submitted = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'input[type="submit"][name*="Search"], input[type="submit"][value*="Search"], button[type="submit"]'
      );
      if (btn) { btn.click(); return true; }
      return false;
    });

    let matches: FloridaDOHRow[] = [];

    if (submitted) {
      await new Promise((r) => setTimeout(r, 3000));
      shots.push(await snap(page, "Florida DOH — Search Results"));

      // Extract table data from the results page
      matches = await page.evaluate(() => {
        const rows: FloridaDOHRow[] = [];
        document.querySelectorAll("table tr").forEach((tr, idx) => {
          if (idx === 0) return; // skip header
          const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
            td.innerText.replace(/\s+/g, " ").trim()
          );
          if (cells.length >= 4 && cells[0] && cells[1]) {
            rows.push({
              licenseNumber: cells[0] || "",
              name: cells[1] || "",
              licenseType: cells[2] || "",
              status: cells[4] || cells[3] || "",
              expirationDate: cells[5] || cells[4] || "",
              county: cells[6] || cells[5] || "",
            });
          }
        });
        return rows;
      });

      // Scroll to show results detail
      await page.evaluate(() => window.scrollBy(0, 300));
      await new Promise((r) => setTimeout(r, 600));
      shots.push(await snap(page, "Florida DOH — License Details"));
    }

    await browser.close();
    return { screenshots: shots, matches, found: matches.length > 0 };
  } catch (err) {
    console.error("[browser-verify] Florida DOH error:", err);
    await browser.close();
    return { screenshots: shots, matches: [], found: false };
  }
}

// ─────────────────────────────────────────────────────────────
// 4.  SAM.gov — Excluded Parties
// ─────────────────────────────────────────────────────────────
export async function captureSAMGovScreenshots(
  firstName: string,
  lastName: string
): Promise<VerificationScreenshot[]> {
  const shots: VerificationScreenshot[] = [];
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Navigate to SAM.gov exclusions search
    await page.goto(
      "https://sam.gov/search/?index=ei&page=1&sort=-score&sAMStatuses=Active&exclusionStatusFilter=Y",
      { waitUntil: "networkidle2", timeout: 30000 }
    );
    shots.push(await snap(page, "SAM.gov — Exclusions Search Page"));

    // Try to search by name
    try {
      const searchInput = await page.$(
        'input[placeholder*="Search"], input[type="search"], #search-input, [data-testid*="search"]'
      );
      if (searchInput) {
        await searchInput.click();
        await searchInput.type(`${firstName} ${lastName}`, { delay: 60 });
        await new Promise((r) => setTimeout(r, 1000));
        shots.push(await snap(page, "SAM.gov — Name Entered"));
        await page.keyboard.press("Enter");
        await new Promise((r) => setTimeout(r, 4000));
        shots.push(await snap(page, "SAM.gov — Search Results"));
      }
    } catch {}
  } catch (err) {
    console.error("[browser-verify] SAM.gov error:", err);
  } finally {
    await browser.close();
  }

  return shots;
}
