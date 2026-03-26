/**
 * Browser-based verification with live screenshots.
 * Uses real Chrome with anti-detection flags to bypass bot detection on Nursys.
 * Opens a visible browser window in dev mode so you can watch/solve captchas.
 * Captures screenshots at key steps and embeds them into the PDF report.
 */

import puppeteer, { Browser, Page } from "puppeteer";
import path from "path";
import fs from "fs";
import os from "os";

export interface VerificationScreenshot {
  label: string;
  url: string;
  dataUrl: string; // base64 PNG data URL
}

const IS_PROD = process.env.NODE_ENV === "production";
const DELAY = 2000;
const SCREENSHOT_DIR = path.join(process.cwd(), "scripts", "screenshots");

// Ensure screenshots folder exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Find real Chrome on Windows/Mac/Linux */
function findChrome(): string | undefined {
  const candidates = [
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/** Launch browser — real Chrome in dev (visible), headless in prod */
async function launchBrowser(): Promise<Browser> {
  const chromePath = findChrome();
  const tmpProfile = path.join(os.tmpdir(), "careslink-chrome-profile");

  if (chromePath) {
    return puppeteer.launch({
      headless: IS_PROD,           // visible in dev so you can watch & solve captchas
      executablePath: chromePath,
      userDataDir: tmpProfile,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1280,900",
      ],
      defaultViewport: IS_PROD ? { width: 1280, height: 900 } : null,
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  // Fallback: Puppeteer's bundled Chromium
  return puppeteer.launch({
    headless: IS_PROD,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });
}

let snapCount = 0;
async function snap(page: Page, label: string): Promise<VerificationScreenshot> {
  await wait(800);
  const buf = await page.screenshot({ type: "png", fullPage: false }) as Buffer;

  // Also save to disk for debugging
  snapCount++;
  const filename = `verify-${String(snapCount).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  try { fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), buf); } catch {}

  return {
    label,
    url: page.url(),
    dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
  };
}

// ─────────────────────────────────────────────────────────────
// 1.  NURSYS® QuickConfirm — License Verification
//     Uses LQC URL + real Chrome + stealth (same as test-nursys-browser.ts)
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
    const page = (await browser.pages())[0] || await browser.newPage();

    // Remove automation traces
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // ── Step 1: Load LQC search page (may redirect to terms) ──
    await page.goto("https://www.nursys.com/LQC/LQCSearch.aspx", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check if blocked
    const pageText = await page.evaluate(() => document.body.innerText);
    if (/access\s+denied|blocked|error\s+15/i.test(pageText)) {
      shots.push(await snap(page, "Nursys® — Access Denied"));
      return shots;
    }

    // ── Step 2: Handle terms page if redirected ───────────────
    if (page.url().includes("Terms")) {
      shots.push(await snap(page, "Nursys® — Terms & Conditions"));

      // Scroll like a human
      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(1500);
      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(1000);

      // Find the agree button — try multiple strategies
      const agreeClicked = await page.evaluate(() => {
        // Strategy 1: known ID
        const btn1 = document.querySelector<HTMLElement>("#MainContent_lbtnContinue");
        if (btn1) { btn1.click(); return "MainContent_lbtnContinue"; }

        // Strategy 2: any link/button containing "agree" or "continue"
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit']"))) {
          const text = ((el as HTMLInputElement).value || el.textContent || "").toLowerCase();
          if (text.includes("agree") || text.includes("i agree") || text.includes("continue")) {
            el.click();
            return `text: "${text.trim().slice(0, 40)}"`;
          }
        }
        return null;
      });

      console.log("[browser-verify] Agree button:", agreeClicked || "NOT FOUND");

      if (agreeClicked) {
        // Wait for navigation after clicking agree
        try {
          await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });
        } catch {
          // Navigation might not trigger — wait and check URL
          await wait(3000);
        }
      }

      // Wait for the new page to fully load
      await wait(DELAY);
      console.log("[browser-verify] After agree URL:", page.url());
    }

    // Check if blocked after terms
    let afterTermsText = "";
    try { afterTermsText = await page.evaluate(() => document.body.innerText); } catch { await wait(2000); }
    if (/access\s+denied|blocked/i.test(afterTermsText)) {
      shots.push(await snap(page, "Nursys® — Blocked After Terms"));
      return shots;
    }

    // Check if form fields exist — if not, page may still be loading
    let formReady = false;
    for (let i = 0; i < 5; i++) {
      const hasFields = await page.$('#MainContent_txtLastName, input[id*="LastName"]');
      if (hasFields) { formReady = true; break; }
      await wait(2000);
    }

    if (!formReady) {
      console.error("[browser-verify] Search form not found after terms acceptance");
      shots.push(await snap(page, "Nursys® — Form Not Found"));
      return shots;
    }

    // ── Dismiss popups ──────────────────────────────────────────
    // 1) Cookie banner: "Accept All"
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button"))) {
        if (/accept\s*all/i.test(el.textContent || "")) { el.click(); return; }
      }
    }).catch(() => {});
    await wait(500);

    // 2) e-Notify promo modal: "No Thanks"
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, span"))) {
        if (/no\s*thanks/i.test(el.textContent || "")) { el.click(); return; }
      }
      // Also try the X close button on the modal
      const closeBtn = document.querySelector<HTMLElement>('.modal .close, [data-dismiss="modal"], button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    }).catch(() => {});
    await wait(1000);

    shots.push(await snap(page, "Nursys® — License Search Form"));

    // ── Step 3: Fill search form ──────────────────────────────
    // Last name — type like a human
    const lastInput = await page.$('#MainContent_txtLastName, input[id*="LastName"], input[name*="LastName"]');
    if (lastInput) {
      await lastInput.click();
      await wait(300);
      await lastInput.type(lastName.toUpperCase(), { delay: 100 });
    }
    await wait(500);

    // First name
    const firstInput = await page.$('#MainContent_txtFirstName, input[id*="FirstName"], input[name*="FirstName"]');
    if (firstInput) {
      await firstInput.click();
      await wait(300);
      await firstInput.type(firstName.toUpperCase(), { delay: 100 });
    }
    await wait(500);

    // License type = RN (find by option text)
    await page.evaluate(() => {
      for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
        const rnOpt = Array.from(sel.options).find((o) => o.text.trim() === "RN");
        if (rnOpt) { sel.value = rnOpt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); break; }
      }
    }).catch(() => {});
    await wait(500);

    // State — match by full name (e.g. "FLORIDA")
    if (licenseState) {
      await page.evaluate((state: string) => {
        for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
          const opts = Array.from(sel.options);
          if (!opts.some((o) => /ALABAMA|ALASKA|FLORIDA/i.test(o.text))) continue;
          const match = opts.find((o) => o.value.toUpperCase() === state || o.text.toUpperCase().includes(state));
          if (match) { sel.value = match.value; sel.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      }, licenseState.toUpperCase()).catch(() => {});
    }
    await wait(500);

    shots.push(await snap(page, "Nursys® — Search Form Filled"));
    await wait(DELAY);

    // ── Step 4: Handle reCAPTCHA ──────────────────────────────
    const recaptchaFrame = await page.waitForSelector(
      'iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]',
      { timeout: 5000 }
    ).catch(() => null);

    if (recaptchaFrame) {
      const frame = await recaptchaFrame.contentFrame();
      if (frame) {
        await frame.waitForSelector('#recaptcha-anchor', { timeout: 5000 }).catch(() => {});
        await wait(1500);
        await frame.click('#recaptcha-anchor').catch(() => {});
      }

      // Wait for captcha to be solved (auto-pass or image challenge timeout)
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let checks = 0;
          const interval = setInterval(() => {
            checks++;
            const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"]');
            if ((ta && ta.value.length > 0) || checks > 40) { clearInterval(interval); resolve(); }
          }, 500);
        });
      });

      shots.push(await snap(page, "Nursys® — reCAPTCHA"));
    }

    // ── Step 5: Submit search ─────────────────────────────────
    const searchBtn = await page.$('#MainContent_ibtnSearchName');
    if (searchBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
        searchBtn.click(),
      ]);
    } else {
      // Fallback: click any Search link/button
      await page.evaluate(() => {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit']"))) {
          const text = ((el as HTMLInputElement).value || el.textContent || "").toLowerCase();
          if (text.includes("search") && !text.includes("reset")) { el.click(); return; }
        }
      });
      await wait(5000);
    }

    await wait(DELAY);
    shots.push(await snap(page, "Nursys® — Search Results"));

    // ── Step 6: Click first result for full report ────────────
    const resultLink = await page.$('a[href*="ViewRpt"], a[href*="Report"], a[href*="ncsbnid"]');
    if (resultLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
        resultLink.click(),
      ]);
      shots.push(await snap(page, "Nursys® — Full License Report"));

      // Scroll to license table
      await page.evaluate(() => window.scrollBy(0, 400));
      await wait(1000);
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

    await wait(500);
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
      const submit = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
      if (submit) { submit.click(); return true; }
      return false;
    });

    if (clicked) {
      await wait(4000);
      shots.push(await snap(page, "OIG Exclusion List — Results"));

      const hasResults = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes("result") ||
        document.querySelector("table") !== null
      );
      if (hasResults) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await wait(600);
        shots.push(await snap(page, "OIG Exclusion List — Results Detail"));
      }
    } else {
      await page.keyboard.press("Enter");
      await wait(3000);
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

    try {
      await page.$eval('input[name="SearchDto.LastName"]',
        (el, v) => ((el as HTMLInputElement).value = v), lastName.toUpperCase());
    } catch {}

    try {
      await page.$eval('input[name="SearchDto.FirstName"]',
        (el, v) => ((el as HTMLInputElement).value = v), firstName.toUpperCase());
    } catch {}

    if (licenseNumber) {
      try {
        await page.$eval('input[name="SearchDto.LicenseNumber"]',
          (el, v) => ((el as HTMLInputElement).value = v), licenseNumber.trim());
      } catch {}
    }

    await wait(500);

    const submitted = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'input[type="submit"][name*="Search"], input[type="submit"][value*="Search"], button[type="submit"]'
      );
      if (btn) { btn.click(); return true; }
      return false;
    });

    let matches: FloridaDOHRow[] = [];

    if (submitted) {
      await wait(3000);
      shots.push(await snap(page, "Florida DOH — Search Results"));

      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(600);
      shots.push(await snap(page, "Florida DOH — License Details"));

      matches = await page.evaluate((): FloridaDOHRow[] => {
        const rows: FloridaDOHRow[] = [];
        const bodyText = document.body.innerText;

        document.querySelectorAll("table tr").forEach((tr, idx) => {
          if (idx === 0) return;
          const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
            (td as HTMLElement).innerText.replace(/\s+/g, " ").trim()
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
        if (rows.length > 0) return rows;

        const get = (pattern: RegExp) => {
          const m = bodyText.match(pattern);
          return m ? m[1].trim() : "";
        };

        const licNum = get(/License(?:\s+Number)?[:\s]+([A-Z]{2,5}\d+)/i)
          || get(/\b((?:CNA|RN|LPN|APRN|MA)\d{4,})\b/);

        if (!licNum) return rows;

        const nameMatch = bodyText.match(/([A-Z][A-Z]+(?:\s+[A-Z][A-Z]*\.?){1,4})\s*\n/);
        const name = nameMatch ? nameMatch[1].trim() : "";

        const licType = get(/Profession[:\s]+([^\n]+)/i) || "Certified Nursing Assistant";
        const status  = get(/License\s+Status[:\s]+([^\n]+)/i);
        const expDate = get(/(?:License\s+)?Expiration\s+Date[:\s]+([^\n]+)/i);
        const county  = get(/County[:\s]+([^\n]+)/i);

        rows.push({ name, licenseNumber: licNum, licenseType: licType, status, expirationDate: expDate, county });
        return rows;
      });
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

    await page.goto(
      "https://sam.gov/search/?index=ei&page=1&sort=-score&sAMStatuses=Active&exclusionStatusFilter=Y",
      { waitUntil: "networkidle2", timeout: 30000 }
    );
    shots.push(await snap(page, "SAM.gov — Exclusions Search Page"));

    try {
      const searchInput = await page.$(
        'input[placeholder*="Search"], input[type="search"], #search-input, [data-testid*="search"]'
      );
      if (searchInput) {
        await searchInput.click();
        await searchInput.type(`${firstName} ${lastName}`, { delay: 60 });
        await wait(1000);
        shots.push(await snap(page, "SAM.gov — Name Entered"));
        await page.keyboard.press("Enter");
        await wait(4000);
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
