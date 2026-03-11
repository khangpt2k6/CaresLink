"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Pencil, Trash2, Check, X, Send } from "lucide-react";

export type FitStatus = "not_a_fit" | "good_fit" | "waitlist" | null;

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
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", position: "" });

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
    <div className="card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[#e2e8f0]">
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Candidate</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Position</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Fit</th>
            <th className="px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Send</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Status</th>
            <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {candidates.map((c) => {
            const status = statusConfig[c.status] || statusConfig.applied;
            const fit = c.fitStatus ? fitConfig[c.fitStatus as NonNullable<FitStatus>] : null;

            return (
              <tr key={c.id} className="h-[72px] transition-colors hover:bg-[#fafbfc] group">
                <td className="px-5 py-3 align-middle">
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
                <td className="px-5 py-3 align-middle">
                  {editingId === c.id ? (
                    <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position" className={inputClass} style={{ minWidth: 140 }} />
                  ) : (
                    <span className="text-sm text-[#334155]">{c.position}</span>
                  )}
                </td>
                <td className="px-5 py-3 align-middle">
                  {onFitStatusChange ? (
                    <select
                      value={c.fitStatus ?? ""}
                      onChange={(e) => onFitStatusChange?.(c.id, (e.target.value || null) as FitStatus)}
                      className={cn(
                        "w-[120px] rounded-full px-3 py-1 text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20 transition-colors appearance-none bg-no-repeat bg-[length:14px] bg-[right_8px_center]",
                        fit
                          ? `${fit.bg} ${fit.text} ${fit.border}`
                          : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1]"
                      )}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")` }}
                    >
                      <option value="">Select fit</option>
                      <option value="good_fit">Good fit</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="not_a_fit">Not a fit</option>
                    </select>
                  ) : fit ? (
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", fit.bg, fit.text)}>
                      {fit.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#94a3b8]">—</span>
                  )}
                </td>
                <td className="px-5 py-3 align-middle text-center">
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
                <td className="px-5 py-3 align-middle">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    status.bg, status.text
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </td>
                <td className="px-5 py-3 align-middle text-right">
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
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#0077b6] hover:shadow-sm disabled:opacity-40"
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
