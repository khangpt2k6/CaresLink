"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Pencil, Trash2, Check, X, Send, Eye, ChevronDown } from "lucide-react";

export type FitStatus = "not_a_fit" | "good_fit" | "waitlist" | null;

export interface MatchScore {
  score: number;
  label: string;
  reason: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  fitStatus?: FitStatus;
}

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  applied: { label: "Applied", dot: "bg-[#94a3b8]", bg: "bg-[#f1f5f9]", text: "text-[#475569]" },
  contacted: { label: "Contacted", dot: "bg-[#0090d9]", bg: "bg-[#e0f2fe]", text: "text-[#0369a1]" },
  scheduled: { label: "Scheduled", dot: "bg-[#f59e0b]", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  interviewed: { label: "Interviewed", dot: "bg-[#8b5cf6]", bg: "bg-[#ede9fe]", text: "text-[#6d28d9]" },
  offered: { label: "Offered", dot: "bg-[#10b981]", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  hired: { label: "Hired", dot: "bg-[#10b981]", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  rejected: { label: "Rejected", dot: "bg-[#ef4444]", bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  no_show: { label: "No-show", dot: "bg-[#f59e0b]", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
};

const fitConfig: Record<NonNullable<FitStatus>, { label: string; bg: string; text: string; border: string }> = {
  not_a_fit: { label: "Not a fit", bg: "bg-[#f8fafc]", text: "text-[#64748b]", border: "border-[#e2e8f0]" },
  good_fit: { label: "Good fit", bg: "bg-[#e0f2fe]", text: "text-[#0090d9]", border: "border-[#bae6fd]" },
  waitlist: { label: "Waitlist", bg: "bg-[#f8fafc]", text: "text-[#64748b]", border: "border-[#e2e8f0]" },
};

const fitOptions: { value: FitStatus; label: string }[] = [
  { value: "good_fit", label: "Good Fit" },
  { value: "waitlist", label: "Waitlist" },
  { value: "not_a_fit", label: "Not a Fit" },
];

function FitDropdown({
  value,
  onChange,
}: {
  value: FitStatus;
  onChange: (v: FitStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = value ? fitConfig[value] : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-[120px] items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20",
          current
            ? `${current.bg} ${current.text} ${current.border}`
            : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1]"
        )}
      >
        <span>{current ? current.label : "Select fit"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[150px] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-lg shadow-black/8 animate-in fade-in slide-in-from-top-1">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#94a3b8] hover:bg-[#f8fafc] transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#e2e8f0]" />
              Clear selection
            </button>
          )}
          {fitOptions.map((opt) => {
            const cfg = fitConfig[opt.value as NonNullable<FitStatus>];
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? `${cfg.bg} ${cfg.text}`
                    : "text-[#334155] hover:bg-[#f8fafc]"
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  opt.value === "good_fit" ? "bg-[#0090d9]" : opt.value === "waitlist" ? "bg-[#f59e0b]" : "bg-[#94a3b8]"
                )} />
                {opt.label}
                {isActive && <Check className="ml-auto h-3 w-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchScoreBadge({ match }: { match: MatchScore }) {
  const getColor = (score: number) => {
    if (score >= 90) return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", bar: "bg-emerald-500" };
    if (score >= 75) return { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", bar: "bg-blue-500" };
    if (score >= 50) return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", bar: "bg-amber-500" };
    if (score >= 25) return { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", bar: "bg-orange-400" };
    return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", bar: "bg-red-400" };
  };
  const color = getColor(match.score);

  return (
    <div className="group/match relative">
      <div className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 ring-1", color.bg, color.ring)}>
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn("text-sm font-bold leading-none", color.text)}>{match.score}%</span>
          <div className="h-1 w-10 rounded-full bg-black/5">
            <div className={cn("h-full rounded-full transition-all", color.bar)} style={{ width: `${match.score}%` }} />
          </div>
        </div>
        <span className={cn("text-[10px] font-medium leading-tight", color.text)}>{match.label}</span>
      </div>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[#e2e8f0] bg-white p-2.5 text-xs text-[#475569] opacity-0 shadow-lg transition-opacity group-hover/match:opacity-100">
        <p className="leading-relaxed">{match.reason}</p>
        <div className={cn("absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#e2e8f0] bg-white")} />
      </div>
    </div>
  );
}

const AVATAR_BG = "bg-[#0090d9]";

export function CandidateTable({
  candidates,
  onContactAi,
  onContactAiClick,
  onFitStatusChange,
  onSendTemplate,
  onEdit,
  onDelete,
  aiLoading,
  bookingLinkLoading,
  deleteLoading,
  templateLoading,
  onCancelAi,
  matchScores,
  highlightId,
}: {
  candidates: Candidate[];
  onContactAi?: (candidate: Candidate) => void;
  onContactAiClick?: (candidate: Candidate) => void;
  onFitStatusChange?: (id: string, fitStatus: FitStatus) => void;
  onSendTemplate?: (candidate: Candidate, fitStatus: NonNullable<FitStatus>) => void;
  onEdit?: (id: string, data: { name: string; email: string; phone: string; position: string }) => void;
  onDelete?: (id: string) => void;
  aiLoading?: string | null;
  bookingLinkLoading?: string | null;
  deleteLoading?: string | null;
  templateLoading?: string | null;
  onCancelAi?: () => void;
  matchScores?: Record<string, MatchScore>;
  highlightId?: string | null;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", position: "" });
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Auto-scroll to highlighted row and flash it
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      // Small delay so the page finishes rendering
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setIsHighlighted(true);
        // Remove highlight after animation
        const fadeTimer = setTimeout(() => setIsHighlighted(false), 3000);
        return () => clearTimeout(fadeTimer);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightId, candidates]);

  const startEdit = (c: Candidate) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, email: c.email, phone: c.phone || "", position: c.position });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (editingId && onEdit) {
      onEdit(editingId, editForm);
      setEditingId(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[#e2e8f0]">
            <th className="px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Candidate</th>
            <th className="hidden md:table-cell px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Position</th>
            {matchScores && <th className="hidden lg:table-cell px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Match</th>}
            <th className="hidden lg:table-cell px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Fit</th>
            <th className="hidden xl:table-cell px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Send</th>
            <th className="px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Profile</th>
            <th className="px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Status</th>
            <th className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] lg:px-5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {candidates.map((c) => {
            const status = statusConfig[c.status] || statusConfig.applied;
            const fit = c.fitStatus ? fitConfig[c.fitStatus as NonNullable<FitStatus>] : null;

            return (
              <tr
                key={c.id}
                ref={c.id === highlightId ? highlightRef : undefined}
                className={cn(
                  "h-[72px] transition-all hover:bg-[#fafbfc] group",
                  c.id === highlightId && isHighlighted
                    ? "bg-[#e0f2fe] ring-2 ring-inset ring-[#0090d9] animate-pulse"
                    : c.id === highlightId && !isHighlighted
                    ? "bg-[#f0f7ff]"
                    : ""
                )}
              >
                <td className="px-3 py-3 align-middle lg:px-5">
                  {editingId === c.id ? (
                    <div className="flex flex-col gap-1.5" style={{ minWidth: 180 }}>
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className={inputClass} />
                      <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
                      <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inputClass} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                        AVATAR_BG
                      )}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1a2b3c] truncate">{c.name}</div>
                        <div className="text-xs text-[#64748b] truncate">{c.email}</div>
                        {c.phone && <div className="text-[11px] text-[#94a3b8]">{c.phone}</div>}
                      </div>
                    </div>
                  )}
                </td>
                <td className="hidden md:table-cell px-3 py-3 align-middle lg:px-5">
                  {editingId === c.id ? (
                    <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position" className={inputClass} style={{ minWidth: 140 }} />
                  ) : (
                    <span className="text-sm text-[#334155]">{c.position}</span>
                  )}
                </td>
                {matchScores && (
                  <td className="hidden lg:table-cell px-3 py-3 align-middle lg:px-5">
                    {matchScores[c.id] ? (
                      <MatchScoreBadge match={matchScores[c.id]} />
                    ) : (
                      <span className="text-xs text-[#94a3b8]">—</span>
                    )}
                  </td>
                )}
                <td className="hidden lg:table-cell px-3 py-3 align-middle lg:px-5">
                  {onFitStatusChange ? (
                    <FitDropdown
                      value={c.fitStatus ?? null}
                      onChange={(v) => onFitStatusChange(c.id, v)}
                    />
                  ) : fit ? (
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", fit.bg, fit.text)}>
                      {fit.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#94a3b8]">—</span>
                  )}
                </td>
                <td className="hidden xl:table-cell px-3 py-3 align-middle text-center lg:px-5">
                  {onSendTemplate && (
                    <button
                      onClick={() => {
                        if (!c.fitStatus) {
                          alert("Oops! You haven't selected a fit status for this candidate yet. Please choose Good fit, Waitlist, or Not a fit first.");
                          return;
                        }
                        onSendTemplate(c, c.fitStatus as NonNullable<FitStatus>);
                      }}
                      disabled={templateLoading === c.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40",
                        c.fitStatus
                          ? "bg-[#e0f2fe] text-[#0090d9] hover:bg-[#bae6fd] hover:shadow-sm"
                          : "bg-[#f8fafc] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#64748b]"
                      )}
                    >
                      {templateLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </button>
                  )}
                </td>
                <td className="px-3 py-3 align-middle text-center lg:px-5">
                  <button
                    onClick={() => router.push(`/candidates/${c.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] transition-colors whitespace-nowrap"
                    title="View Profile"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">View</span> Profile
                  </button>
                </td>
                <td className="px-3 py-3 align-middle lg:px-5">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                    status.bg, status.text
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </td>
                <td className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] px-3 py-3 align-middle text-right lg:px-5 group-hover:bg-[#fafbfc]">
                  <div className="inline-flex items-center gap-1">
                    {editingId === c.id ? (
                      <>
                        <button onClick={saveEdit} className="rounded-lg p-2 text-[#059669] hover:bg-[#ecfdf5] transition-colors" title="Save">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9] transition-colors" title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {(onContactAi || onContactAiClick) && (
                          <button
                            onClick={() => (onContactAiClick ?? onContactAi)?.(c)}
                            disabled={aiLoading === c.id || bookingLinkLoading === c.id || templateLoading === c.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#0077b6] hover:shadow-sm disabled:opacity-40 whitespace-nowrap"
                          >
                            {aiLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                            {aiLoading === c.id ? "Booking..." : bookingLinkLoading === c.id ? "Sending..." : "Contact"}
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-lg p-2 text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:bg-[#f1f5f9] hover:text-[#334155] transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => { if (confirm(`Delete ${c.name}? This will also remove their interviews.`)) onDelete(c.id); }}
                            disabled={deleteLoading === c.id}
                            className="rounded-lg p-2 text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:bg-[#fef2f2] hover:text-[#dc2626] transition-all disabled:opacity-40"
                            title="Delete"
                          >
                            {deleteLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="py-20 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f5f9]">
            <Bot className="h-5 w-5 text-[#94a3b8]" />
          </div>
          <p className="text-sm font-medium text-[#334155]">No candidates yet</p>
          <p className="mt-1 text-xs text-[#94a3b8]">Add your first candidate above to get started</p>
        </div>
      )}
    </div>
  );
}
