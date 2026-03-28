/**
 * Manual browser test for Nursys QuickConfirm license verification.
 * Uses your REAL Chrome browser (not Puppeteer's Chromium) to bypass bot detection.
 *
 * Target: https://www.nursys.com/LQC/LQCSearch.aspx
 *
 * Usage:
 *   npx tsx scripts/test-nursys-browser.ts
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import path from "path";
import fs from "fs";
import os from "os";

puppeteer.use(StealthPlugin());

// ═══════════════════════════════════════════════════════════════
//  TEST DATA
// ═══════════════════════════════════════════════════════════════
const TEST_FIRST_NAME = "MARIA";
const TEST_LAST_NAME  = "JOHNSON";
const TEST_STATE      = "FLORIDA";
const TEST_LICENSE_NUM = "RN9458458";  // Actual FL license (EXPIRED — Null & Void)
// ═══════════════════════════════════════════════════════════════

const DELAY = 3000;
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let stepNum = 0;
async function snap(page: import("puppeteer").Page, label: string) {
  stepNum++;
  const filename = `nursys-${String(stepNum).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${filename}`);
  return filepath;
}

function findChrome(): string {
  const candidates = [
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Chrome not found!");
}

async function main() {
  const chromePath = findChrome();
  const tmpProfile = path.join(os.tmpdir(), "nursys-chrome-profile");

  console.log("\n🔍 Nursys QuickConfirm Browser Test");
  console.log("────────────────────────────────────");
  console.log(`  Name:    ${TEST_FIRST_NAME} ${TEST_LAST_NAME}`);
  console.log(`  State:   ${TEST_STATE}`);
  console.log(`  License: ${TEST_LICENSE_NUM}`);
  console.log(`  Chrome:  ${chromePath}`);
  console.log(`  Shots:   ${SCREENSHOT_DIR}`);
  console.log("────────────────────────────────────\n");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    userDataDir: tmpProfile,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,900",
    ],
    defaultViewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  try {
    // ── Step 1: Load LQC page (may redirect to terms) ─────────
    console.log("[1/5] Loading QuickConfirm page...");
    await page.goto("https://www.nursys.com/LQC/LQCSearch.aspx", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);

    if (/access\s+denied|blocked|error\s+15/i.test(pageText)) {
      console.error("  ✗ BLOCKED — IP may be temporarily banned");
      await snap(page, "blocked");
      await wait(10000);
      return;
    }

    console.log("  ✓ Page loaded");
    console.log("  URL:", currentUrl);
    await snap(page, "initial-page");
    await wait(DELAY);

    // ── Step 2: Handle terms page if redirected ────────────────
    if (/terms/i.test(currentUrl)) {
      console.log("[2/5] Terms page detected — accepting...");

      // Scroll down to look human
      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(1500);
      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(1000);

      // Try the known agree button ID, then fallback
      let agreeBtn = await page.$('#MainContent_lbtnContinue');
      if (!agreeBtn) {
        // Fallback: find any link/button with "agree" text
        agreeBtn = await page.evaluateHandle(() => {
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit']"))) {
            const text = ((el as HTMLInputElement).value || el.textContent || "").toLowerCase();
            if (text.includes("agree") || text.includes("accept") || text.includes("continue")) return el;
          }
          return null;
        }) as import("puppeteer").ElementHandle<Element> | null;
      }

      if (agreeBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
          agreeBtn.click(),
        ]);
        console.log("  ✓ Terms accepted");
        console.log("  URL:", page.url());
        await snap(page, "after-agree");

        const afterText = await page.evaluate(() => document.body.innerText);
        if (/access\s+denied|blocked/i.test(afterText)) {
          console.error("  ✗ Blocked after accepting terms");
          await snap(page, "blocked-after-agree");
          return;
        }
      } else {
        // Dump clickable elements for debugging
        const clickables = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a, button, input[type='submit']"))
            .map((el) => `${el.tagName} id="${el.id}" text="${el.textContent?.trim().slice(0, 60)}"`)
            .slice(0, 20);
        });
        console.log("  ✗ No agree button found. Clickables:", clickables);
        await snap(page, "error-no-agree");
        return;
      }

      await wait(DELAY);
    } else {
      console.log("[2/5] No terms page — already on search form");
    }

    // ── Step 3: Fill the search form ───────────────────────────
    console.log("[3/5] Filling search form...");

    // Log all form fields for debugging
    const formFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"))
        .map((el) => {
          const e = el as HTMLInputElement;
          return `${e.tagName} id="${e.id}" name="${e.name}" type="${e.type}"`;
        });
    });
    console.log("  Form fields:", formFields);
    await wait(1000);

    // Last name — try multiple selectors
    const lastNameTyped = await page.evaluate((val) => {
      const el = document.querySelector<HTMLInputElement>(
        '#MainContent_txtLastName, input[id*="LastName"], input[name*="LastName"]'
      );
      if (el) { el.focus(); el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); return el.id; }
      return null;
    }, TEST_LAST_NAME);
    if (lastNameTyped) {
      console.log(`  ✓ Last name: ${TEST_LAST_NAME} (#${lastNameTyped})`);
    } else {
      console.log("  ✗ Last name NOT FOUND");
    }
    await wait(500);

    // First name
    const firstNameTyped = await page.evaluate((val) => {
      const el = document.querySelector<HTMLInputElement>(
        '#MainContent_txtFirstName, input[id*="FirstName"], input[name*="FirstName"]'
      );
      if (el) { el.focus(); el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); return el.id; }
      return null;
    }, TEST_FIRST_NAME);
    if (firstNameTyped) {
      console.log(`  ✓ First name: ${TEST_FIRST_NAME} (#${firstNameTyped})`);
    } else {
      console.log("  ✗ First name NOT FOUND");
    }
    await wait(500);

    // License type — select RN (value="3")
    // ID from DevTools: MainContent_ddlLicenseTypeName
    const licTypeResult = await page.evaluate(() => {
      // Try the known ID first
      let sel = document.querySelector<HTMLSelectElement>('#MainContent_ddlLicenseTypeName');
      if (!sel) {
        // Fallback: find any select with RN/PN options
        for (const s of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
          if (Array.from(s.options).some((o) => o.text.trim() === "RN")) { sel = s; break; }
        }
      }
      if (!sel) return null;

      const opts = Array.from(sel.options).map((o) => ({ value: o.value, text: o.text.trim() }));
      // Find the RN option
      const rnOpt = opts.find((o) => o.text === "RN");
      if (rnOpt) {
        sel.value = rnOpt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return { id: sel.id, selected: rnOpt, options: opts };
      }
      return { id: sel.id, selected: null, options: opts };
    });
    if (licTypeResult?.selected) {
      console.log(`  ✓ License type: RN (value="${licTypeResult.selected.value}" via #${licTypeResult.id})`);
    } else {
      console.log("  ✗ License type NOT SET. Options:", licTypeResult?.options);
    }
    await wait(500);

    // State — select FLORIDA
    const stateResult = await page.evaluate((stateName) => {
      // Find select with state-like options
      for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
        const opts = Array.from(sel.options);
        if (!opts.some((o) => /ALABAMA|ALASKA|FLORIDA/i.test(o.text))) continue;

        const match = opts.find((o) => o.text.toUpperCase() === stateName.toUpperCase());
        if (match) {
          sel.value = match.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return { id: sel.id, selected: match.value, text: match.text };
        }
        return { id: sel.id, selected: null, options: opts.slice(0, 10).map((o) => `${o.value}="${o.text}"`) };
      }
      return null;
    }, TEST_STATE);
    if (stateResult?.selected) {
      console.log(`  ✓ State: ${stateResult.text} (via #${stateResult.id})`);
    } else {
      console.log("  ✗ State NOT SET.", stateResult);
    }
    await wait(500);

    await snap(page, "form-filled");
    await wait(DELAY);

    // ── Step 4: reCAPTCHA ──────────────────────────────────────
    console.log("[4/5] Handling reCAPTCHA...");

    const recaptchaFrame = await page.waitForSelector(
      'iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (recaptchaFrame) {
      const frame = await recaptchaFrame.contentFrame();
      if (frame) {
        await frame.waitForSelector('#recaptcha-anchor', { timeout: 5000 });
        await wait(1500);
        await frame.click('#recaptcha-anchor');
        console.log("  ✓ Clicked 'I'm not a robot'");
      }
    } else {
      console.log("  ⚠ No reCAPTCHA found — skipping");
    }

    await wait(2000);
    await snap(page, "captcha-clicked");

    // Wait for captcha to be solved (either auto-pass or user solves image challenge)
    console.log("  If image challenge appeared, solve it now...");
    console.log("  Waiting up to 60 seconds...\n");

    const captchaSolved = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"]');
          if (ta && ta.value.length > 0) { clearInterval(interval); resolve(true); }
          if (checks > 120) { clearInterval(interval); resolve(false); }
        }, 500);
      });
    });

    if (captchaSolved) {
      console.log("  ✓ reCAPTCHA solved!");
    } else {
      console.log("  ⚠ reCAPTCHA not solved — trying submit anyway...");
    }
    await snap(page, "captcha-done");
    await wait(1000);

    // ── Submit search ──────────────────────────────────────────
    console.log("  Submitting search...");

    // Try the known ID: MainContent_ibtnSearchName
    let searchBtn = await page.$('#MainContent_ibtnSearchName');
    if (!searchBtn) {
      // Fallback: any link/button with "Search" text
      searchBtn = await page.evaluateHandle(() => {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("a, button, input[type='submit']"))) {
          const text = ((el as HTMLInputElement).value || el.textContent || "").trim();
          if (/^\s*search\s*$/i.test(text)) return el;
        }
        return null;
      }) as import("puppeteer").ElementHandle<Element> | null;
    }

    if (searchBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
        searchBtn.click(),
      ]);
      console.log("  ✓ Search submitted");
    } else {
      console.log("  ✗ Search button NOT FOUND");
      await snap(page, "error-no-search-btn");
      return;
    }

    await snap(page, "search-results");
    await wait(DELAY);

    // ── Step 5: Parse results ──────────────────────────────────
    console.log("[5/5] Parsing results...");

    const bodyText = await page.evaluate(() => document.body.innerText);
    const html = await page.evaluate(() => document.body.innerHTML);

    if (/no\s+results?\s+found|no\s+records?\s+found|0\s+results?/i.test(bodyText)) {
      console.log("\n  ⚠ NO RESULTS FOUND.");
      console.log("  Page text:", bodyText.slice(0, 500));
      await snap(page, "no-results");
      await wait(30000);
      return;
    }

    // Try to extract NCSBN ID matches
    const matchRegex = /([A-Z][A-Z\s\-.']+?)\s+\[NCSBN\s+ID:\s*(\d+)\]/g;
    const matches: { name: string; ncsbnId: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = matchRegex.exec(html)) !== null) {
      matches.push({ name: m[1].trim(), ncsbnId: m[2] });
    }

    if (matches.length > 0) {
      console.log(`\n  Found ${matches.length} match(es):`);
      matches.forEach((match, i) => {
        console.log(`    ${i + 1}. ${match.name}  [NCSBN ID: ${match.ncsbnId}]`);
      });
    }

    // Try to extract table data (license info may be directly on the results page)
    const tableData = await page.evaluate(() => {
      const rows: Record<string, string>[] = [];
      document.querySelectorAll("table tr").forEach((tr, idx) => {
        if (idx === 0) return;
        const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
          (td as HTMLElement).innerText.replace(/\s+/g, " ").trim()
        );
        if (cells.length >= 4 && cells.some((c) => c.length > 0) && !/LAST|FIRST|LICENSE|TYPE|NAME/i.test(cells[0])) {
          rows.push(Object.fromEntries(cells.map((c, i) => [`col${i}`, c])));
        }
      });
      return rows;
    });

    if (tableData.length > 0) {
      console.log("\n  ═══ TABLE DATA ═══");
      tableData.forEach((row, i) => {
        console.log(`  Row ${i + 1}:`, row);
      });
    }

    // Try clicking into a report link
    const reportLink = await page.$('a[href*="ViewRpt"], a[href*="Report"], a[href*="ncsbnid"], a[href*="Detail"]');
    if (reportLink) {
      console.log("\n  Loading full report...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
        reportLink.click(),
      ]);
      await snap(page, "report");
      await wait(DELAY);

      await page.evaluate(() => window.scrollBy(0, 400));
      await wait(1000);
      await snap(page, "report-scrolled");

      // Extract license data from report
      const licenses = await page.evaluate(() => {
        const rows: Record<string, string>[] = [];
        document.querySelectorAll("table tr").forEach((tr, idx) => {
          if (idx === 0) return;
          const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
            (td as HTMLElement).innerText.replace(/\s+/g, " ").trim()
          );
          if (cells.length >= 7 && !/LAST|FIRST|LICENSE|TYPE/i.test(cells[0])) {
            rows.push({
              name: cells[0],
              type: cells[1],
              state: cells[2],
              licenseNumber: cells[3],
              active: cells[4],
              status: cells[5],
              issued: cells[6],
              expires: cells[7] || "",
              compact: cells[8] || "",
            });
          }
        });
        return rows;
      });

      if (licenses.length > 0) {
        console.log("\n  ═══ SCRAPED LICENSE DATA ═══");
        licenses.forEach((lic) => {
          console.log(`  ┌──────────────────────────────────────`);
          console.log(`  │ Name:       ${lic.name}`);
          console.log(`  │ Type:       ${lic.type}`);
          console.log(`  │ State:      ${lic.state}`);
          console.log(`  │ License #:  ${lic.licenseNumber}`);
          console.log(`  │ Active:     ${lic.active}`);
          console.log(`  │ Status:     ${lic.status}`);
          console.log(`  │ Issued:     ${lic.issued}`);
          console.log(`  │ Expires:    ${lic.expires}`);
          console.log(`  │ Compact:    ${lic.compact}`);
          console.log(`  └──────────────────────────────────────`);
        });
      }
    }

    // If no structured data found, dump page text
    if (matches.length === 0 && tableData.length === 0) {
      console.log("\n  Page text (first 1500 chars):");
      console.log(bodyText.slice(0, 1500));
    }

    // ── Download report PDF ─────────────────────────────────────
    const DOWNLOAD_DIR = path.join(SCREENSHOT_DIR, "..", "downloads");
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

    // Tell Chrome to download files to our folder
    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: path.resolve(DOWNLOAD_DIR),
    });

    const downloadBtn = await page.$('a[data-target="#infoDownloadReport"], a[onclick*="ClearDownload"]');
    if (downloadBtn) {
      console.log("\n  Clicking 'Download report'...");
      await downloadBtn.click();
      await wait(2000);
      await snap(page, "download-modal");

      // Log all buttons inside the modal for debugging
      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('#infoDownloadReport');
        if (!modal) return { found: false, html: "", buttons: [] as string[] };
        const btns = Array.from(modal.querySelectorAll<HTMLElement>("a, button, input[type='submit'], input[type='button']"));
        return {
          found: true,
          html: modal.innerHTML.slice(0, 500),
          buttons: btns.map((b) => `${b.tagName} id="${b.id}" text="${(b.textContent || "").trim().slice(0, 50)}" href="${(b as HTMLAnchorElement).href || ""}"`)
        };
      });
      console.log("  Modal found:", modalInfo.found);
      console.log("  Modal buttons:", modalInfo.buttons);

      // Click the download button inside the modal
      const downloadClicked = await page.evaluate(() => {
        const modal = document.querySelector('#infoDownloadReport');
        if (!modal) return null;
        const btns = Array.from(modal.querySelectorAll<HTMLElement>("a, button, input[type='submit'], input[type='button']"));
        // Priority: look for download/PDF/confirm
        for (const btn of btns) {
          const text = ((btn as HTMLInputElement).value || btn.textContent || "").toLowerCase();
          const href = ((btn as HTMLAnchorElement).href || "").toLowerCase();
          if (text.includes("download") || text.includes("pdf") || href.includes("download") || href.includes("pdf")) {
            btn.click();
            return `${btn.tagName}: "${text.trim().slice(0, 40)}"`;
          }
        }
        // Try confirm/ok/yes
        for (const btn of btns) {
          const text = ((btn as HTMLInputElement).value || btn.textContent || "").toLowerCase();
          if (text.includes("confirm") || text.includes("ok") || text.includes("yes") || text.includes("continue")) {
            btn.click();
            return `${btn.tagName}: "${text.trim().slice(0, 40)}"`;
          }
        }
        // Last resort: click first non-close button
        for (const btn of btns) {
          const text = ((btn as HTMLInputElement).value || btn.textContent || "").toLowerCase();
          if (!text.includes("close") && !text.includes("cancel")) {
            btn.click();
            return `${btn.tagName}: "${text.trim().slice(0, 40)}"`;
          }
        }
        return null;
      });

      if (downloadClicked) {
        console.log(`  ✓ Clicked: ${downloadClicked}`);
      } else {
        console.log("  ✗ No download button found in modal");
      }

      // Wait for the PDF to download
      console.log(`  Waiting for PDF in ${DOWNLOAD_DIR}...`);
      let pdfPath: string | null = null;
      for (let i = 0; i < 20; i++) {
        await wait(1000);
        const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".pdf"));
        if (files.length > 0) {
          pdfPath = path.join(DOWNLOAD_DIR, files[files.length - 1]);
          break;
        }
      }

      if (pdfPath) {
        // Move/copy PDF to scripts folder with a clear name
        const finalName = `nursys-report-${TEST_LAST_NAME}-${TEST_FIRST_NAME}.pdf`.toLowerCase();
        const finalPath = path.join(__dirname, finalName);
        fs.copyFileSync(pdfPath, finalPath);
        console.log(`\n  ✅ PDF downloaded: scripts/${finalName}`);
        console.log(`     Size: ${(fs.statSync(finalPath).size / 1024).toFixed(1)} KB`);
      } else {
        console.log("  ⚠ PDF not found after 20s — check browser downloads");
        await snap(page, "download-timeout");
      }
    } else {
      console.log("\n  ⚠ Download report button not found");
    }

    console.log("\n✅ Done! Browser stays open for 60 seconds.");
    console.log(`   Screenshots: ${SCREENSHOT_DIR}\n`);
    await wait(60000);

  } catch (err) {
    console.error("\n✗ Error:", err);
    await snap(page, "error").catch(() => {});
    await wait(30000);
  } finally {
    await browser.close();
  }
}

main();
