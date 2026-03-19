"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Upload, FileText, Users, Plus, Loader2,
  CheckCircle2, AlertCircle, Clock, XCircle, ChevronRight,
  Download, Trash2, FileSpreadsheet, X,
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
  createdAt: string;
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

const STATUS_CONFIG: Record<CheckStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: "Pending", icon: <Clock className="h-3.5 w-3.5" />, color: "text-amber-600 bg-amber-50 border-amber-200" },
  IN_PROGRESS: { label: "Running...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  COMPLETED: { label: "Completed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  FAILED: { label: "Failed", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-600 bg-red-50 border-red-200" },
};

const REC_CONFIG: Record<Recommendation, { label: string; color: string }> = {
  EMPLOYABLE: { label: "Employable", color: "text-emerald-700 bg-emerald-100" },
  REVIEW_REQUIRED: { label: "Review Required", color: "text-amber-700 bg-amber-100" },
  NOT_EMPLOYABLE: { label: "Not Employable", color: "text-red-700 bg-red-100" },
};

export default function CredentialCheckPage() {
  const [checks, setChecks] = useState<CredentialCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"history" | "new">("new");

  // New check form state
  const [inputMode, setInputMode] = useState<"manual" | "resume" | "csv">("manual");
  const [pendingCandidates, setPendingCandidates] = useState<ParsedCandidate[]>([]);
  const [manualForm, setManualForm] = useState<ParsedCandidate>({
    firstName: "", lastName: "", roleType: "NURSE",
  });
  const [targetState, setTargetState] = useState("FLORIDA");
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChecks();
  }, []);

  async function loadChecks() {
    setLoading(true);
    try {
      const res = await fetch("/api/credential-check");
      if (res.ok) setChecks(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeUpload(files: FileList) {
    setParsing(true);
    setParseError("");
    const results: ParsedCandidate[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/credential-check/parse-resume", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data.firstName && data.lastName) results.push({ ...data, roleType: data.roleType || "NURSE" });
        }
      } catch { /* skip failed file */ }
    }
    if (results.length === 0) setParseError("Could not extract candidate data from the uploaded file(s).");
    else setPendingCandidates(results);
    setParsing(false);
  }

  async function handleCSVUpload(file: File) {
    setParsing(true);
    setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
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

  async function submitChecks(candidates: ParsedCandidate[]) {
    setSubmitting(true);
    try {
      const created: CredentialCheck[] = [];
      for (const c of candidates) {
        const res = await fetch("/api/credential-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...c, targetState }),
        });
        if (res.ok) created.push(await res.json());
      }
      setChecks((prev) => [...created, ...prev]);
      setPendingCandidates([]);
      setManualForm({ firstName: "", lastName: "", roleType: "NURSE" });
      setTab("history");
    } finally {
      setSubmitting(false);
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
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0090d9] text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1a2b3c]">Credential Verification</h1>
              <p className="text-xs text-[#5a6b7c]">Florida · Nurses & CNAs · Nursys® · OIG · Florida DOH</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("new")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "new" ? "bg-[#0090d9] text-white" : "bg-white border border-[#e2e8f0] text-[#5a6b7c] hover:bg-[#f8fafc]"}`}
            >
              <Plus className="inline h-3.5 w-3.5 mr-1.5" />New Check
            </button>
            <button
              onClick={() => setTab("history")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "history" ? "bg-[#0090d9] text-white" : "bg-white border border-[#e2e8f0] text-[#5a6b7c] hover:bg-[#f8fafc]"}`}
            >
              <FileText className="inline h-3.5 w-3.5 mr-1.5" />History ({checks.length})
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "new" ? (
            <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Step 1: Target state (Florida only for now) */}
              <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a95a3]">Target State</p>
                <div className="flex gap-2">
                  {["FLORIDA"].map((s) => (
                    <button key={s} onClick={() => setTargetState(s)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${targetState === s ? "border-[#0090d9] bg-[#e8f4fd] text-[#0090d9]" : "border-[#e2e8f0] text-[#5a6b7c] hover:bg-[#f8fafc]"}`}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                  <span className="flex items-center rounded-lg border border-dashed border-[#e2e8f0] px-4 py-2 text-xs text-[#94a3b8]">
                    Texas & Georgia coming soon
                  </span>
                </div>
              </div>

              {/* Step 2: Input method */}
              <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8a95a3]">Input Method</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: "resume", label: "Upload Resume(s)", icon: FileText, desc: "PDF or DOCX, AI-parsed" },
                    { id: "csv", label: "Upload CSV", icon: FileSpreadsheet, desc: "Bulk candidate list" },
                    { id: "manual", label: "Manual Entry", icon: Users, desc: "Enter details directly" },
                  ] as const).map((m) => (
                    <button key={m.id} onClick={() => { setInputMode(m.id); setPendingCandidates([]); setParseError(""); }}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${inputMode === m.id ? "border-[#0090d9] bg-[#e8f4fd]" : "border-[#e2e8f0] hover:border-[#0090d9]/40"}`}>
                      <m.icon className={`mb-2 h-5 w-5 ${inputMode === m.id ? "text-[#0090d9]" : "text-[#8a95a3]"}`} />
                      <p className={`text-sm font-semibold ${inputMode === m.id ? "text-[#0090d9]" : "text-[#1a2b3c]"}`}>{m.label}</p>
                      <p className="text-xs text-[#8a95a3]">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Input area */}
              <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-5">
                {inputMode === "manual" && (
                  <div>
                    <p className="mb-4 text-sm font-semibold text-[#1a2b3c]">Candidate Information</p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {(["firstName", "middleName", "lastName"] as const).map((f) => (
                        <div key={f}>
                          <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">
                            {f === "firstName" ? "First Name *" : f === "middleName" ? "Middle Name" : "Last Name *"}
                          </label>
                          <input
                            value={(manualForm as Record<string, string | null | undefined>)[f] ?? ""}
                            onChange={(e) => setManualForm((p) => ({ ...p, [f]: e.target.value }))}
                            className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Email</label>
                        <input value={manualForm.email ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))}
                          type="email" className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Phone</label>
                        <input value={manualForm.phone ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, phone: e.target.value }))}
                          className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">Role Type *</label>
                        <select value={manualForm.roleType} onChange={(e) => setManualForm((p) => ({ ...p, roleType: e.target.value as RoleType }))}
                          className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]">
                          <option value="NURSE">Nurse (RN)</option>
                          <option value="CNA">CNA</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">License Number</label>
                        <input value={manualForm.licenseNumber ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                          className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">License State</label>
                        <input value={manualForm.licenseState ?? ""} onChange={(e) => setManualForm((p) => ({ ...p, licenseState: e.target.value }))}
                          placeholder="e.g. FL" maxLength={2}
                          className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0090d9] uppercase" />
                      </div>
                    </div>
                    <button
                      disabled={!manualForm.firstName || !manualForm.lastName || submitting}
                      onClick={() => submitChecks([manualForm])}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-[#0090d9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-50 transition-colors"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Run Verification
                    </button>
                  </div>
                )}

                {inputMode === "resume" && (
                  <div>
                    {pendingCandidates.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e8f0] p-10 text-center cursor-pointer hover:border-[#0090d9]/50 transition-colors"
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        {parsing ? (
                          <><Loader2 className="mb-3 h-8 w-8 animate-spin text-[#0090d9]" /><p className="text-sm text-[#5a6b7c]">Parsing resume(s)...</p></>
                        ) : (
                          <>
                            <Upload className="mb-3 h-8 w-8 text-[#94a3b8]" />
                            <p className="text-sm font-semibold text-[#1a2b3c]">Upload Resume(s)</p>
                            <p className="mt-1 text-xs text-[#8a95a3]">PDF or DOCX · Multiple files supported</p>
                            {parseError && <p className="mt-2 text-xs text-red-500">{parseError}</p>}
                          </>
                        )}
                        <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx" className="hidden"
                          onChange={(e) => e.target.files && handleResumeUpload(e.target.files)} />
                      </div>
                    ) : (
                      <ParsedCandidateList candidates={pendingCandidates} onRemove={(i) => setPendingCandidates(p => p.filter((_, idx) => idx !== i))}
                        onUpdate={(i, c) => setPendingCandidates(p => p.map((x, idx) => idx === i ? c : x))}
                        onSubmit={() => submitChecks(pendingCandidates)} submitting={submitting} onReset={() => setPendingCandidates([])} />
                    )}
                  </div>
                )}

                {inputMode === "csv" && (
                  <div>
                    {pendingCandidates.length === 0 ? (
                      <div>
                        <div
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e8f0] p-10 text-center cursor-pointer hover:border-[#0090d9]/50 transition-colors"
                          onClick={() => csvInputRef.current?.click()}
                        >
                          {parsing ? (
                            <><Loader2 className="mb-3 h-8 w-8 animate-spin text-[#0090d9]" /><p className="text-sm text-[#5a6b7c]">Parsing CSV...</p></>
                          ) : (
                            <>
                              <FileSpreadsheet className="mb-3 h-8 w-8 text-[#94a3b8]" />
                              <p className="text-sm font-semibold text-[#1a2b3c]">Upload CSV File</p>
                              <p className="mt-1 text-xs text-[#8a95a3]">Required: First Name, Last Name · Optional: Middle Name, Email, Phone, License #, License State, Role Type</p>
                              {parseError && <p className="mt-2 text-xs text-red-500">{parseError}</p>}
                            </>
                          )}
                          <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleCSVUpload(e.target.files[0])} />
                        </div>
                        <div className="mt-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3">
                          <p className="text-xs font-semibold text-[#5a6b7c] mb-1">Expected CSV columns:</p>
                          <p className="text-xs text-[#8a95a3] font-mono">First Name, Middle Name, Last Name, Email Address, RN License Number, Phone Number, License State</p>
                        </div>
                      </div>
                    ) : (
                      <ParsedCandidateList candidates={pendingCandidates} onRemove={(i) => setPendingCandidates(p => p.filter((_, idx) => idx !== i))}
                        onUpdate={(i, c) => setPendingCandidates(p => p.map((x, idx) => idx === i ? c : x))}
                        onSubmit={() => submitChecks(pendingCandidates)} submitting={submitting} onReset={() => setPendingCandidates([])} />
                    )}
                  </div>
                )}
              </div>
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
                        const rec = c.aiRecommendation ? REC_CONFIG[c.aiRecommendation as Recommendation] : null;
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
                              {rec ? (
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rec.color}`}>{rec.label}</span>
                              ) : <span className="text-xs text-[#94a3b8]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#8a95a3]">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </td>
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

// ─── ParsedCandidateList sub-component ───────────────────────────────────────
function ParsedCandidateList({
  candidates, onRemove, onUpdate, onSubmit, submitting, onReset,
}: {
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
              <option value="NURSE">Nurse (RN)</option>
              <option value="CNA">CNA</option>
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
        Run Verification for {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
      </button>
    </div>
  );
}
