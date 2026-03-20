"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck, ArrowLeft, Download, Loader2, CheckCircle2,
  AlertCircle, XCircle, ExternalLink, RefreshCw, AlertTriangle,
  MapPin, User, Phone, Mail, FileText, Clock, FileCheck,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────
interface CredentialCheck {
  id: string;
  firstName: string; middleName?: string; lastName: string;
  email?: string; phone?: string; address?: string;
  licenseNumber?: string; licenseState?: string;
  roleType: "NURSE" | "CNA";
  targetState: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  aiRecommendation?: string;
  aiSummary?: string;
  nursysData?: NursysResult;
  oigData?: OIGResult;
  floridaDohData?: FloridaDOHResult;
  samGovData?: SAMGovResult;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface NursysResult {
  status: string; matches: NursysMatch[]; selectedMatch?: NursysMatch;
  report?: NursysReport; error?: string; manualUrl: string;
}
interface NursysMatch { ncsbnId: string; displayName: string; firstName: string; lastName: string; middleName?: string; }
interface NursysLicense { nameOnLicense: string; type: string; licenseState: string; licenseNumber: string; active: boolean; status: string; originalIssueDate: string; expirationDate: string; compactStatus: string; }
interface NursysReport { ncsbnId: string; fullName: string; reportDate: string; licenses: NursysLicense[]; boardMessages: string[]; authorizedStates: string[]; }

interface OIGResult {
  status: string; searchedName: string;
  matches: OIGExclusion[]; exactMatches: OIGExclusion[]; partialMatches: OIGExclusion[];
  error?: string; manualUrl: string; checkedAt: string;
}
interface OIGExclusion { lastName: string; firstName: string; middleName: string; exclusionType: string; exclusionDate: string; specialty: string; state: string; }

interface FloridaDOHResult {
  status: string; searchedName: string; licenseType: string;
  matches: FloridaLicense[]; error?: string; manualUrl: string; checkedAt: string;
  screenshots?: { label: string; dataUrl: string }[];
}
interface FloridaLicense { name: string; licenseNumber: string; licenseType: string; status: string; expirationDate: string; county?: string; }

interface SAMGovResult { status: string; searchedName: string; message: string; details?: string; manualUrl: string; checkedAt: string; }

// ─── Status helpers ───────────────────────────────────────────
function StatusBadge({ status, labels }: { status: string; labels: Record<string, { label: string; color: string; icon: React.ReactNode }> }) {
  const cfg = labels[status] ?? { label: status, color: "text-gray-600 bg-gray-100 border-gray-200", icon: <AlertCircle className="h-3.5 w-3.5" /> };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const NURSYS_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  found: { label: "License Found", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  multiple_found: { label: "Multiple Matches", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  not_found: { label: "Not Found", color: "text-red-700 bg-red-50 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
  manual_required: { label: "Manual Required", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  error: { label: "Error", color: "text-red-700 bg-red-50 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
};
const OIG_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  clear: { label: "Not Excluded — Clear", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  excluded: { label: "EXCLUDED — DO NOT HIRE", color: "text-red-700 bg-red-100 border-red-300", icon: <XCircle className="h-3.5 w-3.5" /> },
  partial_match: { label: "Partial Match — Review Required", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  manual_required: { label: "Manual Required", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  error: { label: "Error — Verify Manually", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};
const LICENSE_STATUS_COLOR: Record<string, string> = {
  UNENCUMBERED: "text-emerald-700 bg-emerald-100",
  ACTIVE: "text-emerald-700 bg-emerald-100",
  EXPIRED: "text-red-700 bg-red-100",
  REVOKED: "text-red-700 bg-red-100",
  SUSPENDED: "text-red-700 bg-red-100",
  PROBATION: "text-amber-700 bg-amber-100",
  RESTRICTION: "text-amber-700 bg-amber-100",
};
function licenseColor(status: string) {
  return LICENSE_STATUS_COLOR[status.toUpperCase().replace(/[^A-Z]/g, "")] ?? "text-gray-700 bg-gray-100";
}

const REC_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  EMPLOYABLE: { label: "EMPLOYABLE", color: "text-emerald-800", bg: "bg-emerald-50 border-emerald-300", icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" /> },
  REVIEW_REQUIRED: { label: "REVIEW REQUIRED", color: "text-amber-800", bg: "bg-amber-50 border-amber-300", icon: <AlertCircle className="h-6 w-6 text-amber-600" /> },
  NOT_EMPLOYABLE: { label: "NOT EMPLOYABLE", color: "text-red-800", bg: "bg-red-50 border-red-300", icon: <XCircle className="h-6 w-6 text-red-600" /> },
};

// ─── Main Page ────────────────────────────────────────────────
export default function CredentialCheckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [check, setCheck] = useState<CredentialCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportStep, setReportStep] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCheck();
  }, [id]);

  async function loadCheck() {
    setLoading(true);
    try {
      const res = await fetch(`/api/credential-check/${id}`);
      if (res.ok) setCheck(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runVerification() {
    setVerifying(true);
    try {
      const res = await fetch(`/api/credential-check/${id}/verify`, { method: "POST" });
      if (res.ok) setCheck(await res.json());
    } finally {
      setVerifying(false);
    }
  }

  async function generateFullReport() {
    if (generatingReport) return;
    setGeneratingReport(true);
    setReportUrl(null);
    setReportStep("Opening browsers for live verification...");
    try {
      const res = await fetch(`/api/credential-check/${id}/report`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate report" }));
        alert(err.error || "Failed to generate report");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setReportUrl(url);
      setReportStep("Report ready!");
    } catch {
      alert("Failed to generate report. Make sure verification has been run first.");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function downloadPDF() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const el = reportRef.current;

      function stripModernColors(doc: Document) {
        const mapOklch = (m: string) => {
          const l = parseFloat(m.split("(")[1] ?? "0");
          if (isNaN(l)) return "#808080";
          if (l >= 0.95) return "#ffffff";
          if (l >= 0.85) return "#f1f5f9";
          if (l >= 0.70) return "#e2e8f0";
          if (l >= 0.55) return "#94a3b8";
          if (l >= 0.40) return "#64748b";
          if (l >= 0.25) return "#334155";
          return "#0f172a";
        };
        const fixCSS = (css: string) =>
          css
            .replace(/oklch\([^)]*\)/g, mapOklch)
            .replace(/oklab\([^)]*\)/g, "#808080")
            .replace(/color-mix\([^)]*oklch[^)]*\)/gi, "#808080")
            .replace(/color-mix\([^)]*oklab[^)]*\)/gi, "#808080")
            .replace(/color-mix\([^)]*\)/gi, "#808080");

        // Fix all <style> tags
        doc.querySelectorAll("style").forEach((s) => {
          s.textContent = fixCSS(s.textContent ?? "");
        });

        // Fix inline styles on any element
        doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
          const s = el.getAttribute("style") ?? "";
          if (s.includes("oklch") || s.includes("oklab") || s.includes("color-mix")) {
            el.setAttribute("style", fixCSS(s));
          }
        });

        // Fix SVG presentation attributes — set explicit colors so no CSS parsing needed
        doc.querySelectorAll<SVGElement>("svg").forEach((svg) => {
          const walk = (el: Element) => {
            const st = (el as HTMLElement).style;
            if (st) {
              if (!st.color || st.color.includes("oklch") || st.color.includes("oklab")) {
                st.color = "#1e293b";
              }
            }
            // If no explicit fill/stroke attr, don't override (let currentColor flow)
            Array.from(el.children).forEach(walk);
          };
          walk(svg);
        });

        // Safety: inject a global fallback that suppresses unsupported functions
        const safety = doc.createElement("style");
        safety.textContent = `*, *::before, *::after { color-scheme: light !important; }`;
        doc.head.appendChild(safety);
      }

      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        width: el.scrollWidth, height: el.scrollHeight,
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
        onclone: (_doc, clonedEl) => stripModernColors(clonedEl.ownerDocument),
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297;
      const imgH = (canvas.height * pageW) / canvas.width;
      let yPos = 0, remaining = imgH, first = true;
      while (remaining > 0) {
        if (!first) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -yPos, pageW, imgH);
        if (remaining > pageH) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, Math.min(pageH, remaining), pageW, pageH - Math.min(pageH, remaining), "F");
        }
        yPos += pageH; remaining -= pageH; first = false;
      }
      const name = check ? `${check.lastName}_${check.firstName}` : "Report";
      pdf.save(`CredentialCheck_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" /></div>;
  }
  if (!check) {
    return <div className="p-8 text-center text-[#5a6b7c]">Credential check not found.</div>;
  }

  const fullName = [check.firstName, check.middleName, check.lastName].filter(Boolean).join(" ");
  const rec = check.aiRecommendation ? REC_CONFIG[check.aiRecommendation] : null;
  const needsVerification = check.status === "PENDING" || check.status === "FAILED";
  // Treat as CNA if roleType is CNA OR license number starts with "CNA"
  const isCNA = check.roleType === "CNA" || !!check.licenseNumber?.toUpperCase().startsWith("CNA");

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-6">
      <div className="mx-auto max-w-4xl">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between">
          <Link href="/credential-check" className="flex items-center gap-1.5 text-sm text-[#5a6b7c] hover:text-[#1a2b3c] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Credential Checks
          </Link>
          <div className="flex gap-2">
            {(needsVerification || check.status === "COMPLETED") && (
              <button onClick={runVerification} disabled={verifying}
                className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1a2b3c] hover:bg-[#f8fafc] disabled:opacity-50 transition-colors shadow-sm">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {check.status === "COMPLETED" ? "Re-run" : "Run Verification"}
              </button>
            )}
            {check.status === "COMPLETED" && (
              <>
                <button onClick={generateFullReport} disabled={generatingReport}
                  className="flex items-center gap-1.5 rounded-lg border border-[#0090d9] bg-white px-4 py-2 text-sm font-semibold text-[#0090d9] hover:bg-[#eff8ff] disabled:opacity-50 transition-colors shadow-sm">
                  {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                  {generatingReport ? "Opening browsers..." : "Generate Full Report"}
                </button>
                <button onClick={downloadPDF} disabled={exporting}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-50 transition-colors shadow-sm">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Quick PDF
                </button>
              </>
            )}
          </div>
        </div>

        {verifying && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Running verifications...</p>
              <p className="text-xs text-blue-600">{isCNA ? "Checking Florida DOH MQA license database." : "Checking Nursys®, OIG Exclusion List, and SAM.gov."} This may take up to 30 seconds.</p>
            </div>
          </div>
        )}

        {generatingReport && (
          <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Generating full report with live browser verification</p>
                <p className="text-xs text-purple-600">{reportStep || "Launching browsers..."}</p>
              </div>
            </div>
            <p className="text-xs text-purple-500 pl-8">
              {isCNA
                ? "Chrome will open showing the Florida DOH MQA license verification in real time. This takes about 30–60 seconds."
                : "Chrome windows will open on your screen showing the verification in real time. Nursys®, OIG Exclusion List, and SAM.gov will be checked with screenshots. This takes 1–3 minutes."}
            </p>
          </div>
        )}

        {/* ─── FULL REPORT PDF VIEWER ────────────────────────── */}
        {reportUrl && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl overflow-hidden shadow-sm border border-[#e2e8f0] bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-[#0090d9]" />
                <p className="text-sm font-semibold text-[#1a2b3c]">Full Verification Report with Live Screenshots</p>
              </div>
              <a
                href={reportUrl}
                download={`CredentialReport_${check.lastName}_${check.firstName}_${new Date().toISOString().slice(0, 10)}.pdf`}
                className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0077b6] transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </a>
            </div>
            <iframe
              src={reportUrl}
              className="w-full"
              style={{ height: "900px", border: "none" }}
              title="Credential Verification Report"
            />
          </motion.div>
        )}

        {/* ─── REPORT (captured for PDF) ─────────────────────── */}
        <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e2e8f0]">

          {/* Report Header */}
          <div className="bg-[#0090d9] px-8 py-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-white/80" />
                  <span className="text-sm font-medium text-white/80 uppercase tracking-wider">CaresLink · Credential Verification Report</span>
                </div>
                <h1 className="text-2xl font-bold">{fullName}</h1>
                <p className="mt-1 text-white/70 text-sm">
                  {isCNA ? "Certified Nursing Assistant (CNA)" : "Registered Nurse (RN)"} · {check.targetState}
                </p>
              </div>
              <div className="text-right text-sm text-white/70">
                <p>Report Generated</p>
                <p className="font-semibold text-white">{new Date(check.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                <p className="text-xs mt-1">{new Date(check.updatedAt).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-7">
            {/* Candidate Info */}
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8a95a3]">Candidate Information</h2>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4">
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Full Name" value={fullName} />
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={check.email} />
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={check.phone} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={check.address} />
                <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="License Number" value={check.licenseNumber} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="License State" value={check.licenseState} />
              </div>
            </section>

            {check.status === "PENDING" && (
              <div className="rounded-xl border border-dashed border-[#e2e8f0] p-8 text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-[#c8d5e0]" />
                <p className="text-sm font-semibold text-[#1a2b3c]">Verification not yet started</p>
                <p className="text-xs text-[#8a95a3] mt-1">Click "Run Verification" to start</p>
              </div>
            )}

            {check.status === "IN_PROGRESS" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm font-semibold text-blue-800">Verifications running...</p>
              </div>
            )}

            {check.status === "FAILED" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Verification failed</p>
                {check.errorMessage && <p className="text-xs text-red-600 mt-1">{check.errorMessage}</p>}
              </div>
            )}

            {check.status === "COMPLETED" && (
              <>
                {/* ── 1. AI Recommendation ── */}
                {rec && (
                  <section>
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8a95a3]">AI Employability Recommendation</h2>
                    <div className={`rounded-xl border-2 p-5 flex items-start gap-4 ${rec.bg}`}>
                      {rec.icon}
                      <div>
                        <p className={`text-xl font-bold ${rec.color}`}>{rec.label}</p>
                        {check.aiSummary && <p className="mt-1.5 text-sm text-[#374151] leading-relaxed">{check.aiSummary}</p>}
                      </div>
                    </div>
                  </section>
                )}

                {/* ── 2. Nursys (NURSE only) ── */}
                {!isCNA && check.nursysData && (
                  <NursysSection data={check.nursysData} />
                )}

                {/* ── 3. Florida DOH CNA (CNA only) ── */}
                {isCNA && check.floridaDohData && (
                  <FloridaDOHSection data={check.floridaDohData} />
                )}

                {/* SAM.gov and OIG are hidden for CNA candidates */}
                {!isCNA && check.samGovData && (
                  <SAMGovSection data={check.samGovData} />
                )}

                {!isCNA && check.oigData && (
                  <OIGSection data={check.oigData} />
                )}
              </>
            )}

            {/* Footer */}
            <div className="border-t border-[#e2e8f0] pt-4 text-center">
              <p className="text-xs text-[#94a3b8]">
                Generated by CaresLink · {new Date(check.updatedAt).toLocaleString()} · For compliance purposes only
              </p>
              {!isCNA && (
                <p className="text-xs text-[#94a3b8] mt-1">
                  Nursys® is a registered trademark of NCSBN. This report uses data from Nursys QuickConfirm.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[#8a95a3]">{icon}</span>
      <div>
        <p className="text-xs text-[#8a95a3]">{label}</p>
        <p className="text-sm font-medium text-[#1a2b3c]">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-[#1a2b3c]">{title}</h2>
      {badge}
    </div>
  );
}

function ManualRequiredBanner({ url, text }: { url: string; text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-amber-800">{text}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
          Open verification site <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function NursysSection({ data }: { data: NursysResult }) {
  return (
    <section className="rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a95a3]">1. Nursys® QuickConfirm</p>
          <p className="text-xs text-[#8a95a3] mt-0.5">Primary Source Boards of Nursing — License Verification</p>
        </div>
        <StatusBadge status={data.status} labels={NURSYS_STATUS} />
      </div>
      <div className="p-5">
        {data.report ? (
          <>
            {data.report.fullName && (
              <p className="mb-3 font-semibold text-[#1a2b3c]">
                {data.report.fullName}
                {data.report.ncsbnId && <span className="ml-2 text-sm font-normal text-[#8a95a3]">[NCSBN ID: {data.report.ncsbnId}]</span>}
              </p>
            )}
            {data.report.reportDate && (
              <p className="mb-3 text-xs text-[#8a95a3]">Report as of: {data.report.reportDate}</p>
            )}
            {data.report.licenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      {["Name on License", "Type", "State", "License #", "Active", "Status", "Issue Date", "Expiration", "Compact"].map(h => (
                        <th key={h} className="border border-[#e2e8f0] px-3 py-2 text-left text-xs font-semibold text-[#8a95a3] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.report.licenses.map((lic, i) => (
                      <tr key={i} className="hover:bg-[#f8fafc]">
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-medium">{lic.nameOnLicense}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-semibold text-[#0090d9]">{lic.type}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{lic.licenseState}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-mono">{lic.licenseNumber}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lic.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {lic.active ? "YES" : "NO"}
                          </span>
                        </td>
                        <td className="border border-[#e2e8f0] px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${licenseColor(lic.status)}`}>{lic.status}</span>
                        </td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{lic.originalIssueDate}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{lic.expirationDate}</td>
                        <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{lic.compactStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#8a95a3] italic">License table data not available — review full report on Nursys.com</p>
            )}
            {data.report.boardMessages.length > 0 && (
              <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#fffbeb] p-4">
                <p className="mb-2 text-xs font-bold text-[#92400e] uppercase tracking-wider">Board of Nursing Notifications</p>
                <ul className="space-y-1.5">
                  {data.report.boardMessages.map((msg, i) => (
                    <li key={i} className="text-xs text-[#78350f] leading-relaxed">• {msg}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.report.authorizedStates.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[#5a6b7c]">Authorized to Practice In ({data.report.authorizedStates.length} states):</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.report.authorizedStates.map((s) => (
                    <span key={s} className="rounded bg-[#e8f4fd] px-2 py-0.5 text-xs font-medium text-[#0090d9]">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {data.matches.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-xs font-semibold text-[#5a6b7c]">{data.matches.length} match(es) found:</p>
                <div className="space-y-1.5">
                  {data.matches.map((m) => (
                    <div key={m.ncsbnId} className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm">
                      <span className="font-semibold text-[#1a2b3c]">{m.displayName}</span>
                      <span className="text-xs text-[#8a95a3]">NCSBN ID: {m.ncsbnId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ManualRequiredBanner url={data.manualUrl} text={data.error || "Full license report requires manual verification on Nursys.com."} />
          </>
        )}
      </div>
    </section>
  );
}

function FloridaDOHSection({ data }: { data: FloridaDOHResult }) {
  const status = data.status === "found"
    ? { label: "Found", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
    : data.status === "not_found"
    ? { label: "Not Found", color: "text-red-700 bg-red-50 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> }
    : { label: "Manual Required", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <AlertCircle className="h-3.5 w-3.5" /> };

  return (
    <section className="rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a95a3]">1. Florida DOH — CNA License Verification</p>
          <p className="text-xs text-[#8a95a3] mt-0.5">MQA Health Care Provider Search · {data.licenseType}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.color}`}>
          {status.icon}{status.label}
        </span>
      </div>
      <div className="p-5">
        {data.matches.length > 0 ? (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">CNA license found and active in Florida DOH database.</p>
            </div>
            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {["Name", "License #", "Type", "Status", "Expiration", "County"].map(h => (
                    <th key={h} className="border border-[#e2e8f0] px-3 py-2 text-left text-xs font-semibold text-[#8a95a3] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m, i) => (
                  <tr key={i} className="hover:bg-[#f8fafc]">
                    <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-medium">{m.name}</td>
                    <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-mono">{m.licenseNumber}</td>
                    <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.licenseType}</td>
                    <td className="border border-[#e2e8f0] px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${licenseColor(m.status)}`}>{m.status}</span>
                    </td>
                    <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.expirationDate}</td>
                    <td className="border border-[#e2e8f0] px-3 py-2 text-xs text-[#8a95a3]">{m.county || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.screenshots && data.screenshots.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#8a95a3]">Live Verification Screenshots</p>
                <div className="grid grid-cols-2 gap-3">
                  {data.screenshots.map((s, i) => (
                    <div key={i} className="rounded-lg border border-[#e2e8f0] overflow-hidden">
                      <p className="px-3 py-1.5 text-xs font-medium text-[#5a6b7c] bg-[#f8fafc] border-b border-[#e2e8f0]">{s.label}</p>
                      <img src={s.dataUrl} alt={s.label} className="w-full" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <ManualRequiredBanner url={data.manualUrl} text={data.error || "Could not retrieve license data automatically. Please verify manually on the Florida DOH portal."} />
        )}
      </div>
    </section>
  );
}

function SAMGovSection({ data }: { data: SAMGovResult }) {
  return (
    <section className="rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a95a3]">2. SAM.gov Verification</p>
          <p className="text-xs text-[#8a95a3] mt-0.5">Federal License Verification</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border-amber-200">
          <AlertCircle className="h-3.5 w-3.5" />Manual Required
        </span>
      </div>
      <div className="p-5">
        <p className="mb-3 text-sm text-[#374151]">{data.message}</p>
        {data.details && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <pre className="text-xs text-[#5a6b7c] whitespace-pre-wrap font-sans">{data.details}</pre>
          </div>
        )}
        <a href={data.manualUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#1a2b3c] hover:bg-[#f8fafc] transition-colors">
          Open SAM.gov <ExternalLink className="h-3.5 w-3.5 text-[#0090d9]" />
        </a>
      </div>
    </section>
  );
}

function OIGSection({ data }: { data: OIGResult }) {
  return (
    <section className="rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a95a3]">3. OIG Exclusion List</p>
          <p className="text-xs text-[#8a95a3] mt-0.5">Office of Inspector General · LEIE Database · exclusions.oig.hhs.gov</p>
        </div>
        <StatusBadge status={data.status} labels={OIG_STATUS} />
      </div>
      <div className="p-5">
        <p className="mb-2 text-sm text-[#5a6b7c]">
          Searched: <span className="font-semibold text-[#1a2b3c]">{data.searchedName}</span>
          {data.checkedAt && <span className="ml-2 text-xs text-[#94a3b8]">· {new Date(data.checkedAt).toLocaleString()}</span>}
        </p>
        {data.status === "clear" ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">No exclusions found. This individual does not appear on the OIG exclusion list.</p>
          </div>
        ) : data.status === "partial_match" ? (
          <>
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-300 p-3">
              <div className="flex items-center gap-2.5 mb-1">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-bold text-amber-800">Partial name matches found — manual review required.</p>
              </div>
              <p className="text-xs text-amber-700 ml-7">These are similar but NOT exact name matches. Verify these are different individuals before proceeding.</p>
            </div>
            {data.partialMatches && data.partialMatches.length > 0 && (
              <table className="w-full text-sm border-collapse mb-3">
                <thead><tr className="bg-amber-50">
                  {["Last Name","First Name","Middle","Exclusion Type","Specialty","State"].map(h => (
                    <th key={h} className="border border-amber-200 px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.partialMatches.map((m, i) => (
                    <tr key={i} className="bg-amber-50/30">
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-semibold">{m.lastName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.firstName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.middleName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.exclusionType}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.specialty}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : data.status === "excluded" ? (
          <>
            <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-300 p-3">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-800">EXCLUDED — This individual appears on the OIG exclusion list. DO NOT HIRE.</p>
            </div>
            {data.matches.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    {["Last Name", "First Name", "Middle", "Exclusion Type", "Exclusion Date", "Specialty", "State"].map(h => (
                      <th key={h} className="border border-[#e2e8f0] px-3 py-2 text-left text-xs font-semibold text-[#8a95a3] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((m, i) => (
                    <tr key={i} className="bg-red-50/50">
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs font-semibold">{m.lastName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.firstName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.middleName}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.exclusionType}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.exclusionDate}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.specialty}</td>
                      <td className="border border-[#e2e8f0] px-3 py-2 text-xs">{m.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <ManualRequiredBanner url={data.manualUrl} text={data.error || "Could not automatically check the OIG exclusion list. Please verify manually."} />
        )}
        {data.status !== "excluded" && (
          <a href={data.manualUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#0090d9] hover:underline">
            Verify on exclusions.oig.hhs.gov <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </section>
  );
}
