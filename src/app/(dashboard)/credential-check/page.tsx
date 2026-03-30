"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Upload, FileText, Users, Plus, Loader2,
  CheckCircle2, AlertCircle, Clock, XCircle, ChevronRight,
  Download, Trash2, FileSpreadsheet, X, FileCheck, Search,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

type RoleType = "NURSE" | "CNA";
type CheckStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
type Recommendation = "EMPLOYABLE" | "REVIEW_REQUIRED" | "NOT_EMPLOYABLE";

interface CredentialCheck {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  roleType: RoleType;
  targetState: string;
  status: CheckStatus;
  aiRecommendation?: Recommendation;
  aiSummary?: string;
  recruiterDecision?: "APPROVED" | "REJECTED";
  createdAt: string;
  errorMessage?: string;
}

interface ParsedCandidate {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  roleType: RoleType;
}

interface ExistingCandidate {
  source: "pipeline" | "registered" | "both";
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string | null;
  roleType: RoleType;
  licenseNumber: string | null;
  licenseState: string | null;
}

// Inline result after verify runs
interface InlineResult {
  check: CredentialCheck;
  verifying: boolean;
  generatingReport: boolean;
  reportUrl: string | null;
}

const STATUS_CONFIG: Record<CheckStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING:     { label: "Pending",    icon: <Clock className="h-3.5 w-3.5" />,             color: "text-amber-600 bg-amber-50 border-amber-200" },
  IN_PROGRESS: { label: "Running...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  COMPLETED:   { label: "Completed",  icon: <CheckCircle2 className="h-3.5 w-3.5" />,      color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  FAILED:      { label: "Failed",     icon: <XCircle className="h-3.5 w-3.5" />,            color: "text-red-600 bg-red-50 border-red-200" },
};

const REC_CONFIG: Record<Recommendation, { label: string; color: string; icon: React.ReactNode }> = {
  EMPLOYABLE:      { label: "Employable",      color: "text-emerald-700 bg-emerald-100 border-emerald-300", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
  REVIEW_REQUIRED: { label: "Review Required", color: "text-amber-700 bg-amber-100 border-amber-300",       icon: <AlertCircle className="h-4 w-4 text-amber-600" /> },
  NOT_EMPLOYABLE:  { label: "Not Employable",  color: "text-red-700 bg-red-100 border-red-300",             icon: <XCircle className="h-4 w-4 text-red-600" /> },
};

export default function CredentialCheckPage() {
  const [checks, setChecks]                 = useState<CredentialCheck[]>([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState<"history" | "new">("new");

  // New check form state
  const [inputMode, setInputMode]           = useState<"manual" | "resume" | "csv">("manual");
  const [pendingCandidates, setPendingCandidates] = useState<ParsedCandidate[]>([]);
  const [manualForm, setManualForm]         = useState<ParsedCandidate>({ firstName: "", lastName: "", roleType: "CNA" });
  const [targetState, setTargetState]       = useState("FLORIDA");
  const [parsing, setParsing]               = useState(false);
  const [parseError, setParseError]         = useState("");

  // Candidate selector state
  const [existingCandidates, setExistingCandidates] = useState<ExistingCandidate[]>([]);
  const [candidateSearch, setCandidateSearch]       = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [loadingCandidates, setLoadingCandidates]   = useState(false);
  const candidateDropdownRef = useRef<HTMLDivElement>(null);

  // Inline results (shown right after "Run Verification" is clicked)
  const [inlineResults, setInlineResults]   = useState<InlineResult[]>([]);
  const [runningAll, setRunningAll]         = useState(false);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => { loadChecks(); loadExistingCandidates(); }, []);

  // Close candidate dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (candidateDropdownRef.current && !candidateDropdownRef.current.contains(e.target as Node)) {
        setShowCandidateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadChecks() {
    setLoading(true);
    try {
      const res = await fetch("/api/credential-check");
      if (res.ok) setChecks(await res.json());
    } finally { setLoading(false); }
  }

  async function loadExistingCandidates() {
    setLoadingCandidates(true);
    try {
      const res = await fetch("/api/credential-check/candidates");
      if (res.ok) setExistingCandidates(await res.json());
    } finally { setLoadingCandidates(false); }
  }

  function selectCandidate(c: ExistingCandidate) {
    setManualForm({
      firstName: c.firstName,
      middleName: null,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      roleType: c.roleType,
      licenseNumber: c.licenseNumber,
      licenseState: c.licenseState,
    });
    setCandidateSearch("");
    setShowCandidateDropdown(false);
  }

  const filteredCandidates = existingCandidates.filter((c) => {
    if (!candidateSearch.trim()) return true;
    const q = candidateSearch.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return fullName.includes(q) || c.email.toLowerCase().includes(q) || (c.position?.toLowerCase().includes(q) ?? false);
  });

  async function handleResumeUpload(files: FileList) {
    setParsing(true); setParseError("");
    const results: ParsedCandidate[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/credential-check/parse-resume", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data.firstName && data.lastName) results.push({ ...data, roleType: data.roleType || "CNA" });
        }
      } catch { /* skip */ }
    }
    if (results.length === 0) setParseError("Could not extract candidate data from the uploaded file(s).");
    else setPendingCandidates(results);
    setParsing(false);
  }

  async function handleCSVUpload(file: File) {
    setParsing(true); setParseError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/credential-check/parse-csv", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setPendingCandidates(data.candidates || []);
      } else {
        const err = await res.json();
        setParseError(err.error || "Failed to parse CSV");
      }
    } catch { setParseError("Failed to parse CSV"); }
    finally { setParsing(false); }
  }

  // Create + verify all candidates inline — no page navigation needed
  async function runVerificationInline(candidates: ParsedCandidate[]) {
    setRunningAll(true);
    setInlineResults([]);

    // Step 1: create all records
    const created: CredentialCheck[] = [];
    for (const c of candidates) {
      const res = await fetch("/api/credential-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, targetState }),
      });
      if (res.ok) created.push(await res.json());
    }

    // Step 2: show them all as "verifying" immediately
    setInlineResults(created.map((check) => ({
      check: { ...check, status: "IN_PROGRESS" as CheckStatus },
      verifying: true,
      generatingReport: false,
      reportUrl: null,
    })));
    setPendingCandidates([]);
    setManualForm({ firstName: "", lastName: "", roleType: "CNA" });

    // Step 3: verify each one (in parallel for speed)
    await Promise.all(
      created.map(async (check) => {
        try {
          const res = await fetch(`/api/credential-check/${check.id}/verify`, { method: "POST" });
          const updated: CredentialCheck = res.ok ? await res.json() : { ...check, status: "FAILED" };
          setInlineResults((prev) =>
            prev.map((r) =>
              r.check.id === check.id
                ? { ...r, check: updated, verifying: false }
                : r
            )
          );
        } catch {
          setInlineResults((prev) =>
            prev.map((r) =>
              r.check.id === check.id
                ? { ...r, check: { ...check, status: "FAILED" }, verifying: false }
                : r
            )
          );
        }
      })
    );

    setRunningAll(false);
    loadChecks(); // refresh history tab in background
  }

  async function generateReport(checkId: string) {
    setInlineResults((prev) =>
      prev.map((r) => r.check.id === checkId ? { ...r, generatingReport: true } : r)
    );
    try {
      const res = await fetch(`/api/credential-check/${checkId}/report`);
      if (!res.ok) { alert("Failed to generate report"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setInlineResults((prev) =>
        prev.map((r) => r.check.id === checkId ? { ...r, reportUrl: url, generatingReport: false } : r)
      );
    } catch {
      alert("Failed to generate report.");
      setInlineResults((prev) =>
        prev.map((r) => r.check.id === checkId ? { ...r, generatingReport: false } : r)
      );
    }
  }

  async function deleteCheck(id: string) {
    if (!confirm("Delete this credential check?")) return;
    await fetch(`/api/credential-check/${id}`, { method: "DELETE" });
    setChecks((prev) => prev.filter((c) => c.id !== id));
  }

  const fullName = (c: CredentialCheck | ParsedCandidate) =>
    [c.firstName, (c as CredentialCheck).middleName || (c as ParsedCandidate).middleName, c.lastName]
      .filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0090d9] text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1a2b3c]">Credential Verification</h1>
              <p className="text-xs text-[#5a6b7c]">Florida · CNA (Florida DOH) · Nurses (Nursys®)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab("new")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "new" ? "bg-[#0090d9] text-white" : "bg-white border border-[#e2e8f0] text-[#5a6b7c] hover:bg-[#f8fafc]"}`}>
              <Plus className="inline h-3.5 w-3.5 mr-1.5" />New Check
            </button>
            <button onClick={() => setTab("history")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "history" ? "bg-[#0090d9] text-white" : "bg-white border border-[#e2e8f0] text-[#5a6b7c] hover:bg-[#f8fafc]"}`}>
              <FileText className="inline h-3.5 w-3.5 mr-1.5" />History ({checks.length})
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "new" ? (
            <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* ── Inline Results ── */}
              {inlineResults.length > 0 && (
                <div className="mb-6 space-y-3">
                  {inlineResults.map((r) => {
                    const effRec = r.check.recruiterDecision ? (r.check.recruiterDecision === "APPROVED" ? "EMPLOYABLE" : "NOT_EMPLOYABLE") as Recommendation : r.check.aiRecommendation;
                    const rec = effRec ? REC_CONFIG[effRec] : null;
                    return (
                      <motion.div key={r.check.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden shadow-sm">
                        {/* Card header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
                          <div>
                            <p className="font-semibold text-[#1a2b3c]">{fullName(r.check)}</p>
                            <p className="text-xs text-[#8a95a3]">
                              {r.check.roleType === "CNA" ? "CNA · Florida DOH" : "Nurse (RN) · Nursys®"} · {r.check.targetState}
                              {r.check.email && ` · ${r.check.email}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.verifying ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border-blue-200">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />Verifying...
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[r.check.status].color}`}>
                                {STATUS_CONFIG[r.check.status].icon}{STATUS_CONFIG[r.check.status].label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Result body */}
                        {!r.verifying && r.check.status === "COMPLETED" && (
                          <div className="px-5 py-4">
                            {rec && (
                              <div className={`mb-3 flex items-center gap-3 rounded-lg border px-4 py-3 ${rec.color}`}>
                                {rec.icon}
                                <div>
                                  <p className="text-sm font-bold">{rec.label}</p>
                                  {r.check.aiSummary && <p className="text-xs mt-0.5 opacity-80">{r.check.aiSummary}</p>}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {r.reportUrl ? (
                                <a href={r.reportUrl}
                                  download={`CredentialReport_${r.check.lastName}_${r.check.firstName}_${new Date().toISOString().slice(0,10)}.pdf`}
                                  className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0077b6] transition-colors">
                                  <Download className="h-3.5 w-3.5" /> Download PDF Report
                                </a>
                              ) : (
                                <button onClick={() => generateReport(r.check.id)} disabled={r.generatingReport}
                                  className="flex items-center gap-1.5 rounded-lg border border-[#0090d9] px-4 py-2 text-xs font-semibold text-[#0090d9] hover:bg-[#eff8ff] disabled:opacity-50 transition-colors">
                                  {r.generatingReport
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Opening browser...</>
                                    : <><FileCheck className="h-3.5 w-3.5" />Generate PDF Report</>}
                                </button>
                              )}
                              <Link href={`/credential-check/${r.check.id}`}
                                className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs font-medium text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors">
                                View Full Details <ChevronRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        )}

                        {!r.verifying && r.check.status === "FAILED" && (
                          <div className="px-5 py-3">
                            <p className="text-sm text-red-600">{r.check.errorMessage || "Verification failed. Try again from the detail page."}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  <button onClick={() => { setInlineResults([]); setPendingCandidates([]); }}
                    className="text-xs text-[#8a95a3] hover:text-[#5a6b7c] underline underline-offset-2">
                    Clear results and verify new candidates
                  </button>
                </div>
              )}

              {/* Only show input form when no results are showing */}
              {inlineResults.length === 0 && (
                <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
                  {/* Card header: target state + input method tabs */}
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
                    <div className="flex items-center gap-3">
                      {([
                        { id: "manual", label: "Manual", icon: Users },
                        { id: "resume", label: "Resume", icon: Upload },
                        { id: "csv",    label: "CSV",    icon: FileSpreadsheet },
                      ] as const).map((m) => (
                        <button key={m.id} onClick={() => { setInputMode(m.id); setPendingCandidates([]); setParseError(""); }}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${inputMode === m.id ? "bg-[#0090d9] text-white shadow-sm" : "text-[#5a6b7c] hover:bg-white hover:shadow-sm"}`}>
                          <m.icon className="h-3.5 w-3.5" />
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">State:</span>
                      <span className="rounded-full border border-[#0090d9]/30 bg-[#e8f4fd] px-2.5 py-0.5 text-[11px] font-semibold text-[#0090d9]">Florida</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    {inputMode === "manual" && (
                      <div>
                        {/* Candidate search */}
                        <div className="mb-4" ref={candidateDropdownRef}>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                            <input
                              value={candidateSearch}
                              onChange={(e) => { setCandidateSearch(e.target.value); setShowCandidateDropdown(true); }}
                              onFocus={() => setShowCandidateDropdown(true)}
                              placeholder="Search existing candidates by name or email..."
                              className="w-full rounded-lg border border-[#e2e8f0] pl-9 pr-3 py-2 text-sm outline-none focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20 bg-[#f8fafc]"
                            />
                            {loadingCandidates && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#94a3b8]" />}
                            {!loadingCandidates && existingCandidates.length > 0 && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#94a3b8]">{existingCandidates.length} available</span>
                            )}
                          </div>
                          {showCandidateDropdown && filteredCandidates.length > 0 && (
                            <div className="absolute z-20 mt-1 w-[calc(100%-2.5rem)] max-h-52 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white shadow-lg">
                              {filteredCandidates.map((c) => (
                                <button key={c.id + c.source} onClick={() => selectCandidate(c)}
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f0f4f8] transition-colors border-b border-[#f1f5f9] last:border-0">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f4fd] text-[#0090d9] flex-shrink-0">
                                    <UserCheck className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#1a2b3c] truncate">{c.firstName} {c.lastName}</p>
                                    <p className="text-xs text-[#8a95a3] truncate">{c.email}{c.position ? ` · ${c.position}` : ""}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.roleType === "NURSE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                      {c.roleType === "NURSE" ? "RN" : "CNA"}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.source === "both" ? "bg-emerald-100 text-emerald-700" : c.source === "registered" ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600"}`}>
                                      {c.source === "both" ? "Matched" : c.source === "registered" ? "Profile" : "Pipeline"}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {showCandidateDropdown && candidateSearch && filteredCandidates.length === 0 && !loadingCandidates && (
                            <div className="absolute z-20 mt-1 w-[calc(100%-2.5rem)] rounded-lg border border-[#e2e8f0] bg-white p-3 text-center shadow-lg">
                              <p className="text-xs text-[#8a95a3]">No candidates found. Enter details manually below.</p>
                            </div>
                          )}
                        </div>

                        {/* Compact form grid */}
                        <div className="grid grid-cols-6 gap-3 mb-3">
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">First Name *</label>
                            <input value={manualForm.firstName} onChange={(e) => setManualForm((p) => ({ ...p, firstName: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20" />
                          </div>
                          <div className="col-span-1">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Middle</label>
                            <input value={manualForm.middleName ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, middleName: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20" />
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Last Name *</label>
                            <input value={manualForm.lastName} onChange={(e) => setManualForm((p) => ({ ...p, lastName: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20" />
                          </div>
                          <div className="col-span-1">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Role *</label>
                            <select value={manualForm.roleType} onChange={(e) => setManualForm((p) => ({ ...p, roleType: e.target.value as RoleType }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-2 py-2 text-sm outline-none focus:border-[#0090d9]">
                              <option value="CNA">CNA</option>
                              <option value="NURSE">RN</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-3">
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Email</label>
                            <input value={manualForm.email ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))}
                              type="email" className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                          </div>
                          <div className="col-span-1">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Phone</label>
                            <input value={manualForm.phone ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, phone: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">License #</label>
                            <input value={manualForm.licenseNumber ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                          </div>
                          <div className="col-span-1">
                            <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">State</label>
                            <input value={manualForm.licenseState ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, licenseState: e.target.value }))}
                              placeholder="FL" maxLength={2}
                              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] uppercase" />
                          </div>
                        </div>

                        {/* Run button */}
                        <div className="mt-4 flex items-center justify-between border-t border-[#f1f5f9] pt-4">
                          <p className="text-xs text-[#94a3b8]">
                            {manualForm.roleType === "CNA" ? "Will verify via Florida DOH" : "Will verify via Nursys® + OIG + SAM.gov"}
                          </p>
                          <button
                            disabled={!manualForm.firstName || !manualForm.lastName || runningAll}
                            onClick={() => runVerificationInline([manualForm])}
                            className="flex items-center gap-2 rounded-lg bg-[#0090d9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-50 transition-colors">
                            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Run Verification
                          </button>
                        </div>
                      </div>
                    )}

                    {inputMode === "resume" && (
                      <div>
                        {pendingCandidates.length === 0 ? (
                          <>
                            <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-[#e2e8f0] p-6 cursor-pointer hover:border-[#0090d9]/50 transition-colors"
                              onClick={() => resumeInputRef.current?.click()}>
                              {parsing ? (
                                <><Loader2 className="h-8 w-8 animate-spin text-[#0090d9] shrink-0" /><div><p className="text-sm font-medium text-[#5a6b7c]">Parsing resume(s)...</p></div></>
                              ) : (
                                <>
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f4fd]">
                                    <Upload className="h-5 w-5 text-[#0090d9]" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[#1a2b3c]">Drop resume files here or click to browse</p>
                                    <p className="text-xs text-[#8a95a3]">PDF or DOCX · Multiple files supported · AI will extract candidate info automatically</p>
                                    {parseError && <p className="mt-1 text-xs text-red-500">{parseError}</p>}
                                  </div>
                                </>
                              )}
                              <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx" className="hidden"
                                onChange={(e) => e.target.files && handleResumeUpload(e.target.files)} />
                            </div>
                          </>
                        ) : (
                          <ParsedCandidateList candidates={pendingCandidates}
                            onRemove={(i) => setPendingCandidates(p => p.filter((_, idx) => idx !== i))}
                            onUpdate={(i, c) => setPendingCandidates(p => p.map((x, idx) => idx === i ? c : x))}
                            onSubmit={() => runVerificationInline(pendingCandidates)}
                            submitting={runningAll} onReset={() => setPendingCandidates([])} />
                        )}
                      </div>
                    )}

                    {inputMode === "csv" && (
                      <div>
                        {pendingCandidates.length === 0 ? (
                          <>
                            <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-[#e2e8f0] p-6 cursor-pointer hover:border-[#0090d9]/50 transition-colors"
                              onClick={() => csvInputRef.current?.click()}>
                              {parsing ? (
                                <><Loader2 className="h-8 w-8 animate-spin text-[#0090d9] shrink-0" /><div><p className="text-sm font-medium text-[#5a6b7c]">Parsing CSV...</p></div></>
                              ) : (
                                <>
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f4fd]">
                                    <FileSpreadsheet className="h-5 w-5 text-[#0090d9]" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[#1a2b3c]">Drop CSV file here or click to browse</p>
                                    <p className="text-xs text-[#8a95a3]">Columns: First Name, Last Name, Email, Phone, License #, License State, Role Type</p>
                                    {parseError && <p className="mt-1 text-xs text-red-500">{parseError}</p>}
                                  </div>
                                </>
                              )}
                              <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleCSVUpload(e.target.files[0])} />
                            </div>
                          </>
                        ) : (
                          <ParsedCandidateList candidates={pendingCandidates}
                            onRemove={(i) => setPendingCandidates(p => p.filter((_, idx) => idx !== i))}
                            onUpdate={(i, c) => setPendingCandidates(p => p.map((x, idx) => idx === i ? c : x))}
                            onSubmit={() => runVerificationInline(pendingCandidates)}
                            submitting={runningAll} onReset={() => setPendingCandidates([])} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
                </div>
              ) : checks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white py-16 text-center">
                  <ShieldCheck className="mb-3 h-10 w-10 text-[#c8d5e0]" />
                  <p className="text-sm font-semibold text-[#1a2b3c]">No verifications yet</p>
                  <p className="mt-1 text-xs text-[#8a95a3]">Run your first credential check to see results here</p>
                  <button onClick={() => setTab("new")} className="mt-4 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077b6] transition-colors">
                    New Check
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                        {["Candidate", "Role", "State", "Status", "AI Recommendation", "Date", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#8a95a3] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {checks.map((c) => {
                        const status = STATUS_CONFIG[c.status];
                        const effRec = c.recruiterDecision ? (c.recruiterDecision === "APPROVED" ? "EMPLOYABLE" : "NOT_EMPLOYABLE") as Recommendation : c.aiRecommendation as Recommendation | undefined;
                        const rec    = effRec ? REC_CONFIG[effRec] : null;
                        return (
                          <tr key={c.id} className="hover:bg-[#f8fafc] transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#1a2b3c]">{fullName(c)}</p>
                              {c.email && <p className="text-xs text-[#8a95a3]">{c.email}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.roleType === "NURSE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                {c.roleType === "NURSE" ? "Nurse (RN)" : "CNA"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#5a6b7c]">{c.targetState}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.color}`}>
                                {status.icon}{status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {rec
                                ? <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${rec.color}`}>{rec.icon}{rec.label}</span>
                                : <span className="text-xs text-[#94a3b8]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#8a95a3]">{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Link href={`/credential-check/${c.id}`}
                                  className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-medium text-[#1a2b3c] hover:bg-[#f0f4f8] transition-colors">
                                  View <ChevronRight className="h-3 w-3" />
                                </Link>
                                <button onClick={() => deleteCheck(c.id)}
                                  className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#94a3b8] hover:border-red-200 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── ParsedCandidateList ──────────────────────────────────────────────────────
function ParsedCandidateList({ candidates, onRemove, onUpdate, onSubmit, submitting, onReset }: {
  candidates: ParsedCandidate[];
  onRemove: (i: number) => void;
  onUpdate: (i: number, c: ParsedCandidate) => void;
  onSubmit: () => void;
  submitting: boolean;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1a2b3c]">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""} ready</p>
        <button onClick={onReset} className="text-xs text-[#8a95a3] hover:text-[#5a6b7c]">Upload different file</button>
      </div>
      <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
        {candidates.map((c, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1a2b3c] truncate">
                {[c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-[#8a95a3]">{c.email || "No email"} · {c.licenseNumber || "No license #"}</p>
            </div>
            <select value={c.roleType} onChange={(e) => onUpdate(i, { ...c, roleType: e.target.value as "NURSE" | "CNA" })}
              className="rounded border border-[#e2e8f0] px-2 py-1 text-xs text-[#5a6b7c] outline-none focus:border-[#0090d9]">
              <option value="CNA">CNA</option>
              <option value="NURSE">Nurse (RN)</option>
            </select>
            <button onClick={() => onRemove(i)} className="text-[#94a3b8] hover:text-red-500 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={onSubmit} disabled={submitting || candidates.length === 0}
        className="flex items-center gap-2 rounded-lg bg-[#0090d9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-50 transition-colors">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {submitting ? "Verifying..." : `Run Verification for ${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
