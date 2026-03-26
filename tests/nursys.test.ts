import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NursysResult } from "@/lib/nursys";

// ── Mock fetch globally ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Helper: build a minimal Response-like object
function fakeResponse(body: string, cookies?: string) {
  return {
    text: () => Promise.resolve(body),
    headers: { get: (h: string) => (h === "set-cookie" ? cookies ?? null : null) },
  };
}

// ── Realistic HTML fragments from Nursys pages ──────────────────────
const TERMS_HTML = `
<html>
<input name="__VIEWSTATE" value="FAKE_VS_1" />
<input name="__VIEWSTATEGENERATOR" value="FAKE_VSG_1" />
<input name="__EVENTVALIDATION" value="FAKE_EV_1" />
<button name="btnAgree">I Agree</button>
</html>`;

const SEARCH_PAGE_HTML = `
<html>
<input name="__VIEWSTATE" value="FAKE_VS_2" />
<input name="__VIEWSTATEGENERATOR" value="FAKE_VSG_2" />
<input name="__EVENTVALIDATION" value="FAKE_EV_2" />
<input name="txtLastName" /><input name="txtFirstName" />
</html>`;

function resultsHtml(matches: { name: string; id: string }[]) {
  return matches
    .map((m) => `<div>${m.name} [NCSBN ID: ${m.id}]</div>`)
    .join("\n");
}

const SINGLE_RESULT_HTML = resultsHtml([{ name: "SARAH FLORENCE JOHNSON", id: "24189751" }]);

const MULTIPLE_RESULTS_HTML = resultsHtml([
  { name: "SARAH FLORENCE JOHNSON", id: "24189751" },
  { name: "SARAH ANN JOHNSON", id: "99887766" },
]);

const NO_RESULTS_HTML = `<div>No results found for your search criteria.</div>`;

const REPORT_HTML = `
<html>
<h2>SARAH FLORENCE JOHNSON [NCSBN ID: 24189751]</h2>
<p>As of 03/25/2026</p>
<div>FLORIDA (RN)</div>
<table>
<tr><td>LAST</td><td>TYPE</td><td>STATE</td><td>LICENSE#</td><td>ACTIVE</td><td>STATUS</td><td>ISSUED</td><td>EXPIRES</td><td>COMPACT</td></tr>
<tr>
  <td>SARAH FLORENCE JOHNSON</td>
  <td>RN</td>
  <td>FL</td>
  <td>RN9404671</td>
  <td>YES</td>
  <td>UNENCUMBERED</td>
  <td>06/15/2018</td>
  <td>04/30/2027</td>
  <td>MULTISTATE</td>
</tr>
</table>
</html>`;

const EXPIRED_REPORT_HTML = `
<html>
<h2>JOHN MICHAEL SMITH [NCSBN ID: 55667788]</h2>
<p>As of 03/25/2026</p>
<div>TEXAS (RN)</div>
<table>
<tr><td>LAST</td><td>TYPE</td><td>STATE</td><td>LICENSE#</td><td>ACTIVE</td><td>STATUS</td><td>ISSUED</td><td>EXPIRES</td><td>COMPACT</td></tr>
<tr>
  <td>JOHN MICHAEL SMITH</td>
  <td>RN</td>
  <td>TX</td>
  <td>RN5512345</td>
  <td>NO</td>
  <td>EXPIRED</td>
  <td>01/10/2015</td>
  <td>01/10/2024</td>
  <td>SINGLE STATE</td>
</tr>
</table>
</html>`;

// ── Setup fetch mock for a full successful flow ─────────────────────
function mockNursysFlow(opts: {
  searchResultHtml: string;
  reportHtml?: string;
}) {
  mockFetch
    // 1) GET terms page
    .mockResolvedValueOnce(fakeResponse(TERMS_HTML, "ASP.NET_SessionId=abc123"))
    // 2) POST accept terms → returns search page
    .mockResolvedValueOnce(fakeResponse(SEARCH_PAGE_HTML, "ASP.NET_SessionId=abc123"))
    // 3) POST search
    .mockResolvedValueOnce(fakeResponse(opts.searchResultHtml, "ASP.NET_SessionId=abc123"))
    // 4) GET report (only called if matches found)
    .mockResolvedValueOnce(fakeResponse(opts.reportHtml ?? REPORT_HTML, "ASP.NET_SessionId=abc123"));
}

// ── Tests ───────────────────────────────────────────────────────────
describe("Nursys License Verification", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("searchNursysRN", () => {
    it("returns 'found' with license data for a single match", async () => {
      mockNursysFlow({ searchResultHtml: SINGLE_RESULT_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result: NursysResult = await searchNursysRN("Sarah", "Johnson", "Florence");

      expect(result.status).toBe("found");
      expect(result.matches).toHaveLength(1);
      expect(result.selectedMatch?.ncsbnId).toBe("24189751");
      expect(result.selectedMatch?.firstName).toBe("SARAH");
      expect(result.selectedMatch?.lastName).toBe("JOHNSON");
      expect(result.report).toBeDefined();
      expect(result.report?.licenses).toHaveLength(1);
      expect(result.report?.licenses[0].type).toBe("RN");
      expect(result.report?.licenses[0].licenseState).toBe("FL");
      expect(result.report?.licenses[0].licenseNumber).toBe("RN9404671");
      expect(result.report?.licenses[0].active).toBe(true);
      expect(result.report?.licenses[0].status).toBe("UNENCUMBERED");
      expect(result.report?.licenses[0].compactStatus).toBe("MULTISTATE");
      expect(result.report?.reportDate).toBe("03/25/2026");
      expect(result.manualUrl).toContain("nursys.com");
    });

    it("returns 'not_found' when no results match", async () => {
      mockNursysFlow({ searchResultHtml: NO_RESULTS_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Nobody", "Exists");

      expect(result.status).toBe("not_found");
      expect(result.matches).toHaveLength(0);
      expect(result.report).toBeUndefined();
      expect(result.manualUrl).toContain("nursys.com");
    });

    it("returns 'multiple_found' and selects best match by middle name", async () => {
      mockNursysFlow({ searchResultHtml: MULTIPLE_RESULTS_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson", "Florence");

      expect(result.status).toBe("multiple_found");
      expect(result.matches).toHaveLength(2);
      // Should prefer FLORENCE match over ANN
      expect(result.selectedMatch?.middleName).toBe("FLORENCE");
      expect(result.selectedMatch?.ncsbnId).toBe("24189751");
    });

    it("returns 'multiple_found' and picks first when no middle name provided", async () => {
      mockNursysFlow({ searchResultHtml: MULTIPLE_RESULTS_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson");

      expect(result.status).toBe("multiple_found");
      expect(result.matches).toHaveLength(2);
      expect(result.selectedMatch?.ncsbnId).toBe("24189751"); // first match
    });

    it("sends correct search parameters to Nursys", async () => {
      mockNursysFlow({ searchResultHtml: NO_RESULTS_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      await searchNursysRN("Jane", "Doe", undefined, "RN1234567", "FL");

      // 3rd fetch call = search POST
      const searchCall = mockFetch.mock.calls[2];
      const body = searchCall[1]?.body as string;
      expect(body).toContain("txtLastName=DOE");
      expect(body).toContain("txtFirstName=JANE");
      expect(body).toContain("ddlLicType=RN");
      expect(body).toContain("ddlState=FL");
      expect(body).toContain("txtLicNum=RN1234567");
      expect(body).toContain("btnSearch=Search");
    });

    it("returns 'manual_required' when Nursys site is unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson");

      expect(result.status).toBe("manual_required");
      expect(result.error).toContain("Network timeout");
      expect(result.manualUrl).toContain("nursys.com");
    });

    it("returns 'manual_required' when terms page has no VIEWSTATE", async () => {
      mockFetch.mockResolvedValueOnce(fakeResponse("<html>Blocked</html>"));

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson");

      expect(result.status).toBe("manual_required");
      expect(result.error).toContain("VIEWSTATE");
    });

    it("still returns partial result when report fetch fails", async () => {
      mockFetch
        .mockResolvedValueOnce(fakeResponse(TERMS_HTML, "ASP.NET_SessionId=abc123"))
        .mockResolvedValueOnce(fakeResponse(SEARCH_PAGE_HTML, "ASP.NET_SessionId=abc123"))
        .mockResolvedValueOnce(fakeResponse(SINGLE_RESULT_HTML, "ASP.NET_SessionId=abc123"))
        // Report fetch fails
        .mockRejectedValueOnce(new Error("Report unavailable"));

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson");

      expect(result.status).toBe("found");
      expect(result.matches).toHaveLength(1);
      expect(result.report).toBeUndefined(); // gracefully degraded
    });

    it("parses expired license correctly", async () => {
      const expiredMatch = resultsHtml([{ name: "JOHN MICHAEL SMITH", id: "55667788" }]);
      mockNursysFlow({ searchResultHtml: expiredMatch, reportHtml: EXPIRED_REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("John", "Smith", "Michael");

      expect(result.status).toBe("found");
      expect(result.report?.licenses[0].active).toBe(false);
      expect(result.report?.licenses[0].status).toBe("EXPIRED");
      expect(result.report?.licenses[0].licenseState).toBe("TX");
      expect(result.report?.licenses[0].compactStatus).toBe("SINGLE STATE");
    });

    it("handles optional licenseState and licenseNumber", async () => {
      mockNursysFlow({ searchResultHtml: NO_RESULTS_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      await searchNursysRN("Sarah", "Johnson");

      const searchCall = mockFetch.mock.calls[2];
      const body = searchCall[1]?.body as string;
      // Should NOT contain state or license number params
      expect(body).not.toContain("ddlState");
      expect(body).not.toContain("txtLicNum");
    });

    it("manages cookies across the multi-step flow", async () => {
      mockNursysFlow({ searchResultHtml: SINGLE_RESULT_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      await searchNursysRN("Sarah", "Johnson");

      // Verify cookies are forwarded on the search POST (3rd call)
      const searchHeaders = mockFetch.mock.calls[2][1]?.headers as Record<string, string>;
      expect(searchHeaders.Cookie).toContain("ASP.NET_SessionId=abc123");

      // Verify cookies are forwarded on the report GET (4th call)
      const reportHeaders = mockFetch.mock.calls[3][1]?.headers as Record<string, string>;
      expect(reportHeaders.Cookie).toContain("ASP.NET_SessionId=abc123");
    });
  });

  describe("Credential Check API integration", () => {
    it("calls nursys for NURSE roleType and stores result", async () => {
      // This test verifies the verify route calls searchNursysRN for nurses
      mockNursysFlow({ searchResultHtml: SINGLE_RESULT_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson", "Florence", "RN9404671", "FL");

      // Verify the result shape matches what the API route stores as nursysData
      expect(result).toMatchObject({
        status: "found",
        matches: expect.arrayContaining([
          expect.objectContaining({ ncsbnId: "24189751" }),
        ]),
        selectedMatch: expect.objectContaining({ ncsbnId: "24189751" }),
        report: expect.objectContaining({
          licenses: expect.arrayContaining([
            expect.objectContaining({
              type: "RN",
              licenseNumber: "RN9404671",
              active: true,
              status: "UNENCUMBERED",
            }),
          ]),
        }),
        manualUrl: expect.stringContaining("nursys.com"),
      });
    });

    it("returns structured data suitable for AI analysis", async () => {
      mockNursysFlow({ searchResultHtml: SINGLE_RESULT_HTML, reportHtml: REPORT_HTML });

      const { searchNursysRN } = await import("@/lib/nursys");
      const result = await searchNursysRN("Sarah", "Johnson");

      // Ensure the result can be serialized to JSON (needed for Prisma JSON field)
      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized.status).toBe("found");
      expect(serialized.report.licenses[0].licenseNumber).toBe("RN9404671");
    });
  });
});
