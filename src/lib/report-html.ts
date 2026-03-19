import { VerificationScreenshot } from "./browser-verify";

interface NursysLicense {
  nameOnLicense: string; type: string; licenseState: string; licenseNumber: string;
  active: boolean; status: string; originalIssueDate: string; expirationDate: string; compactStatus: string;
}
interface NursysReport { ncsbnId: string; fullName: string; reportDate: string; licenses: NursysLicense[]; boardMessages: string[]; authorizedStates: string[]; }
interface NursysResult { status: string; matches: { ncsbnId: string; displayName: string }[]; selectedMatch?: { ncsbnId: string; displayName: string }; report?: NursysReport; error?: string; manualUrl: string; }
interface OIGExclusion { lastName: string; firstName: string; middleName: string; exclusionType: string; exclusionDate: string; specialty: string; state: string; }
interface OIGResult { status: string; searchedName: string; matches: OIGExclusion[]; checkedAt: string; manualUrl: string; }
interface SAMGovResult { status: string; searchedName: string; message: string; details?: string; manualUrl: string; checkedAt: string; }

export interface ReportCheckData {
  firstName: string; middleName?: string | null; lastName: string;
  email?: string | null; phone?: string | null; address?: string | null;
  licenseNumber?: string | null; licenseState?: string | null;
  roleType: "NURSE" | "CNA";
  targetState: string;
  aiRecommendation?: string | null;
  aiSummary?: string | null;
  nursysData?: NursysResult | null;
  oigData?: OIGResult | null;
  samGovData?: SAMGovResult | null;
  updatedAt: string;
}

export interface AllScreenshots {
  nursys: VerificationScreenshot[];
  oig: VerificationScreenshot[];
  samGov: VerificationScreenshot[];
}

function badge(status: string) {
  const map: Record<string, [string, string]> = {
    EMPLOYABLE: ["#065f46", "#d1fae5"],
    REVIEW_REQUIRED: ["#92400e", "#fef3c7"],
    NOT_EMPLOYABLE: ["#991b1b", "#fee2e2"],
    found: ["#065f46", "#d1fae5"],
    multiple_found: ["#92400e", "#fef3c7"],
    not_found: ["#991b1b", "#fee2e2"],
    clear: ["#065f46", "#d1fae5"],
    excluded: ["#991b1b", "#fee2e2"],
    manual_required: ["#92400e", "#fef3c7"],
    error: ["#92400e", "#fef3c7"],
  };
  const [fg, bg] = map[status] ?? ["#374151", "#f3f4f6"];
  const label = status.replace(/_/g, " ").toUpperCase();
  return `<span style="background:${bg};color:${fg};font-weight:700;padding:3px 10px;border-radius:12px;font-size:11px;">${label}</span>`;
}

function screenshotGrid(shots: VerificationScreenshot[], title: string) {
  if (!shots.length) return "";
  return `
    <div style="margin-top:18px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.06em;margin:0 0 10px;">Live Verification Screenshots — ${title}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${shots.map(s => `
          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#f9fafb;padding:6px 10px;font-size:10px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">${s.label}</div>
            <img src="${s.dataUrl}" style="width:100%;display:block;" />
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function nursysSection(data: NursysResult, shots: VerificationScreenshot[]) {
  const report = data.report;
  const licTable = report && report.licenses.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;">
      <thead>
        <tr style="background:#f3f4f6;">
          ${["Name on License","Type","State","License #","Active","Status","Issue Date","Expiry","Compact"].map(h =>
            `<th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;">${h}</th>`
          ).join("")}
        </tr>
      </thead>
      <tbody>
        ${report.licenses.map(lic => `
          <tr>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;font-weight:600;">${lic.nameOnLicense}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;color:#0090d9;font-weight:700;">${lic.type}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">${lic.licenseState}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;font-family:monospace;">${lic.licenseNumber}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">
              <span style="background:${lic.active ? "#d1fae5" : "#fee2e2"};color:${lic.active ? "#065f46" : "#991b1b"};padding:2px 8px;border-radius:8px;font-weight:700;font-size:10px;">${lic.active ? "YES" : "NO"}</span>
            </td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">
              <span style="font-weight:700;font-size:10px;">${lic.status}</span>
            </td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">${lic.originalIssueDate}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">${lic.expirationDate}</td>
            <td style="border:1px solid #e5e7eb;padding:6px 8px;">${lic.compactStatus}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "<p style='color:#6b7280;font-size:12px;font-style:italic;'>License table not available — see screenshots above.</p>";

  const boardMsgs = report && report.boardMessages.length > 0 ? `
    <div style="margin-top:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:10px 14px;">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#92400e;margin:0 0 6px;">Board of Nursing Notifications</p>
      ${report.boardMessages.map(m => `<p style="font-size:11px;color:#78350f;margin:0 0 3px;">• ${m}</p>`).join("")}
    </div>
  ` : "";

  const authorizedStates = report && report.authorizedStates.length > 0 ? `
    <div style="margin-top:10px;">
      <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 5px;">Authorized to Practice In (${report.authorizedStates.length} states):</p>
      <div>${report.authorizedStates.map(s => `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin:2px;display:inline-block;">${s}</span>`).join("")}</div>
    </div>
  ` : "";

  return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;page-break-inside:avoid;">
      <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0;">1. Nursys® QuickConfirm — Primary Source License Verification</p>
          ${report ? `<p style="font-size:11px;color:#374151;margin:2px 0 0;">${report.fullName} — NCSBN ID: ${report.ncsbnId} — Report as of: ${report.reportDate}</p>` : ""}
        </div>
        ${badge(data.status)}
      </div>
      <div style="padding:14px 16px;">
        ${licTable}
        ${boardMsgs}
        ${authorizedStates}
        ${screenshotGrid(shots, "Nursys®")}
      </div>
    </div>
  `;
}

function oigSection(data: OIGResult, shots: VerificationScreenshot[]) {
  const isClear = data.status === "clear";
  const isExcluded = data.status === "excluded";

  const alert = isExcluded ? `
    <div style="background:#fee2e2;border:2px solid #dc2626;border-radius:6px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:18px;">⛔</span>
      <p style="margin:0;font-weight:700;color:#991b1b;">EXCLUDED — This individual appears on the OIG Exclusion List. DO NOT HIRE.</p>
    </div>
    ${data.matches.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#fee2e2;">
            ${["Last Name","First Name","Middle","Exclusion Type","Date","Specialty","State"].map(h =>
              `<th style="border:1px solid #fca5a5;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#991b1b;">${h}</th>`
            ).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.matches.map(m => `
            <tr style="background:#fff5f5;">
              <td style="border:1px solid #fca5a5;padding:6px 8px;font-weight:700;">${m.lastName}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.firstName}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.middleName}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.exclusionType}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.exclusionDate}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.specialty}</td>
              <td style="border:1px solid #fca5a5;padding:6px 8px;">${m.state}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
  ` : isClear ? `
    <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">✅</span>
      <p style="margin:0;font-weight:600;color:#065f46;">Not Excluded — This individual does NOT appear on the OIG Exclusion List.</p>
    </div>
  ` : `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px 14px;">
      <p style="margin:0;color:#92400e;">Manual verification required. Visit <a href="${data.manualUrl}">${data.manualUrl}</a></p>
    </div>
  `;

  return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;page-break-inside:avoid;">
      <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0;">3. OIG Exclusion List — Office of Inspector General · LEIE Database</p>
          <p style="font-size:11px;color:#374151;margin:2px 0 0;">Searched: ${data.searchedName} · ${data.checkedAt ? new Date(data.checkedAt).toLocaleString() : ""}</p>
        </div>
        ${badge(data.status)}
      </div>
      <div style="padding:14px 16px;">
        ${alert}
        ${screenshotGrid(shots, "OIG Exclusion List")}
      </div>
    </div>
  `;
}

function samGovSection(data: SAMGovResult, shots: VerificationScreenshot[]) {
  return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;page-break-inside:avoid;">
      <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0;">2. SAM.gov — System for Award Management · Excluded Parties</p>
          <p style="font-size:11px;color:#374151;margin:2px 0 0;">Searched: ${data.searchedName}</p>
        </div>
        ${badge(data.status)}
      </div>
      <div style="padding:14px 16px;">
        <p style="font-size:12px;color:#374151;margin:0 0 8px;">${data.message}</p>
        ${data.details ? `<pre style="font-size:11px;color:#6b7280;white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin:0 0 12px;">${data.details}</pre>` : ""}
        ${screenshotGrid(shots, "SAM.gov")}
      </div>
    </div>
  `;
}

export function buildReportHTML(check: ReportCheckData, screenshots: AllScreenshots): string {
  const fullName = [check.firstName, check.middleName, check.lastName].filter(Boolean).join(" ");
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const rec = check.aiRecommendation || "REVIEW_REQUIRED";
  const recColors: Record<string, [string, string, string]> = {
    EMPLOYABLE: ["#065f46", "#d1fae5", "#6ee7b7"],
    REVIEW_REQUIRED: ["#92400e", "#fffbeb", "#fcd34d"],
    NOT_EMPLOYABLE: ["#991b1b", "#fee2e2", "#fca5a5"],
  };
  const [recFg, recBg, recBorder] = recColors[rec] ?? ["#374151", "#f9fafb", "#e5e7eb"];
  const recIcon = rec === "EMPLOYABLE" ? "✅" : rec === "NOT_EMPLOYABLE" ? "⛔" : "⚠️";

  const infoRows = [
    ["Full Name", fullName],
    ["Role", check.roleType === "NURSE" ? "Registered Nurse (RN)" : "Certified Nursing Assistant (CNA)"],
    ["Target State", check.targetState],
    check.email ? ["Email", check.email] : null,
    check.phone ? ["Phone", check.phone] : null,
    check.address ? ["Address", check.address] : null,
    check.licenseNumber ? ["License Number", check.licenseNumber] : null,
    check.licenseState ? ["License State", check.licenseState] : null,
  ].filter(Boolean) as [string, string][];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Credential Verification Report — ${fullName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a2b3c; font-size: 12px; line-height: 1.5; }
    @page { size: A4; margin: 18mm 15mm; }
    @media print { .no-break { page-break-inside: avoid; } }
    a { color: #0090d9; }
  </style>
</head>
<body>

  <!-- ── HEADER ─────────────────────────────────────────────── -->
  <div style="background:#0090d9;color:#fff;padding:24px 32px;border-radius:0;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;opacity:.8;margin:0 0 4px;">CaresLink · Credential Verification Report</p>
        <h1 style="font-size:22px;font-weight:800;margin:0;">${fullName}</h1>
        <p style="opacity:.8;font-size:12px;margin:4px 0 0;">${check.roleType === "NURSE" ? "Registered Nurse (RN)" : "Certified Nursing Assistant (CNA)"} · ${check.targetState}</p>
      </div>
      <div style="text-align:right;font-size:11px;opacity:.8;">
        <p>Report Generated</p>
        <p style="font-weight:700;font-size:13px;color:#fff;opacity:1;">${generatedAt}</p>
      </div>
    </div>
  </div>

  <div style="padding:24px 28px;">

    <!-- ── CANDIDATE INFO ──────────────────────────────────── -->
    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px;" class="no-break">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.06em;margin:0 0 10px;">Candidate Information</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${infoRows.map(([label, value]) => `
          <div>
            <p style="font-size:10px;color:#9ca3af;margin:0;">${label}</p>
            <p style="font-size:12px;font-weight:600;color:#1a2b3c;margin:0;">${value}</p>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- ── AI RECOMMENDATION ───────────────────────────────── -->
    <div style="border:2px solid ${recBorder};background:${recBg};border-radius:10px;padding:16px 18px;margin-bottom:24px;" class="no-break">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.06em;margin:0 0 8px;">AI Employability Recommendation</p>
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <span style="font-size:22px;line-height:1;">${recIcon}</span>
        <div>
          <p style="font-size:18px;font-weight:800;color:${recFg};margin:0;">${rec.replace(/_/g, " ")}</p>
          ${check.aiSummary ? `<p style="font-size:12px;color:#374151;margin:6px 0 0;line-height:1.6;">${check.aiSummary}</p>` : ""}
        </div>
      </div>
    </div>

    <!-- ── VERIFICATION SECTIONS ───────────────────────────── -->

    ${check.roleType === "NURSE" && check.nursysData
      ? nursysSection(check.nursysData, screenshots.nursys)
      : ""}

    ${check.samGovData ? samGovSection(check.samGovData, screenshots.samGov) : ""}

    ${check.oigData ? oigSection(check.oigData, screenshots.oig) : ""}

    <!-- ── FOOTER ─────────────────────────────────────────── -->
    <div style="border-top:1px solid #e5e7eb;padding-top:14px;text-align:center;margin-top:8px;">
      <p style="font-size:10px;color:#9ca3af;">Generated by CaresLink · ${generatedAt} · For compliance purposes only</p>
      <p style="font-size:10px;color:#9ca3af;margin-top:3px;">Nursys® is a registered trademark of NCSBN · OIG LEIE data from oig.hhs.gov · SAM.gov data from sam.gov</p>
    </div>

  </div>
</body>
</html>`;
}
