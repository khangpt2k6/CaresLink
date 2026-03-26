/**
 * Integration test for browser-verify.ts captureNursysScreenshots.
 * This actually launches the browser and hits nursys.com — same code path as
 * the verify route uses.
 *
 * Usage:
 *   npx tsx scripts/test-browser-verify.ts
 */

import path from "path";
import fs from "fs";

// We need to set up the module alias for @/ imports
// since this runs outside of Next.js
const tsconfig = require("../tsconfig.json");

async function main() {
  console.log("\n🧪 Testing captureNursysScreenshots from browser-verify.ts");
  console.log("──────────────────────────────────────────────────────\n");

  // Dynamic import to use the actual source file
  const { captureNursysScreenshots } = await import("../src/lib/browser-verify");

  console.log("Calling captureNursysScreenshots('MARIA', 'JOHNSON', 'FL', 'RN9458458')...\n");

  const startTime = Date.now();
  const screenshots = await captureNursysScreenshots("MARIA", "JOHNSON", "FL", "RN9458458");
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s — got ${screenshots.length} screenshot(s):\n`);

  screenshots.forEach((s, i) => {
    const sizeKB = (s.dataUrl.length * 0.75 / 1024).toFixed(1); // base64 → approx bytes
    console.log(`  ${i + 1}. "${s.label}"`);
    console.log(`     URL: ${s.url}`);
    console.log(`     Size: ~${sizeKB} KB`);
  });

  // Check if screenshots were also saved to disk
  const screenshotDir = path.join(__dirname, "screenshots");
  if (fs.existsSync(screenshotDir)) {
    const files = fs.readdirSync(screenshotDir).filter((f) => f.startsWith("verify-"));
    if (files.length > 0) {
      console.log(`\n  📁 Screenshots saved to scripts/screenshots/:`);
      files.forEach((f) => console.log(`     ${f}`));
    }
  }

  // Check for common issues
  console.log("\n── Diagnostics ──────────────────────────────────────");

  if (screenshots.length === 0) {
    console.log("  ✗ NO SCREENSHOTS — browser may have crashed immediately");
  }

  const blocked = screenshots.some((s) =>
    s.label.includes("Access Denied") || s.label.includes("Blocked")
  );
  if (blocked) {
    console.log("  ✗ BLOCKED BY WAF — Nursys detected automation");
    console.log("    Check scripts/screenshots/ for the error page");
  }

  const formNotFound = screenshots.some((s) => s.label.includes("Form Not Found"));
  if (formNotFound) {
    console.log("  ✗ FORM NOT FOUND — terms page navigation may have failed");
  }

  const hasSearchForm = screenshots.some((s) => s.label.includes("Search Form"));
  if (hasSearchForm) {
    console.log("  ✓ Search form was reached");
  }

  const hasResults = screenshots.some((s) => s.label.includes("Results"));
  if (hasResults) {
    console.log("  ✓ Search was submitted and results page captured");
  }

  const hasReport = screenshots.some((s) => s.label.includes("Report"));
  if (hasReport) {
    console.log("  ✓ Full license report was captured");
  }

  if (!blocked && !formNotFound && screenshots.length >= 3) {
    console.log("\n  ✅ Browser verification is working!");
  } else {
    console.log("\n  ⚠ Issues detected — check screenshots above");
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err);
  process.exit(1);
});
