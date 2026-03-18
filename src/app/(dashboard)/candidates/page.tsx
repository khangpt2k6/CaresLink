"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CandidateTable, type FitStatus } from "@/components/candidate-table";
import { Bot, Loader2, UserPlus, Link2, CalendarCheck, X, CheckCircle2, Calendar, Hash, Info, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  fitStatus?: FitStatus;
}

/* ─── Parse AI markdown response into structured display ─── */
function AiResponseBody({ text }: { text: string }) {
  // Extract **Key:** Value pairs
  const fieldPattern = /\*\*(.+?)\*\*\s*:?\s*/g;
  const fields: { key: string; value: string }[] = [];
  let remaining = text;

  // Split by **Key:** pattern
  const parts = text.split(/\*\*(.+?)\*\*\s*:?\s*/);
  // parts: [preamble, key1, val1, key2, val2, ...]

  let preamble = "";
  if (parts.length >= 3) {
    preamble = parts[0].replace(/^[^a-zA-Z]*/, "").trim();
    for (let i = 1; i < parts.length - 1; i += 2) {
      const key = parts[i].replace(/:$/, "").trim();
      const rawVal = (parts[i + 1] || "").replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();
      if (key && rawVal) fields.push({ key, value: rawVal });
    }
  }

  const FIELD_ICONS: Record<string, React.ReactNode> = {
    "Interview Scheduled": <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    "Date": <Calendar className="h-3.5 w-3.5 text-[#0090d9]" />,
    "Interview ID": <Hash className="h-3.5 w-3.5 text-[#8a95a3]" />,
    "Status": <Info className="h-3.5 w-3.5 text-[#0090d9]" />,
  };

  if (fields.length === 0) {
    // Fallback: render with basic **bold** parsing
    const rendered = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#1a2b3c]">$1</strong>');
    return <p className="text-sm leading-relaxed text-[#5a6b7c]" dangerouslySetInnerHTML={{ __html: rendered }} />;
  }

  // Find the trailing sentence (after last field)
  const lastFieldVal = fields[fields.length - 1].value;
  const sentenceSplit = lastFieldVal.match(/^(.*?)([A-Z][^**]*$)/);
  let closingMessage = "";
  if (sentenceSplit && sentenceSplit[2] && sentenceSplit[2].length > 30) {
    fields[fields.length - 1].value = sentenceSplit[1].replace(/\s*-?\s*$/, "").trim();
    closingMessage = sentenceSplit[2].trim();
  }

  return (
    <div className="space-y-3">
      {preamble && (
        <p className="text-sm font-medium text-emerald-600">{preamble}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg bg-[#f5f7fa] px-3 py-2.5">
            <div className="mt-0.5">{FIELD_ICONS[f.key] || <Info className="h-3.5 w-3.5 text-[#8a95a3]" />}</div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">{f.key}</p>
              <p className="mt-0.5 text-xs font-medium text-[#1a2b3c] break-all">{f.value}</p>
            </div>
          </div>
        ))}
      </div>
      {closingMessage && (
        <p className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs leading-relaxed text-[#5a6b7c]">
          {closingMessage}
        </p>
      )}
    </div>
  );
}

export default function CandidatesPage() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [bookingLinkLoading, setBookingLinkLoading] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "" });
  const [contactModal, setContactModal] = useState<{ candidate: Candidate } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCandidates = () => {
    setLoading(true);
    fetch("/api/candidates")
      .then((r) => r.json())
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: "", email: "", phone: "", position: "" }); fetchCandidates(); }
      else { const data = await res.json(); alert(data.error || "Failed to add"); }
    } finally { setAdding(false); }
  };

  const handleFitStatusChange = async (id: string, fitStatus: FitStatus) => {
    try {
      const res = await fetch("/api/candidates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fitStatus: fitStatus ?? null }),
      });
      if (res.ok) fetchCandidates();
    } catch { alert("Failed to update"); }
  };

  const handleSendTemplate = async (c: Candidate, fitStatus: NonNullable<FitStatus>) => {
    setTemplateLoading(c.id);
    try {
      const res = await fetch("/api/candidates/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: c.id, fitStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchCandidates();
      } else {
        alert(data.error || "Failed to send template email");
      }
    } finally { setTemplateLoading(null); }
  };

  const handleEdit = async (id: string, data: { name: string; email: string; phone: string; position: string }) => {
    try {
      const res = await fetch("/api/candidates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
      if (res.ok) fetchCandidates();
      else { const d = await res.json(); alert(d.error || "Failed to update"); }
    } catch { alert("Failed to update candidate"); }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCandidates();
      else { const d = await res.json(); alert(d.error || "Failed to delete"); }
    } catch { alert("Failed to delete candidate"); }
    finally { setDeleteLoading(null); }
  };

  const handleCancelAi = () => {
    abortRef.current?.abort();
    setAiLoading(null);
    setBookingLinkLoading(null);
  };

  const handleSendBookingLink = async (c: Candidate) => {
    setContactModal(null);
    setBookingLinkLoading(c.id);
    try {
      const res = await fetch("/api/candidates/send-booking-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: c.id }),
      });
      const data = await res.json();
      if (res.ok) fetchCandidates();
      else alert(data.error || "Failed to send booking link");
    } finally {
      setBookingLinkLoading(null);
    }
  };

  const handleAutoBook = async (c: Candidate) => {
    const message = `Contact the candidate with ID "${c.id}" for the ${c.position} position. Use auto_book_interview to find a mutual time and schedule the interview automatically. Do NOT send the booking link.`;
    setContactModal(null);
    setAiLoading(c.id);
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (data.response) setAiPrompt(data.response);
      else alert(data.error || "Agent failed");
      fetchCandidates();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      alert("Agent request failed");
    } finally {
      setAiLoading(null);
      abortRef.current = null;
    }
  };

  const inputClass =
    "rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

  return (
    <div className="p-6">
      {/* Back to matching banner when coming from matching */}
      {highlightId && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#0090d9]/20 bg-[#f0f7ff] px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-[#0090d9]">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Viewing from AI Matching</span>
            <span className="text-[#64748b]">— candidate highlighted below</span>
          </div>
          <Link
            href="/matching"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#007bbd] transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Back to Matching
          </Link>
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">Candidates</h1>
        <p className="text-sm text-[#5a6b7c]">Manage candidates and AI outreach</p>
      </div>

      {/* Add Candidate Form */}
      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#0090d9]" />
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Add Candidate</h2>
        </div>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={inputClass} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className={inputClass} />
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          <input type="text" placeholder="Position" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} required className={inputClass} />
          <button type="submit" disabled={adding} className="rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors disabled:opacity-40">
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* Contact AI modal */}
      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setContactModal(null)}>
          <div className="card w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Contact {contactModal.candidate.name}</h2>
              <button onClick={() => setContactModal(null)} className="rounded-lg p-1 text-[#8a95a3] hover:bg-[#f0f4f8]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[#5a6b7c]">Choose how to schedule the interview:</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSendBookingLink(contactModal.candidate)}
                disabled={bookingLinkLoading === contactModal.candidate.id}
                className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] p-4 text-left transition-colors hover:border-[#0090d9] hover:bg-[#f8fafc] disabled:opacity-60"
              >
                <Link2 className="h-5 w-5 text-[#0090d9]" />
                <div>
                  <div className="text-sm font-medium text-[#1a2b3c]">Send booking link</div>
                  <div className="text-xs text-[#5a6b7c]">Direct email, no AI — candidate picks their own time</div>
                </div>
              </button>
              <button
                onClick={() => handleAutoBook(contactModal.candidate)}
                disabled={aiLoading === contactModal.candidate.id}
                className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] p-4 text-left transition-colors hover:border-[#0090d9] hover:bg-[#f8fafc] disabled:opacity-60"
              >
                <CalendarCheck className="h-5 w-5 text-[#0090d9]" />
                <div>
                  <div className="text-sm font-medium text-[#1a2b3c]">Auto-book (AI)</div>
                  <div className="text-xs text-[#5a6b7c]">AI finds mutual time and schedules automatically</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Response + Cancel during loading */}
      {(aiPrompt || aiLoading || bookingLinkLoading) && (
        <div className="card animate-in mb-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-gradient-to-r from-[#e8f4fd] to-white px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0090d9] shadow-sm">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-[#1a2b3c]">AI Agent</span>
              {(aiLoading || bookingLinkLoading) && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#0090d9]/10 px-2 py-0.5 text-[10px] font-medium text-[#0090d9]">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Processing
                </span>
              )}
              {!aiLoading && !bookingLinkLoading && aiPrompt && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Complete
                </span>
              )}
            </div>
            {(aiLoading || bookingLinkLoading) && (
              <button
                onClick={handleCancelAi}
                className="rounded-lg border border-[#e2e8f0] px-2.5 py-1 text-[11px] font-medium text-[#5a6b7c] hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fecaca] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Body */}
          <div className="px-4 py-3.5">
            {bookingLinkLoading ? (
              <p className="text-sm text-[#5a6b7c]">Sending booking link to candidate...</p>
            ) : aiLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                <span>Finding a mutual time and scheduling the interview automatically</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="inline-block h-1 w-1 animate-bounce rounded-full bg-[#0090d9]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              </div>
            ) : (
              <AiResponseBody text={aiPrompt} />
            )}
          </div>
        </div>
      )}

      {/* AI Job Matching link */}
      <Link
        href="/matching"
        className="card mb-4 flex items-center justify-between p-4 transition-colors hover:border-[#0090d9]/30 group"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0090d9] to-[#6366f1] shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1a2b3c]">AI Job Matching</p>
            <p className="text-[10px] text-[#8a95a3]">Pre-computed candidate scores — results load instantly</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-[#94a3b8] transition-transform group-hover:translate-x-1 group-hover:text-[#0090d9]" />
      </Link>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
        </div>
      ) : (
        <CandidateTable
          candidates={candidates}
          onContactAiClick={(c) => setContactModal({ candidate: c })}
          onFitStatusChange={handleFitStatusChange}
          onSendTemplate={handleSendTemplate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          aiLoading={aiLoading}
          bookingLinkLoading={bookingLinkLoading}
          deleteLoading={deleteLoading}
          templateLoading={templateLoading}
          highlightId={highlightId}
        />
      )}
    </div>
  );
}
