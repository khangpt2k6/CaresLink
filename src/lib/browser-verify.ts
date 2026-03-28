/**
 * Browser-based verification with live screenshots.
 * Uses real Chrome with anti-detection flags to bypass bot detection on Nursys.
 * Opens a visible browser window in dev mode so you can watch/solve captchas.
 * Captures screenshots at key steps and embeds them into the PDF report.
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import path from "path";
import fs from "fs";
import os from "os";
import AdmZip from "adm-zip";

// Apply stealth patches — hides webdriver, chrome.runtime, permissions, plugins, etc.
puppeteer.use(StealthPlugin());

// ── CapSolver Chrome Extension setup (lazy) ──────────────────────
// Prepares the CapSolver extension on first use, not at import time,
// so env vars loaded by Next.js or dotenv are available.
let capsolverExtensionPath: string | undefined;
let capsolverInitialized = false;

function getCapsolverKey(): string | undefined {
  return process.env.CAPSOLVER_API_KEY || undefined;
}

function ensureCapsolverExtension(): boolean {
  if (capsolverInitialized) return !!capsolverExtensionPath;
  capsolverInitialized = true;

  const apiKey = getCapsolverKey();
  if (!apiKey) {
    console.log("[browser-verify] No CAPSOLVER_API_KEY — CAPTCHAs require manual solving");
    return false;
  }

  try {
    const zipPath = path.join(
      __dirname, "..", "..", "node_modules",
      "puppeteer-extra-plugin-capsolver", "src", "resources",
      "capsolver-extension-v1.15.3.zip"
    );
    const altZipPath = path.join(
      process.cwd(), "node_modules",
      "puppeteer-extra-plugin-capsolver", "src", "resources",
      "capsolver-extension-v1.15.3.zip"
    );
    const resolvedZip = fs.existsSync(zipPath) ? zipPath : altZipPath;

    if (!fs.existsSync(resolvedZip)) {
      console.warn("[browser-verify] CapSolver extension zip not found — falling back to manual CAPTCHA solving");
      return false;
    }

    const extDir = path.join(os.tmpdir(), "capsolver-extension");
    if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
    new AdmZip(resolvedZip).extractAllTo(extDir, true);

    // Inject API key into extension config
    const configPath = path.join(extDir, "assets", "config.js");
    if (fs.existsSync(configPath)) {
      let config = fs.readFileSync(configPath, "utf8");
      config = config.replace(/apiKey: '',/, `apiKey: '${apiKey}',`);
      config = config.replace(/appId: '',/, `appId: 'F9E44D7F-A254-4D75-87F6-54B84EE16676',`);
      config = config.replace(/reCaptchaMode: 'token',/, `reCaptchaMode: 'click',`);
      config = config.replace(/useProxy: true,/, `useProxy: false,`);
      fs.writeFileSync(configPath, config);
    }

    // Add http://*/* permission to manifest so extension works on all sites
    const manifestPath = path.join(extDir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!manifest.permissions.includes("http://*/*")) {
        manifest.permissions.push("http://*/*");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      }
    }

    capsolverExtensionPath = extDir;
    console.log("[browser-verify] CapSolver extension prepared — CAPTCHAs will be auto-solved");
    return true;
  } catch (err) {
    console.warn("[browser-verify] Failed to prepare CapSolver extension:", err);
    return false;
  }
}
import { notifyCaptchaRequired, notifyVerificationProgress } from "./os-notify";

export interface VerificationScreenshot {
  label: string;
  url: string;
  dataUrl: string; // base64 PNG data URL
}

const IS_PROD = process.env.NODE_ENV === "production";
const DELAY = 500;
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

/** Launch browser — real Chrome in dev (visible), headless in prod.
 *  Pass forceVisible=true to always open visible (e.g. Nursys needs manual CAPTCHA).
 *  Pass withCapsolver=true to load the CapSolver extension (forces visible mode). */
async function launchBrowser(forceVisible = false, withCapsolver = false): Promise<Browser> {
  const chromePath = findChrome();
  const tmpProfile = path.join(os.tmpdir(), "careslink-chrome-profile");
  const loadExtension = withCapsolver && !!capsolverExtensionPath;

  // CapSolver extension requires visible mode (headless can't load extensions)
  const headless = (forceVisible || loadExtension) ? false : IS_PROD;

  const baseArgs = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,900",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ];

  // Inject CapSolver extension into Chrome launch args
  if (loadExtension) {
    const extPath = capsolverExtensionPath!.replace(/\\/g, "/");
    baseArgs.push(`--disable-extensions-except=${extPath}`);
    baseArgs.push(`--load-extension=${extPath}`);
  }

  if (chromePath) {
    return puppeteer.launch({
      headless,
      executablePath: chromePath,
      userDataDir: tmpProfile,
      args: baseArgs,
      defaultViewport: headless ? { width: 1280, height: 900 } : null,
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  // Fallback: Puppeteer's bundled Chromium
  return puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", ...baseArgs],
    defaultViewport: { width: 1280, height: 900 },
  });
}

/** Solve reCAPTCHA v2 via CapSolver REST API.
 *  Extracts the sitekey from the page, sends it to CapSolver, polls for the token,
 *  then injects the token into the page. Returns true if solved. */
async function solveRecaptchaViaAPI(page: Page, pageUrl: string): Promise<boolean> {
  const apiKey = getCapsolverKey();
  if (!apiKey) return false;

  // Extract the reCAPTCHA sitekey from the page
  const sitekey = await page.evaluate(() => {
    // Try the data-sitekey attribute on the reCAPTCHA div
    const div = document.querySelector('.g-recaptcha[data-sitekey], [data-sitekey]');
    if (div) return div.getAttribute('data-sitekey');
    // Try extracting from the iframe src
    const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement;
    if (iframe) {
      const match = iframe.src.match(/[?&]k=([^&]+)/);
      if (match) return match[1];
    }
    return null;
  }).catch(() => null);

  if (!sitekey) {
    console.log("[browser-verify] Could not extract reCAPTCHA sitekey from page");
    return false;
  }
  console.log("[browser-verify] reCAPTCHA sitekey:", sitekey);

  // Step 1: Create task
  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "ReCaptchaV2TaskProxyLess",
        websiteURL: pageUrl,
        websiteKey: sitekey,
      },
    }),
  });
  const createData = await createRes.json() as any;

  if (createData.errorId && createData.errorId !== 0) {
    console.log("[browser-verify] CapSolver createTask error:", createData.errorDescription || createData.errorCode);
    return false;
  }

  const taskId = createData.taskId;
  if (!taskId) {
    console.log("[browser-verify] CapSolver returned no taskId:", JSON.stringify(createData));
    return false;
  }
  console.log("[browser-verify] CapSolver task created:", taskId);

  // Step 2: Poll for result (max 60s)
  for (let elapsed = 0; elapsed < 60000; elapsed += 3000) {
    await wait(3000);
    const resultRes = await fetch("https://api.capsolver.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const resultData = await resultRes.json() as any;

    if (resultData.status === "ready") {
      const token = resultData.solution?.gRecaptchaResponse;
      if (!token) {
        console.log("[browser-verify] CapSolver returned ready but no token");
        return false;
      }
      console.log("[browser-verify] CapSolver solved reCAPTCHA! Token length:", token.length);

      // Inject the token into the page
      await page.evaluate((t: string) => {
        const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"]');
        if (ta) {
          ta.value = t;
          ta.style.display = "block"; // some forms check visibility
        }
        // Also try calling the callback if grecaptcha is available
        try {
          const cb = (document.querySelector('.g-recaptcha') as any)?.getAttribute('data-callback');
          if (cb && typeof (window as any)[cb] === 'function') {
            (window as any)[cb](t);
          }
        } catch {}
      }, token);
      return true;
    }

    if (resultData.errorId && resultData.errorId !== 0) {
      console.log("[browser-verify] CapSolver solve error:", resultData.errorDescription || resultData.errorCode);
      return false;
    }

    console.log(`[browser-verify] CapSolver polling... (${(elapsed / 1000 + 3).toFixed(0)}s)`);
  }

  console.log("[browser-verify] CapSolver solve timed out after 60s");
  return false;
}

/** Solve Cloudflare Turnstile via CapSolver REST API.
 *  Extracts the sitekey from the challenge page, sends to CapSolver, injects the token. */
async function solveTurnstileViaAPI(page: Page, pageUrl: string): Promise<boolean> {
  const apiKey = getCapsolverKey();
  if (!apiKey) return false;

  // Wait for Turnstile widget to appear — Cloudflare challenge pages load JS asynchronously
  console.log("[browser-verify] Waiting for Turnstile widget to load...");
  let sitekey: string | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    await wait(2000);

    sitekey = await page.evaluate(() => {
      // Method 1: div.cf-turnstile[data-sitekey]
      const div = document.querySelector('.cf-turnstile[data-sitekey], [data-sitekey]');
      if (div) return div.getAttribute('data-sitekey');

      // Method 2: iframe src from challenges.cloudflare.com
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of Array.from(iframes)) {
        if (iframe.src.includes('challenges.cloudflare.com') || iframe.src.includes('turnstile')) {
          const match = iframe.src.match(/[?&]k=([^&]+)/);
          if (match) return match[1];
        }
      }

      // Method 3: Extract from page HTML (script tags, inline JS)
      const html = document.documentElement.innerHTML;
      // Cloudflare embeds sitekey in various formats
      const patterns = [
        /sitekey['":\s]+['"]([0-9a-zA-Z_-]{20,})['"]/,
        /data-sitekey=['"]([0-9a-zA-Z_-]{20,})['"]/,
        /turnstile[^}]*?sitekey['":\s]+['"]([0-9a-zA-Z_-]{20,})['"]/,
        /chlApiSitekey['"]?\s*[:=]\s*['"]([0-9a-zA-Z_-]{20,})['"]/,
        /\bsiteKey['"]?\s*[:=]\s*['"]([0-9a-zA-Z_-]{20,})['"]/i,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }

      return null;
    }).catch(() => null);

    if (sitekey) break;

    // Log what we see on each attempt for debugging
    if (attempt === 2 || attempt === 5) {
      const debugInfo = await page.evaluate(() => ({
        title: document.title,
        textLen: (document.body.innerText || "").length,
        iframeCount: document.querySelectorAll("iframe").length,
        iframeSrcs: Array.from(document.querySelectorAll("iframe")).map(f => f.src).slice(0, 3),
        hasCfDiv: !!document.querySelector(".cf-turnstile, [data-sitekey]"),
      })).catch(() => null);
      console.log(`[browser-verify] Turnstile extraction attempt ${attempt + 1}:`, JSON.stringify(debugInfo));
    }
  }

  if (!sitekey) {
    console.log("[browser-verify] Could not extract Turnstile sitekey after 20s of waiting");
    return false;
  }
  console.log("[browser-verify] Turnstile sitekey:", sitekey);

  // Create task
  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "AntiTurnstileTaskProxyLess",
        websiteURL: pageUrl,
        websiteKey: sitekey,
      },
    }),
  });
  const createData = await createRes.json() as any;

  if (createData.errorId && createData.errorId !== 0) {
    console.log("[browser-verify] CapSolver Turnstile createTask error:", createData.errorDescription || createData.errorCode);
    return false;
  }

  const taskId = createData.taskId;
  if (!taskId) {
    console.log("[browser-verify] CapSolver Turnstile returned no taskId:", JSON.stringify(createData));
    return false;
  }
  console.log("[browser-verify] CapSolver Turnstile task created:", taskId);

  // Poll for result (max 30s — Turnstile is fast)
  for (let elapsed = 0; elapsed < 30000; elapsed += 3000) {
    await wait(3000);
    const resultRes = await fetch("https://api.capsolver.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const resultData = await resultRes.json() as any;

    if (resultData.status === "ready") {
      const token = resultData.solution?.token;
      if (!token) {
        console.log("[browser-verify] CapSolver Turnstile returned ready but no token");
        return false;
      }
      console.log("[browser-verify] CapSolver solved Turnstile! Token length:", token.length);

      // Inject the token into the Turnstile widget and trigger the callback
      await page.evaluate((t: string) => {
        // Set the hidden input value
        const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"], [name*="turnstile"]');
        if (input) input.value = t;
        // Try calling the Turnstile callback to submit
        try {
          const cfDiv = document.querySelector('.cf-turnstile');
          const cb = cfDiv?.getAttribute('data-callback');
          if (cb && typeof (window as any)[cb] === 'function') {
            (window as any)[cb](t);
          }
        } catch {}
        // Also try window.turnstile callback
        try {
          if ((window as any).turnstile) {
            // Some pages use turnstile.render callback
            const widgets = document.querySelectorAll('[data-turnstile-callback]');
            widgets.forEach((w) => {
              const cbName = w.getAttribute('data-turnstile-callback');
              if (cbName && typeof (window as any)[cbName] === 'function') {
                (window as any)[cbName](t);
              }
            });
          }
        } catch {}
      }, token);
      return true;
    }

    if (resultData.errorId && resultData.errorId !== 0) {
      console.log("[browser-verify] CapSolver Turnstile error:", resultData.errorDescription || resultData.errorCode);
      return false;
    }

    console.log(`[browser-verify] CapSolver Turnstile polling... (${(elapsed / 1000 + 3).toFixed(0)}s)`);
  }

  console.log("[browser-verify] CapSolver Turnstile timed out after 30s");
  return false;
}

let snapCount = 0;
async function snap(page: Page, label: string): Promise<VerificationScreenshot> {
  await wait(200);
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
export interface NursysBrowserLicense {
  nameOnLicense: string;
  type: string;
  licenseState: string;
  licenseNumber: string;
  active: boolean;
  status: string;
  originalIssueDate: string;
  expirationDate: string;
  compactStatus: string;
}

export interface NursysBrowserReport {
  ncsbnId: string;
  fullName: string;
  reportDate: string;
  licenses: NursysBrowserLicense[];
  boardMessages: string[];
  authorizedStates: string[];
}

export interface NursysBrowserResult {
  screenshots: VerificationScreenshot[];
  reportPdfPath?: string;
  reportPdfBase64?: string; // The downloaded Nursys PDF as base64 for DB storage
  report?: NursysBrowserReport; // Extracted license data from the report page
}

export async function captureNursysScreenshots(
  firstName: string,
  lastName: string,
  licenseState?: string | null,
  licenseNumber?: string | null
): Promise<NursysBrowserResult> {
  const shots: VerificationScreenshot[] = [];
  let reportPdfPath: string | undefined;
  let reportPdfBase64: string | undefined;
  let extractedReport: NursysBrowserReport | undefined;
  // Initialize CapSolver extension on first call (reads env vars lazily)
  const HAS_CAPSOLVER = ensureCapsolverExtension();
  const browser = await launchBrowser(true, HAS_CAPSOLVER); // visible + CapSolver extension if available

  try {
    const page = (await browser.pages())[0] || await browser.newPage();

    // Remove automation traces
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // ── Step 1: Load LQC search page (may redirect to terms or Cloudflare check) ──
    // Use "domcontentloaded" instead of "networkidle2" because Cloudflare security
    // pages keep making polling requests that prevent networkidle2 from resolving,
    // causing a timeout that kills the entire flow before we can detect the check.
    try {
      await page.goto("https://www.nursys.com/LQC/LQCSearch.aspx", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch {
      // Even if navigation times out, the page may still be usable
      console.log("[browser-verify] Initial navigation timeout — checking page state...");
    }
    // Give the page time to render (Cloudflare pages load content via JS)
    await wait(2500);

    // Check if security check / CAPTCHA page is showing
    let pageText = "";
    let pageHtml = "";
    try { pageText = await page.evaluate(() => document.body.innerText || ""); } catch {}
    try { pageHtml = await page.evaluate(() => document.body.innerHTML || ""); } catch {}
    const hasSearchForm = await page.$('#MainContent_txtLastName, input[id*="LastName"]').then((el) => !!el).catch(() => false);
    const hasTermsContent = await page.$('#MainContent_lbtnContinue, a[id*="Continue"], a[id*="Agree"]').then((el) => !!el).catch(() => false);
    const pageTitle = await page.title().catch(() => "");
    const currentUrl = page.url();

    // Log for debugging
    console.log("[browser-verify] Page URL:", currentUrl);
    console.log("[browser-verify] Page title:", pageTitle);
    console.log("[browser-verify] Has search form:", hasSearchForm);
    console.log("[browser-verify] Has terms content:", hasTermsContent);
    console.log("[browser-verify] Page text (first 200 chars):", pageText.slice(0, 200).replace(/\n/g, " "));

    const securityPatterns = /additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human|security\s+check\s+is\s+required|identified.*as\s+a\s+bot|automated\s+task|Incomplete/i;
    const securityHtmlPatterns = /turnstile|cf-challenge|challenge-platform|cloudflare/i;
    const isSecurityCheck =
      securityPatterns.test(pageText) ||
      securityPatterns.test(pageTitle) ||
      securityHtmlPatterns.test(pageHtml) ||
      // Fallback: on Nursys URL but no real page content loaded (Cloudflare can serve at any URL, including /Terms)
      (!hasSearchForm && !hasTermsContent && currentUrl.includes("nursys.com"));
    const isHardBlocked = /access\s+denied|error\s+15/i.test(pageText) && !isSecurityCheck;

    if (isHardBlocked) {
      shots.push(await snap(page, "Nursys® — Access Denied"));
      return { screenshots: shots };
    }

    if (isSecurityCheck) {
      if (HAS_CAPSOLVER) {
        // Solve Cloudflare Turnstile via CapSolver REST API
        console.log("[browser-verify] Security check detected — solving Turnstile via CapSolver API...");
        shots.push(await snap(page, "Nursys® — Security Check (CapSolver solving)"));

        const turnstileSolved = await solveTurnstileViaAPI(page, page.url());
        let passedCheck = false;

        if (turnstileSolved) {
          // Token injected — wait for the page to navigate past the challenge
          console.log("[browser-verify] Turnstile token injected — waiting for redirect...");
          for (let elapsed = 0; elapsed < 15000; elapsed += 2000) {
            await wait(2000);
            try {
              const currentText = await page.evaluate(() => document.body.innerText).catch(() => "");
              const stillOnCheck = /additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human|security\s+check\s+is\s+required/i.test(currentText);
              if (!stillOnCheck) { passedCheck = true; break; }
            } catch {
              await wait(2000);
              passedCheck = true;
              break;
            }
          }
        }

        if (!passedCheck) {
          console.log("[browser-verify] CapSolver did not solve Turnstile");
          notifyVerificationProgress("Nursys®", "timeout");
          shots.push(await snap(page, "Nursys® — Security Check Timed Out"));
          return { screenshots: shots };
        }
      } else {
        // No CapSolver — fall back to manual solving
        console.log("[browser-verify] Security check detected — waiting for manual verification...");
        notifyCaptchaRequired("Nursys®");

        try {
          await page.evaluate(() => {
            const overlay = document.createElement("div");
            overlay.id = "careslink-security-alert";
            overlay.innerHTML = `
              <div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;padding:14px 24px;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:10px;">
                <span style="font-size:22px;">🔒</span>
                <span>CaresLink: Please complete the security check below, then wait — automation will continue.</span>
              </div>
            `;
            document.body.appendChild(overlay);
          });
        } catch {}

        shots.push(await snap(page, "Nursys® — Security Check (waiting for you)"));

        let passedCheck = false;
        for (let elapsed = 0; elapsed < 120000; elapsed += 2000) {
          await wait(2000);
          try {
            const currentUrl = page.url();
            const currentText = await page.evaluate(() => document.body.innerText).catch(() => "");
            const stillOnCheck = /additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human/i.test(currentText);
            if (!stillOnCheck || currentUrl.includes("Terms") || currentUrl.includes("LQCSearch")) {
              if (!stillOnCheck) { passedCheck = true; break; }
            }
          } catch {
            await wait(2000);
            passedCheck = true;
            break;
          }
        }

        if (!passedCheck) {
          console.log("[browser-verify] Security check not completed within 120s");
          notifyVerificationProgress("Nursys®", "timeout");
          shots.push(await snap(page, "Nursys® — Security Check Timed Out"));
          return { screenshots: shots };
        }
      }

      console.log("[browser-verify] Security check passed! Continuing...");
      notifyVerificationProgress("Nursys®", "passed");

      // Wait for the redirected page to fully settle
      await wait(1000);
      try {
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 });
      } catch {
        // Navigation may have already completed
      }
      await wait(DELAY);
    }

    // ── Step 2: Handle terms page if redirected ───────────────
    if (page.url().includes("Terms")) {
      shots.push(await snap(page, "Nursys® — Terms & Conditions"));

      // Scroll down before clicking agree
      await page.evaluate(() => window.scrollBy(0, 600));
      await wait(300);

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
          await wait(1000);
        }
      }

      // Wait for the new page to fully load
      await wait(DELAY);
      console.log("[browser-verify] After agree URL:", page.url());
    }

    // Check if blocked after terms
    let afterTermsText = "";
    try { afterTermsText = await page.evaluate(() => document.body.innerText); } catch { await wait(500); }
    if (/access\s+denied|blocked/i.test(afterTermsText) && !/additional\s+security\s+check/i.test(afterTermsText)) {
      shots.push(await snap(page, "Nursys® — Blocked After Terms"));
      return { screenshots: shots };
    }

    // If security check appears after terms, wait for resolution
    if (/additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human/i.test(afterTermsText)) {
      let passedCheck = false;

      if (HAS_CAPSOLVER) {
        console.log("[browser-verify] Security check after terms — solving via CapSolver API...");
        const solved = await solveTurnstileViaAPI(page, page.url());
        if (solved) {
          for (let elapsed = 0; elapsed < 15000; elapsed += 2000) {
            await wait(2000);
            try {
              const currentText = await page.evaluate(() => document.body.innerText).catch(() => "");
              if (!/additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human/i.test(currentText)) {
                passedCheck = true; break;
              }
            } catch { await wait(2000); passedCheck = true; break; }
          }
        }
      } else {
        console.log("[browser-verify] Security check after terms — waiting for manual verification...");
        notifyCaptchaRequired("Nursys® (after terms)");

        try {
          await page.evaluate(() => {
            const overlay = document.createElement("div");
            overlay.id = "careslink-security-alert";
            overlay.innerHTML = `
              <div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;padding:14px 24px;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:10px;">
                <span style="font-size:22px;">🔒</span>
                <span>CaresLink: Please complete the security check below, then wait — automation will continue.</span>
              </div>
            `;
            document.body.appendChild(overlay);
          });
        } catch {}

        for (let elapsed = 0; elapsed < 120000; elapsed += 2000) {
          await wait(2000);
          try {
            const currentText = await page.evaluate(() => document.body.innerText).catch(() => "");
            if (!/additional\s+security\s+check|click\s+to\s+verify|verify\s+you\s+are\s+human/i.test(currentText)) {
              passedCheck = true; break;
            }
          } catch { await wait(2000); passedCheck = true; break; }
        }
      }

      if (!passedCheck) {
        notifyVerificationProgress("Nursys®", "timeout");
        shots.push(await snap(page, "Nursys® — Security Check Timed Out"));
        return { screenshots: shots };
      }

      console.log("[browser-verify] Security check passed after terms!");
      notifyVerificationProgress("Nursys®", "passed");
      await wait(DELAY);
    }

    // Check if form fields exist — if not, page may still be loading
    let formReady = false;
    for (let i = 0; i < 5; i++) {
      const hasFields = await page.$('#MainContent_txtLastName, input[id*="LastName"]');
      if (hasFields) { formReady = true; break; }
      await wait(800);
    }

    if (!formReady) {
      console.error("[browser-verify] Search form not found after terms acceptance");
      shots.push(await snap(page, "Nursys® — Form Not Found"));
      return { screenshots: shots };
    }

    // ── Dismiss popups ──────────────────────────────────────────
    // 1) Cookie banner: "Accept All"
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button"))) {
        if (/accept\s*all/i.test(el.textContent || "")) { el.click(); return; }
      }
    }).catch(() => {});
    await wait(200);

    // 2) e-Notify promo modal: "No Thanks"
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, span"))) {
        if (/no\s*thanks/i.test(el.textContent || "")) { el.click(); return; }
      }
      // Also try the X close button on the modal
      const closeBtn = document.querySelector<HTMLElement>('.modal .close, [data-dismiss="modal"], button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    }).catch(() => {});
    await wait(300);

    shots.push(await snap(page, "Nursys® — License Search Form"));

    // ── Step 3: Fill search form ──────────────────────────────
    // Last name — type like a human
    const lastInput = await page.$('#MainContent_txtLastName, input[id*="LastName"], input[name*="LastName"]');
    if (lastInput) {
      await lastInput.click();
      await lastInput.type(lastName.toUpperCase(), { delay: 30 });
    }

    // First name
    const firstInput = await page.$('#MainContent_txtFirstName, input[id*="FirstName"], input[name*="FirstName"]');
    if (firstInput) {
      await firstInput.click();
      await firstInput.type(firstName.toUpperCase(), { delay: 30 });
    }

    // License type = RN (find by option text)
    await page.evaluate(() => {
      for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
        const rnOpt = Array.from(sel.options).find((o) => o.text.trim() === "RN");
        if (rnOpt) { sel.value = rnOpt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); break; }
      }
    }).catch(() => {});

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

    shots.push(await snap(page, "Nursys® — Search Form Filled"));
    await wait(DELAY);

    // ── Step 4: Handle reCAPTCHA ──────────────────────────────
    const recaptchaFrame = await page.waitForSelector(
      'iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]',
      { timeout: 5000 }
    ).catch(() => null);

    if (recaptchaFrame) {
      if (HAS_CAPSOLVER) {
        // Solve reCAPTCHA v2 via CapSolver REST API
        console.log("[browser-verify] reCAPTCHA detected — solving via CapSolver API...");
        const solved = await solveRecaptchaViaAPI(page, page.url());
        if (solved) {
          console.log("[browser-verify] reCAPTCHA solved by CapSolver API!");
          notifyVerificationProgress("Nursys® reCAPTCHA", "passed");
        } else {
          console.log("[browser-verify] CapSolver API failed to solve reCAPTCHA");
          notifyVerificationProgress("Nursys® reCAPTCHA", "timeout");
        }
      } else {
        // No CapSolver — fall back to manual solving
        console.log("[browser-verify] reCAPTCHA detected — prompting user to solve it manually...");
        notifyCaptchaRequired("Nursys® reCAPTCHA");

        await page.evaluate(() => {
          const overlay = document.createElement("div");
          overlay.id = "careslink-captcha-alert";
          overlay.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e40af;color:#fff;padding:14px 24px;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:10px;">
              <span style="font-size:22px;">🔒</span>
              <span>CaresLink: Please complete the reCAPTCHA below, then wait — automation will continue.</span>
            </div>
          `;
          document.body.appendChild(overlay);
        });

        const captchaSolved = await page.evaluate(() => {
          return new Promise<boolean>((resolve) => {
            let elapsed = 0;
            const interval = setInterval(() => {
              elapsed += 1000;
              const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"]');
              if (ta && ta.value.length > 0) { clearInterval(interval); resolve(true); }
              if (elapsed >= 90000) { clearInterval(interval); resolve(false); }
            }, 1000);
          });
        });

        await page.evaluate(() => {
          document.getElementById("careslink-captcha-alert")?.remove();
        });

        if (captchaSolved) {
          console.log("[browser-verify] reCAPTCHA solved by user!");
          notifyVerificationProgress("Nursys® reCAPTCHA", "passed");
        } else {
          console.log("[browser-verify] reCAPTCHA not solved within 90s");
          notifyVerificationProgress("Nursys® reCAPTCHA", "timeout");
        }
      }

      shots.push(await snap(page, "Nursys® — reCAPTCHA").catch(() => ({
        label: "Nursys® — reCAPTCHA (page navigating)", url: page.url(), dataUrl: "",
      })));
    }

    // ── Step 5: Submit search ─────────────────────────────────
    // reCAPTCHA callback may have already triggered form submission (ASP.NET postback).
    // Wait briefly for any in-flight navigation to settle before trying to click search.
    await wait(1000);
    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 });
    } catch {
      // No navigation happened — we need to click the search button manually
    }

    // Only click search if we're still on the search page (not already navigated to results)
    const stillOnSearch = page.url().includes("LQCSearch");
    if (stillOnSearch) {
      const searchBtn = await page.$('#MainContent_ibtnSearchName').catch(() => null);
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
        }).catch(() => {});
        await wait(2000);
      }
    }

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
      await wait(300);
      shots.push(await snap(page, "Nursys® — License Details"));

      // ── Step 6b: Extract structured license data from the report page ──
      try {
        const rawReport = await page.evaluate(() => {
          const bodyText = document.body.innerText;

          // Extract NCSBN ID from page
          const ncsbnMatch = bodyText.match(/NCSBN\s*(?:ID)?[:\s#]*(\d+)/i);
          const ncsbnId = ncsbnMatch ? ncsbnMatch[1] : "";

          // Extract full name - usually in a heading or bold element near the top
          const nameEl = document.querySelector("h2, h3, .report-name, [class*='name']");
          let fullName = nameEl ? (nameEl as HTMLElement).innerText.trim() : "";
          if (!fullName) {
            const nameMatch = bodyText.match(/Name[:\s]+([A-Z][A-Z\s,.-]+)/i);
            fullName = nameMatch ? nameMatch[1].trim() : "";
          }

          // Extract report date
          const dateMatch = bodyText.match(/(?:Report\s+(?:Date|as\s+of)|Printed)[:\s]+([^\n]+)/i);
          const reportDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString();

          // Extract license table rows
          const licenses: { nameOnLicense: string; type: string; licenseState: string; licenseNumber: string; active: boolean; status: string; originalIssueDate: string; expirationDate: string; compactStatus: string; }[] = [];
          const tables = document.querySelectorAll("table");
          for (const table of Array.from(tables)) {
            const headers = Array.from(table.querySelectorAll("th, thead td")).map(
              (th) => (th as HTMLElement).innerText.trim().toLowerCase()
            );
            // Look for the license table by checking headers
            const hasLicenseHeaders = headers.some((h) => h.includes("license") || h.includes("type") || h.includes("status"));
            if (!hasLicenseHeaders && headers.length < 3) continue;

            const rows = table.querySelectorAll("tbody tr, tr:not(:first-child)");
            for (const row of Array.from(rows)) {
              const cells = Array.from(row.querySelectorAll("td")).map(
                (td) => (td as HTMLElement).innerText.replace(/\s+/g, " ").trim()
              );
              if (cells.length < 5) continue;
              // Skip header rows that sneaked in
              if (cells[0].toLowerCase().includes("name on license")) continue;

              licenses.push({
                nameOnLicense: cells[0] || "",
                type: cells[1] || "",
                licenseState: cells[2] || "",
                licenseNumber: cells[3] || "",
                active: /yes/i.test(cells[4] || ""),
                status: cells[5] || "",
                originalIssueDate: cells[6] || "",
                expirationDate: cells[7] || "",
                compactStatus: cells[8] || "NONE",
              });
            }
          }

          // Extract board messages
          const boardMessages: string[] = [];
          const msgSection = bodyText.match(/(?:Board|Nursing)\s+message.*?\n([\s\S]*?)(?=\n\s*\n|\s*Authorized|$)/i);
          if (msgSection) {
            const lines = msgSection[1].split("\n").map((l) => l.trim()).filter((l) => l.length > 10);
            boardMessages.push(...lines);
          }
          // Also try bullet points / list items in message area
          document.querySelectorAll("li, .board-message, [class*='message'] p").forEach((el) => {
            const text = (el as HTMLElement).innerText.trim();
            if (text.length > 20 && /board|nursing|notification|practitioner|license/i.test(text)) {
              if (!boardMessages.includes(text)) boardMessages.push(text);
            }
          });

          // Extract authorized states
          const authorizedStates: string[] = [];
          const statesMatch = bodyText.match(/Authorized.*?(?:Practice|States)[:\s]*([\s\S]*?)(?=\n\s*\n|Primary|Board|$)/i);
          if (statesMatch) {
            const stateAbbrs = statesMatch[1].match(/\b[A-Z]{2}\b/g);
            if (stateAbbrs) authorizedStates.push(...stateAbbrs);
          }

          if (licenses.length === 0 && !ncsbnId) return undefined;

          return { ncsbnId, fullName, reportDate, licenses, boardMessages, authorizedStates };
        });

        if (rawReport) {
          extractedReport = rawReport as NursysBrowserReport;
          console.log(`[browser-verify] Extracted ${extractedReport.licenses.length} license(s) from Nursys report page`);
        } else {
          console.log("[browser-verify] Could not extract structured data from Nursys report page");
        }
      } catch (err) {
        console.error("[browser-verify] Data extraction error:", err);
      }

      // ── Step 7: Download the Nursys PDF report ──────────────
      const DOWNLOAD_DIR = path.join(SCREENSHOT_DIR, "..", "downloads");
      if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

      // Clear old PDFs so we detect the new one
      for (const f of fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".pdf"))) {
        try { fs.unlinkSync(path.join(DOWNLOAD_DIR, f)); } catch {}
      }

      // Tell Chrome where to save downloads
      const client = await page.createCDPSession();
      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: path.resolve(DOWNLOAD_DIR),
      });

      // Click "Download report" button (opens modal)
      const downloadBtn = await page.$('a[data-target="#infoDownloadReport"], a[onclick*="ClearDownload"]');
      if (downloadBtn) {
        await downloadBtn.click();
        await wait(800);

        // In the modal: "Download full report" is pre-selected, click the Download button
        await page.evaluate(() => {
          const modal = document.querySelector("#infoDownloadReport");
          if (!modal) return;
          for (const btn of Array.from(modal.querySelectorAll<HTMLElement>("a, button"))) {
            const text = (btn.textContent || "").toLowerCase();
            if (text.includes("download") && !text.includes("close")) {
              btn.click();
              return;
            }
          }
        });

        console.log("[browser-verify] Waiting for Nursys PDF download...");

        // Wait for PDF to appear
        for (let i = 0; i < 15; i++) {
          await wait(1000);
          const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".pdf"));
          if (files.length > 0) {
            const srcPath = path.join(DOWNLOAD_DIR, files[0]);
            const destName = `nursys-report-${lastName}-${firstName}.pdf`.toLowerCase();
            const destPath = path.join(SCREENSHOT_DIR, destName);
            fs.copyFileSync(srcPath, destPath);
            reportPdfPath = destPath;
            reportPdfBase64 = fs.readFileSync(destPath).toString("base64");
            console.log(`[browser-verify] PDF saved: ${destPath} (${(fs.statSync(destPath).size / 1024).toFixed(1)} KB)`);
            break;
          }
        }

        if (!reportPdfPath) {
          console.log("[browser-verify] PDF download timed out");
        }

        shots.push(await snap(page, "Nursys® — Report Downloaded"));
      }
    }
  } catch (err) {
    console.error("[browser-verify] Nursys error:", err);
  } finally {
    await browser.close();
  }

  return { screenshots: shots, reportPdfPath, reportPdfBase64, report: extractedReport };
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

    await wait(200);
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
      await wait(1500);
      shots.push(await snap(page, "OIG Exclusion List — Results"));

      const hasResults = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes("result") ||
        document.querySelector("table") !== null
      );
      if (hasResults) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await wait(300);
        shots.push(await snap(page, "OIG Exclusion List — Results Detail"));
      }
    } else {
      await page.keyboard.press("Enter");
      await wait(1500);
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

    await wait(200);

    const submitted = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'input[type="submit"][name*="Search"], input[type="submit"][value*="Search"], button[type="submit"]'
      );
      if (btn) { btn.click(); return true; }
      return false;
    });

    let matches: FloridaDOHRow[] = [];

    if (submitted) {
      await wait(1500);
      shots.push(await snap(page, "Florida DOH — Search Results"));

      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(300);
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
        await searchInput.type(`${firstName} ${lastName}`, { delay: 30 });
        await wait(300);
        shots.push(await snap(page, "SAM.gov — Name Entered"));
        await page.keyboard.press("Enter");
        await wait(1500);
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
