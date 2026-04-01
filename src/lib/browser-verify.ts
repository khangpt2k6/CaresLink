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

/** Launch browser — always headless. CapSolver REST API works without the extension.
 *  Pass forceVisible=true only for local debugging (not used in normal flow). */
async function launchBrowser(forceVisible = false, _withCapsolver = false): Promise<Browser> {
  const chromePath = findChrome();
  const tmpProfile = path.join(os.tmpdir(), "careslink-chrome-profile");

  // Always headless — CapSolver REST API solves CAPTCHAs server-side, no extension needed
  const headless = forceVisible ? false : true;

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

  if (chromePath) {
    return puppeteer.launch({
      headless,
      executablePath: chromePath,
      userDataDir: tmpProfile,
      args: baseArgs,
      defaultViewport: headless ? { width: 1280, height: 900 } : null,
      ignoreDefaultArgs: ["--enable-automation"],
      protocolTimeout: 120_000,
    });
  }

  // Fallback: Puppeteer's bundled Chromium
  return puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", ...baseArgs],
    defaultViewport: { width: 1280, height: 900 },
    protocolTimeout: 120_000,
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

      // Inject the token and trigger reCAPTCHA solved state
      await page.evaluate((t: string) => {
        // Set ALL g-recaptcha-response textareas (some pages have multiple)
        document.querySelectorAll<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"]').forEach((ta) => {
          ta.value = t;
        });

        // Method 1: data-callback attribute on the .g-recaptcha div
        try {
          const cb = document.querySelector('.g-recaptcha')?.getAttribute('data-callback');
          if (cb && typeof (window as any)[cb] === 'function') {
            (window as any)[cb](t);
            return; // callback fired — it should handle form state
          }
        } catch {}

        // Method 2: Find callback inside grecaptcha internal config
        try {
          const cfg = (window as any).___grecaptcha_cfg;
          if (cfg?.clients) {
            for (const cid of Object.keys(cfg.clients)) {
              const client = cfg.clients[cid];
              // Walk the nested objects to find a callback function
              for (const k1 of Object.keys(client)) {
                const v1 = client[k1];
                if (v1 && typeof v1 === 'object') {
                  for (const k2 of Object.keys(v1)) {
                    const v2 = v1[k2];
                    if (v2 && typeof v2 === 'object' && typeof v2.callback === 'function') {
                      v2.callback(t);
                      return;
                    }
                  }
                }
              }
            }
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

/** Solve Incapsula/Imperva bot detection via CapSolver REST API (AntiImpervaTaskProxyLess).
 *  Extracts the Incapsula reese84 script URL and cookies from the page, sends to CapSolver,
 *  polls for the solution cookies, then injects them into the browser. Returns true if solved. */
async function solveImpervaViaAPI(page: Page, pageUrl: string): Promise<boolean> {
  const apiKey = getCapsolverKey();
  if (!apiKey) return false;

  console.log("[browser-verify] Solving Incapsula/Imperva via CapSolver AntiImpervaTaskProxyLess...");

  // Step 1: Extract the reese84 script URL and current cookies from the page
  const pageData = await page.evaluate(() => {
    // Find the reese84 script — Imperva injects a script tag whose URL contains a long hex path
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let reeseScriptUrl: string | null = null;

    for (const s of scripts) {
      const src = (s as HTMLScriptElement).src;
      // reese84 scripts typically match patterns like /[hex]-[hex] or contain reese84
      if (/reese84/i.test(src) || /\/[a-f0-9]{20,}/i.test(src)) {
        reeseScriptUrl = src;
        break;
      }
    }

    // Also check inline scripts and HTML for the reese84 endpoint
    if (!reeseScriptUrl) {
      const html = document.documentElement.innerHTML;
      // Look for src="..." patterns that contain the reese84 path
      const scriptMatch = html.match(/src=["'](https?:\/\/[^"']*?(?:reese84|\/[a-f0-9]{32,})[^"']*?)["']/i);
      if (scriptMatch) reeseScriptUrl = scriptMatch[1];
    }

    // Also look for ___utmvc script
    if (!reeseScriptUrl) {
      const html = document.documentElement.innerHTML;
      const utmvcMatch = html.match(/src=["'](https?:\/\/[^"']*?___utmvc[^"']*?)["']/i);
      if (utmvcMatch) reeseScriptUrl = utmvcMatch[1];
    }

    return {
      reeseScriptUrl,
      cookies: document.cookie,
      userAgent: navigator.userAgent,
    };
  }).catch(() => null);

  if (!pageData) {
    console.log("[browser-verify] Failed to extract page data for Imperva solve");
    return false;
  }

  // Get cookies via CDP for more complete cookie access
  const client = await page.createCDPSession();
  const { cookies: cdpCookies } = await client.send("Network.getAllCookies");
  await client.detach();

  // Build cookies array for CapSolver
  const cookiesForApi = cdpCookies
    .filter((c: any) => {
      const domain = c.domain || "";
      return domain.includes("nursys") || domain.includes("incapsula") || domain.includes("imperva");
    })
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  console.log("[browser-verify] Imperva reese84 script URL:", pageData.reeseScriptUrl || "(not found)");
  console.log("[browser-verify] Cookies count:", cdpCookies.length);

  // Step 2: Create CapSolver task
  const taskPayload: any = {
    type: "AntiImpervaTaskProxyLess",
    websiteURL: pageUrl,
    userAgent: pageData.userAgent,
  };

  // Add reese84 script URL if found
  if (pageData.reeseScriptUrl) {
    // CapSolver expects the full script URL as "reeseScriptUrl" or in metadata
    taskPayload.reeseScriptUrl = pageData.reeseScriptUrl;
  }

  // Add cookies if available
  if (cookiesForApi) {
    taskPayload.cookies = cookiesForApi;
  }

  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: taskPayload,
    }),
  });
  const createData = await createRes.json() as any;

  if (createData.errorId && createData.errorId !== 0) {
    console.log("[browser-verify] CapSolver Imperva createTask error:", createData.errorDescription || createData.errorCode);
    return false;
  }

  const taskId = createData.taskId;
  if (!taskId) {
    console.log("[browser-verify] CapSolver Imperva returned no taskId:", JSON.stringify(createData));
    return false;
  }
  console.log("[browser-verify] CapSolver Imperva task created:", taskId);

  // Step 3: Poll for result (max 60s — Imperva solving can be slower)
  for (let elapsed = 0; elapsed < 60000; elapsed += 4000) {
    await wait(4000);
    const resultRes = await fetch("https://api.capsolver.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const resultData = await resultRes.json() as any;

    if (resultData.status === "ready") {
      const solution = resultData.solution;
      if (!solution) {
        console.log("[browser-verify] CapSolver Imperva returned ready but no solution");
        return false;
      }
      console.log("[browser-verify] CapSolver solved Imperva! Injecting cookies...");

      // Step 4: Inject the solution cookies into the browser
      // CapSolver returns cookies that bypass Incapsula (reese84, visid_incap, incap_ses, etc.)
      const solutionCookies: Record<string, string> = {};

      // Handle different solution formats from CapSolver
      if (solution.cookies) {
        // cookies may be an object { name: value } or array
        if (Array.isArray(solution.cookies)) {
          for (const c of solution.cookies) {
            if (c.name && c.value) solutionCookies[c.name] = c.value;
          }
        } else if (typeof solution.cookies === "object") {
          Object.assign(solutionCookies, solution.cookies);
        }
      }
      // Also check for individual cookie fields
      if (solution.reese84) solutionCookies["reese84"] = solution.reese84;
      if (solution.visid_incap) solutionCookies["visid_incap"] = solution.visid_incap;
      if (solution.incap_ses) solutionCookies["incap_ses"] = solution.incap_ses;
      // Some solutions return a userAgent that must match
      if (solution.userAgent) {
        await page.setUserAgent(solution.userAgent);
      }

      // Inject cookies via CDP
      const cdp = await page.createCDPSession();
      const domain = new URL(pageUrl).hostname;
      for (const [name, value] of Object.entries(solutionCookies)) {
        if (!value) continue;
        await cdp.send("Network.setCookie", {
          name,
          value,
          domain: `.${domain}`,
          path: "/",
          httpOnly: false,
          secure: true,
        }).catch(() => {
          // Try without secure flag
          return cdp.send("Network.setCookie", {
            name,
            value,
            domain: `.${domain}`,
            path: "/",
          }).catch(() => {});
        });
        console.log(`[browser-verify] Injected cookie: ${name}=${value.slice(0, 30)}...`);
      }
      await cdp.detach();

      // Also inject via document.cookie as fallback
      await page.evaluate((cookies: Record<string, string>, dom: string) => {
        for (const [name, value] of Object.entries(cookies)) {
          document.cookie = `${name}=${value}; domain=.${dom}; path=/; secure`;
        }
      }, solutionCookies, domain).catch(() => {});

      // Step 5: Reload the page — the new cookies should bypass Incapsula
      console.log("[browser-verify] Reloading page with Imperva solution cookies...");
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch {
        console.log("[browser-verify] Navigation after cookie inject timed out — checking page...");
      }
      await wait(3000);

      // Verify we passed the security check
      const postText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
      const stillBlocked = /additional\s+security\s+check|click\s+to\s+verify|security\s+check\s+is\s+required/i.test(postText);
      if (!stillBlocked) {
        console.log("[browser-verify] Imperva security check bypassed via CapSolver!");
        return true;
      }

      console.log("[browser-verify] Page still shows security check after cookie injection — may need retry");
      return false;
    }

    if (resultData.errorId && resultData.errorId !== 0) {
      console.log("[browser-verify] CapSolver Imperva error:", resultData.errorDescription || resultData.errorCode);
      return false;
    }

    console.log(`[browser-verify] CapSolver Imperva polling... (${(elapsed / 1000 + 4).toFixed(0)}s)`);
  }

  console.log("[browser-verify] CapSolver Imperva timed out after 60s");
  return false;
}

// ─── Human-like mouse movement to bypass GeeTest / Incapsula ───

/** Generate a random number between min and max */
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Move mouse along a bezier-curved path to simulate human motion */
async function humanMouseMove(page: Page, toX: number, toY: number, steps = 25) {
  const from = await page.evaluate(() => ({ x: 0, y: 0 })); // start from origin
  // Use mouse.move with steps for smooth Bezier-like motion
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Add slight randomness to the path (simulates hand tremor)
    const jitterX = rand(-3, 3);
    const jitterY = rand(-2, 2);
    const x = Math.round(from.x + (toX - from.x) * t + jitterX * Math.sin(t * Math.PI));
    const y = Math.round(from.y + (toY - from.y) * t + jitterY * Math.sin(t * Math.PI));
    await page.mouse.move(x, y);
    await wait(rand(8, 30)); // random delay between each micro-movement
  }
}

/** Move mouse randomly around the page to build trust with bot detection */
async function randomMouseWander(page: Page, durationMs = 3000) {
  const viewport = await page.evaluate(() => ({
    w: window.innerWidth || 1280,
    h: window.innerHeight || 900,
  }));

  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {
    const targetX = rand(50, viewport.w - 50);
    const targetY = rand(50, viewport.h - 50);
    const steps = rand(15, 35);
    await humanMouseMove(page, targetX, targetY, steps);
    // Pause randomly between movements (like a person reading the page)
    await wait(rand(200, 800));
  }
}

/** Try to solve Incapsula's "Click to verify" challenge by simulating human mouse behavior.
 *  Wanders the mouse around the page, then clicks the verify button.
 *  Returns true if the security check was passed. */
async function solveIncapsulaWithMouse(page: Page): Promise<boolean> {
  console.log("[browser-verify] Attempting Incapsula solve with human-like mouse movement...");

  // Wait for the page to fully render (Incapsula loads JS asynchronously)
  await wait(3000);

  // Step 1: Wander mouse randomly to build trust with bot detection
  await randomMouseWander(page, rand(2000, 4000));

  // Step 2: Find the "Click to verify" button — search main frame AND all iframes
  // Incapsula often renders its challenge widget inside an iframe
  const findVerifyButton = () => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, div, span, input, label'));
    for (const el of candidates) {
      const text = (el.textContent || "").trim().toLowerCase();
      if (text.includes("click to verify") || text === "verify") {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: "text-match" };
        }
      }
    }
    const geeBtn = document.querySelector('.geetest_radar_btn, .geetest_btn');
    if (geeBtn) {
      const rect = geeBtn.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: "geetest" };
    }
    const challengeArea = document.querySelector('[class*="challenge"], [id*="challenge"], [class*="captcha"]');
    if (challengeArea) {
      const btn = challengeArea.querySelector('button, a, [role="button"], input[type="submit"]');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: "challenge-area" };
      }
    }
    return null;
  };

  // First try main frame
  let btnInfo = await page.evaluate(findVerifyButton).catch(() => null);

  // If not found in main frame, search inside iframes (Incapsula embeds its widget in iframes)
  if (!btnInfo) {
    console.log("[browser-verify] Button not in main frame — checking iframes...");
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      try {
        // Check if this frame contains the verify widget
        const frameResult = await frame.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, div, span, input, label'));
          for (const el of candidates) {
            const text = (el.textContent || "").trim().toLowerCase();
            if (text.includes("click to verify") || text === "verify") {
              const rect = el.getBoundingClientRect();
              if (rect.width > 10 && rect.height > 10) {
                return { w: rect.width, h: rect.height, found: "iframe-text-match" };
              }
            }
          }
          return null;
        }).catch(() => null);

        if (frameResult) {
          // Found the button inside an iframe — we need to get the iframe's position
          // on the main page, then calculate absolute coordinates
          const iframeHandle = await page.evaluateHandle((frameUrl: string) => {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            for (const iframe of iframes) {
              if (iframe.src === frameUrl || iframe.contentWindow) {
                return iframe;
              }
            }
            // Fallback: return the first iframe we find
            return iframes[0] || null;
          }, frame.url()).catch(() => null);

          if (iframeHandle) {
            const iframeRect = await (iframeHandle as any).evaluate((el: HTMLIFrameElement) => {
              const rect = el.getBoundingClientRect();
              return { x: rect.x, y: rect.y };
            }).catch(() => null);

            if (iframeRect) {
              // Get button position within the iframe
              const innerPos = await frame.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, div, span, input, label'));
                for (const el of candidates) {
                  const text = (el.textContent || "").trim().toLowerCase();
                  if (text.includes("click to verify") || text === "verify") {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 10 && rect.height > 10) {
                      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    }
                  }
                }
                return null;
              }).catch(() => null);

              if (innerPos) {
                btnInfo = {
                  x: iframeRect.x + innerPos.x,
                  y: iframeRect.y + innerPos.y,
                  found: "iframe-text-match",
                };
              }
            }
          }
          if (btnInfo) break;
        }
      } catch { /* frame may have detached */ }
    }
  }

  // Final fallback: look for the Incapsula checkbox/button by known selectors
  if (!btnInfo) {
    console.log("[browser-verify] Trying Incapsula-specific selectors...");
    btnInfo = await page.evaluate(() => {
      // Incapsula uses various selectors for its challenge widget
      const selectors = [
        'iframe[src*="geo.captcha-delivery"]',
        'iframe[src*="captcha"]',
        'iframe[src*="challenge"]',
        '#checkbox',
        '.checkbox',
        '[data-callback]',
        '#recaptcha-anchor',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 5 && rect.height > 5) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: `selector:${sel}` };
          }
        }
      }
      return null;
    }).catch(() => null);
  }

  if (!btnInfo) {
    console.log("[browser-verify] Could not find 'Click to verify' button on page");
    // Debug: log all iframes on page
    const iframeInfo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(f => ({
        src: f.src?.slice(0, 120),
        w: f.getBoundingClientRect().width,
        h: f.getBoundingClientRect().height,
      }));
    }).catch(() => []);
    console.log("[browser-verify] Iframes on page:", JSON.stringify(iframeInfo));
    return false;
  }
  console.log("[browser-verify] Found verify button via:", btnInfo.found);

  // Step 3: Move to the button with human-like curve + random offset
  const clickX = btnInfo.x + rand(-8, 8);
  const clickY = btnInfo.y + rand(-4, 4);
  await humanMouseMove(page, clickX, clickY, rand(20, 40));

  // Step 4: Small hesitation before click (like a human)
  await wait(rand(300, 700));

  // Step 5: Click
  await page.mouse.click(clickX, clickY);
  console.log("[browser-verify] Clicked verify button at", Math.round(clickX), Math.round(clickY));

  // Step 6: Wait and check if it passed (up to 20s)
  for (let elapsed = 0; elapsed < 20000; elapsed += 2000) {
    await wait(2000);
    try {
      const bodyText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
      const stillOnCheck = /additional\s+security\s+check|click\s+to\s+verify|security\s+check\s+is\s+required/i.test(bodyText);
      if (!stillOnCheck) {
        console.log("[browser-verify] Security check passed via mouse click!");
        return true;
      }
    } catch {
      // page.evaluate failed — page is navigating (good!)
      await wait(2000);
      return true;
    }
  }

  console.log("[browser-verify] Security check did not pass within 20s after clicking");
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
  // Check CapSolver API key availability (REST API, no extension needed)
  const HAS_CAPSOLVER = !!getCapsolverKey();
  const browser = await launchBrowser(); // headless — CapSolver REST API solves CAPTCHAs remotely

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
      // Fallback: on Nursys URL but no real page content loaded (security pages can serve at any URL)
      (!hasSearchForm && !hasTermsContent && currentUrl.includes("nursys.com"));
    const isHardBlocked = /access\s+denied|error\s+15/i.test(pageText) && !isSecurityCheck;

    // Detect Incapsula/Imperva bot protection (different from Cloudflare Turnstile)
    const isIncapsula = /_Incapsula_Resource|incapsula|imperva|reese84/i.test(pageHtml);

    if (isHardBlocked) {
      shots.push(await snap(page, "Nursys® — Access Denied"));
      return { screenshots: shots };
    }

    if (isSecurityCheck) {
      if (HAS_CAPSOLVER && !isIncapsula) {
        // Solve Cloudflare Turnstile via CapSolver REST API (only works for Turnstile, not Incapsula)
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
      } else if (HAS_CAPSOLVER && isIncapsula) {
        // Solve Incapsula/Imperva via CapSolver AntiImperva API first, then fall back to mouse
        console.log("[browser-verify] Incapsula/Imperva detected — solving via CapSolver AntiImperva API...");
        shots.push(await snap(page, "Nursys® — Incapsula Detected (CapSolver solving)"));

        let impervaSolved = await solveImpervaViaAPI(page, page.url());

        if (!impervaSolved) {
          // API failed — fall back to mouse simulation as backup
          console.log("[browser-verify] CapSolver Imperva API failed — falling back to mouse simulation...");
          shots.push(await snap(page, "Nursys® — Trying mouse simulation fallback"));

          for (let attempt = 0; attempt < 3 && !impervaSolved; attempt++) {
            if (attempt > 0) {
              console.log(`[browser-verify] Incapsula mouse retry ${attempt}/2 — wandering longer...`);
              await wait(rand(1500, 3000));
              await page.evaluate(() => window.scrollBy(0, Math.random() * 300)).catch(() => {});
              await wait(rand(500, 1000));
              await page.evaluate(() => window.scrollBy(0, -(Math.random() * 200))).catch(() => {});
            }

            impervaSolved = await solveIncapsulaWithMouse(page);

            if (impervaSolved) {
              console.log(`[browser-verify] Incapsula passed via mouse simulation (attempt ${attempt + 1})!`);
              await wait(3000);
              const postText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
              if (/additional\s+security\s+check|security\s+check\s+is\s+required/i.test(postText)) {
                try { await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
                await wait(2000);
              }
            }
          }
        }

        if (!impervaSolved) {
          console.log("[browser-verify] Incapsula could not be solved (API + mouse both failed)");
          notifyVerificationProgress("Nursys®", "timeout");
          shots.push(await snap(page, "Nursys® — Incapsula Auto-Solve Failed"));
          return { screenshots: shots };
        }
      } else {
        // No CapSolver available — try mouse simulation only
        if (isIncapsula) console.log("[browser-verify] Incapsula/Imperva detected (no CapSolver) — attempting mouse click...");

        let geetestPassed = false;

        {
          shots.push(await snap(page, "Nursys® — Waiting for Incapsula verify"));
          geetestPassed = await solveIncapsulaWithMouse(page);

          if (geetestPassed) {
            console.log("[browser-verify] Incapsula passed via mouse simulation — no human intervention needed!");
            await wait(3000);
            const postGeeTestText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
            const stillBlocked = /additional\s+security\s+check|security\s+check\s+is\s+required/i.test(postGeeTestText);
            if (stillBlocked) {
              try { await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
              await wait(2000);
            }
          }
        }

        if (!geetestPassed) {
          for (let retry = 1; retry <= 2 && !geetestPassed; retry++) {
            console.log(`[browser-verify] Incapsula retry ${retry}/2 — wandering longer before click...`);
            await wait(rand(1500, 3000));
            await page.evaluate(() => window.scrollBy(0, Math.random() * 300)).catch(() => {});
            await wait(rand(500, 1000));
            await page.evaluate(() => window.scrollBy(0, -(Math.random() * 200))).catch(() => {});

            geetestPassed = await solveIncapsulaWithMouse(page);

            if (geetestPassed) {
              console.log(`[browser-verify] Incapsula passed on retry ${retry}!`);
              await wait(3000);
              try { await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
              await wait(2000);
            }
          }

          if (!geetestPassed) {
            console.log("[browser-verify] Incapsula could not be solved automatically after 3 attempts");
            notifyVerificationProgress("Nursys®", "timeout");
            shots.push(await snap(page, "Nursys® — Incapsula Auto-Solve Failed"));
            return { screenshots: shots };
          }
        }
      }

      console.log("[browser-verify] Security check passed! Continuing...");
      notifyVerificationProgress("Nursys®", "passed");

      // Wait for the redirected page to fully settle — the page may have already navigated
      // during the polling loop, so waitForNavigation can miss it. Instead, wait for real
      // page content (Terms agree button or search form) to appear.
      await wait(2000);
      try {
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
      } catch {
        // Navigation may have already completed
      }

      // Wait for actual page content to render (up to 15s)
      let contentLoaded = false;
      for (let i = 0; i < 10; i++) {
        await wait(1500);
        const hasContent = await page.evaluate(() => {
          // Check for terms page agree button OR search form
          return !!(
            document.querySelector('#MainContent_lbtnContinue, a[id*="Continue"], a[id*="Agree"]') ||
            document.querySelector('#MainContent_txtLastName, input[id*="LastName"]') ||
            (document.body.innerText || "").length > 200
          );
        }).catch(() => false);
        if (hasContent) { contentLoaded = true; break; }
      }

      if (!contentLoaded) {
        console.log("[browser-verify] Page content did not load after security check — refreshing page...");
        // Security overlay may still be blocking DOM content. Reload to get fresh page.
        try {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
          await wait(2000);
          // Check again after reload
          const hasContentAfterReload = await page.evaluate(() => {
            return !!(
              document.querySelector('#MainContent_lbtnContinue, a[id*="Continue"], a[id*="Agree"]') ||
              document.querySelector('#MainContent_txtLastName, input[id*="LastName"]') ||
              (document.body.innerText || "").length > 200
            );
          }).catch(() => false);
          if (hasContentAfterReload) {
            contentLoaded = true;
            console.log("[browser-verify] Page loaded after refresh");
          } else {
            // Last resort: navigate directly to the Terms page
            console.log("[browser-verify] Still no content — navigating directly to Terms page...");
            await page.goto("https://www.nursys.com/LQC/LQCTerms.aspx", { waitUntil: "domcontentloaded", timeout: 15000 });
            await wait(2000);
          }
        } catch (e) {
          console.log("[browser-verify] Reload failed:", (e as Error).message);
        }
        if (!contentLoaded) {
          shots.push(await snap(page, "Nursys® — Page Not Loaded After Security Check"));
        }
      }
      console.log("[browser-verify] Post-security URL:", page.url());
    }

    // ── Step 2: Handle terms page if redirected ───────────────
    if (page.url().includes("Terms")) {
      shots.push(await snap(page, "Nursys® — Terms & Conditions"));

      // Try to find and click the agree button — retry up to 3 times with waits
      let agreeClicked: string | null = null;
      for (let attempt = 0; attempt < 3 && !agreeClicked; attempt++) {
        if (attempt > 0) {
          console.log(`[browser-verify] Agree button retry ${attempt + 1}/3 — waiting for content...`);
          await wait(3000);
          // Reload on 2nd retry if still can't find it
          if (attempt === 2) {
            try {
              await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
              await wait(2000);
            } catch {}
          }
        }

        // Scroll down before clicking agree
        await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
        await wait(300);

        // Find the agree button — try multiple strategies
        agreeClicked = await page.evaluate(() => {
          // Strategy 1: known ID
          const btn1 = document.querySelector<HTMLElement>("#MainContent_lbtnContinue");
          if (btn1) { btn1.click(); return "MainContent_lbtnContinue"; }

          // Strategy 2: checkbox + submit pattern (some ASP.NET forms use this)
          const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"][id*="chk"], input[type="checkbox"][id*="agree"], input[type="checkbox"][id*="Accept"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            // After checking the checkbox, look for submit button
            const submit = document.querySelector<HTMLElement>('input[type="submit"], button[type="submit"]');
            if (submit) { submit.click(); return `checkbox + submit`; }
          }

          // Strategy 3: any link/button containing "agree" or "continue"
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit'], input[type='button']"))) {
            const text = ((el as HTMLInputElement).value || el.textContent || "").toLowerCase();
            if (text.includes("agree") || text.includes("i agree") || text.includes("continue") || text.includes("accept")) {
              el.click();
              return `text: "${text.trim().slice(0, 40)}"`;
            }
          }
          return null;
        }).catch(() => null);
      }

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

      // Re-check for Incapsula in case it appears after terms
      let afterTermsHtml = "";
      try { afterTermsHtml = await page.evaluate(() => document.body.innerHTML); } catch {}
      const isIncapsulaAfterTerms = /_Incapsula_Resource|incapsula|imperva|reese84/i.test(afterTermsHtml);

      if (HAS_CAPSOLVER && !isIncapsulaAfterTerms) {
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
        if (isIncapsulaAfterTerms) console.log("[browser-verify] Incapsula/Imperva detected after terms — falling back to manual...");
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
    for (let i = 0; i < 8; i++) {
      const hasFields = await page.$('#MainContent_txtLastName, input[id*="LastName"]');
      if (hasFields) { formReady = true; break; }
      await wait(1500);
    }

    // If still not ready, try navigating directly to the search page
    if (!formReady) {
      console.log("[browser-verify] Search form not found — navigating directly to search page...");
      try {
        await page.goto("https://www.nursys.com/LQC/LQCSearch.aspx", { waitUntil: "domcontentloaded", timeout: 15000 });
        await wait(2000);
        // Check if we got redirected back to Terms (need to accept again)
        if (page.url().includes("Terms")) {
          console.log("[browser-verify] Redirected back to Terms — re-accepting...");
          await page.evaluate(() => {
            const btn = document.querySelector<HTMLElement>("#MainContent_lbtnContinue");
            if (btn) { btn.click(); return; }
            const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) checkbox.click();
            for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit']"))) {
              const text = ((el as HTMLInputElement).value || el.textContent || "").toLowerCase();
              if (text.includes("agree") || text.includes("continue") || text.includes("accept")) { el.click(); return; }
            }
          }).catch(() => {});
          try { await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
          await wait(2000);
        }
        const hasFields = await page.$('#MainContent_txtLastName, input[id*="LastName"]');
        if (hasFields) formReady = true;
      } catch (e) {
        console.log("[browser-verify] Direct navigation failed:", (e as Error).message);
      }
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
        // No CapSolver API key — cannot solve reCAPTCHA in headless mode
        console.log("[browser-verify] reCAPTCHA detected but no CAPSOLVER_API_KEY set — cannot solve in headless mode");
        notifyVerificationProgress("Nursys® reCAPTCHA", "timeout");
      }

      shots.push(await snap(page, "Nursys® — reCAPTCHA").catch(() => ({
        label: "Nursys® — reCAPTCHA (page navigating)", url: page.url(), dataUrl: "",
      })));
    }

    // ── Step 5: Submit search ─────────────────────────────────
    // reCAPTCHA callback may have already triggered form submission (ASP.NET postback).
    // Wait briefly for any in-flight navigation to settle before trying to click search.
    await wait(2000);

    // Check if already navigated away from search (callback auto-submitted)
    let stillOnSearch = page.url().includes("LQCSearch");
    if (stillOnSearch) {
      // Try waiting for a navigation that might be in progress
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 });
        stillOnSearch = page.url().includes("LQCSearch");
      } catch {
        // No navigation happened — we need to click the search button manually
      }
    }

    console.log("[browser-verify] After reCAPTCHA — still on search page:", stillOnSearch, "URL:", page.url());

    if (stillOnSearch) {
      // Click the search button explicitly
      const searchBtn = await page.$('#MainContent_ibtnSearchName').catch(() => null);
      console.log("[browser-verify] Search button found:", !!searchBtn);
      if (searchBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}),
          searchBtn.click(),
        ]);
        // ASP.NET postback may keep network busy — give page time to render results
        await wait(2000);
        console.log("[browser-verify] Search button clicked, now at:", page.url());
      } else {
        // Fallback: click any Search link/button
        console.log("[browser-verify] Search button not found — trying fallback...");
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

    // ── Step 6: Click the correct result for full report ───────
    // If we have a license number, find the row that matches it instead of clicking the first result.
    const resultLink = await page.evaluate((targetLicense: string | null) => {
      const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="ViewRpt"], a[href*="Report"], a[href*="ncsbnid"]'));
      if (allLinks.length === 0) return null;

      if (targetLicense) {
        // Walk up from each "View Report" link to find the one whose card/table contains the license number
        for (const link of allLinks) {
          const container = link.closest('div, tr, section, article')
            || link.parentElement?.parentElement?.parentElement;
          if (container && container.textContent?.includes(targetLicense)) {
            link.setAttribute('data-careslink-match', 'true');
            return 'matched';
          }
        }
        // Fallback: search all text blocks on the page for the license number and click the nearest link
        const body = document.body.innerText;
        if (body.includes(targetLicense)) {
          // License exists on page but we couldn't match it to a specific link — click first
          allLinks[0].setAttribute('data-careslink-match', 'true');
          return 'fallback-first';
        }
      }

      // No license number provided or not found — click first result
      allLinks[0].setAttribute('data-careslink-match', 'true');
      return 'first';
    }, licenseNumber ?? null);

    console.log("[browser-verify] Result selection:", resultLink, "| license filter:", licenseNumber ?? "none");

    const matchedLink = await page.$('a[data-careslink-match="true"]');
    if (matchedLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {}),
        matchedLink.click(),
      ]);
      await wait(2000);
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
