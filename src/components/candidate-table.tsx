"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Pencil, Trash2, Check, X, Mail } from "lucide-react";

export type FitStatus = "linkedin" | "not_a_fit" | "good_fit" | "waitlist" | null;

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  fitStatus?: FitStatus;
}

const statusStyles: Record<string, string> = {
  applied: "bg-[#f0f4f8] text-[#5a6b7c]",
  contacted: "bg-[#e8f4fd] text-[#0077b6]",
  scheduled: "bg-[#fffbeb] text-[#b45309]",
  interviewed: "bg-[#f3e8ff] text-[#7c3aed]",
  offered: "bg-[#ecfdf5] text-[#059669]",
  hired: "bg-[#ecfdf5] text-[#059669]",
  rejected: "bg-[#fef2f2] text-[#dc2626]",
  no_show: "bg-[#fffbeb] text-[#b45309]",
};

const fitStatusLabels: Record<NonNullable<FitStatus>, string> = {
  linkedin: "LinkedIn",
  not_a_fit: "Not a fit",
  good_fit: "Good fit",
  waitlist: "Waitlist",
};

const fitStatusStyles: Record<NonNullable<FitStatus>, string> = {
  linkedin: "bg-[#e0f2fe] text-[#0369a1]",
  not_a_fit: "bg-[#fef2f2] text-[#dc2626]",
  good_fit: "bg-[#ecfdf5] text-[#059669]",
  waitlist: "bg-[#fffbeb] text-[#b45309]",
};

export function CandidateTable({
  candidates,
  onContactAi,
  onContactAiClick,
  onFitStatusChange,
  onSendTemplate,
  onEdit,
  onDelete,
  aiLoading,
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
    "w-full rounded-lg border border-[#e2e8f0] bg-white px-2 py-1 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#5a6b7c]">
              Candidate
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#5a6b7c]">
              Position
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#5a6b7c]">
              Fit
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#5a6b7c]">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#5a6b7c] whitespace-nowrap" style={{ minWidth: 200 }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className="border-b border-[#f0f4f8] transition-colors hover:bg-[#f8fafc]"
            >
              <td className="px-4 py-3">
                {editingId === c.id ? (
                  <div className="flex flex-col gap-1.5" style={{ minWidth: 160 }}>
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className={inputClass} />
                    <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
                    <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inputClass} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0090d9] text-xs font-medium text-white">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#1a2b3c]">{c.name}</div>
                      <div className="text-xs text-[#5a6b7c]">{c.email}</div>
                      {c.phone && <div className="text-xs text-[#8a95a3]">{c.phone}</div>}
                    </div>
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {editingId === c.id ? (
                  <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position" className={inputClass} style={{ minWidth: 120 }} />
                ) : (
                  <span className="text-sm text-[#1a2b3c]">{c.position}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {onFitStatusChange || onSendTemplate ? (
                  <div className="flex flex-col gap-1">
                    <select
                      value={c.fitStatus ?? ""}
                      onChange={(e) => onFitStatusChange?.(c.id, (e.target.value || null) as FitStatus)}
                      className="rounded border border-[#e2e8f0] bg-white px-2 py-1 text-xs text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none"
                    >
                      <option value="">—</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="not_a_fit">Not a fit</option>
                      <option value="good_fit">Good fit</option>
                      <option value="waitlist">Waitlist</option>
                    </select>
                    {c.fitStatus && onSendTemplate && (
                      <button
                        onClick={() => onSendTemplate(c, c.fitStatus!)}
                        disabled={templateLoading === c.id}
                        className="inline-flex items-center gap-1 text-xs text-[#0090d9] hover:underline disabled:opacity-50"
                      >
                        {templateLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        Send template
                      </button>
                    )}
                  </div>
                ) : c.fitStatus ? (
                  <span className={cn("inline-block rounded-sm px-2 py-0.5 text-xs font-medium", fitStatusStyles[c.fitStatus])}>
                    {fitStatusLabels[c.fitStatus]}
                  </span>
                ) : (
                  <span className="text-xs text-[#8a95a3]">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={cn(
                    "inline-block rounded-sm px-2 py-0.5 text-xs font-medium",
                    statusStyles[c.status] ?? "bg-[#f1f1ef] text-[#73726e]"
                  )}
                >
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right" style={{ minWidth: 200 }}>
                <div className="inline-flex items-center gap-1.5">
                  {editingId === c.id ? (
                    <>
                      <button onClick={saveEdit} className="rounded-md p-1.5 text-[#059669] hover:bg-[#ecfdf5] transition-colors" title="Save">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="rounded-md p-1.5 text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors" title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {(onContactAi || onContactAiClick) && (
                        <button
                          onClick={() => (onContactAiClick ?? onContactAi)?.(c)}
                          disabled={aiLoading === c.id || bookingLinkLoading === c.id || templateLoading === c.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0077b6] disabled:opacity-40"
                        >
                          {aiLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                          {aiLoading === c.id ? "Auto-booking..." : bookingLinkLoading === c.id ? "Sending..." : "Contact"}
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => startEdit(c)} className="rounded-md p-1.5 text-[#8a95a3] hover:bg-[#f0f4f8] hover:text-[#1a2b3c] transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => { if (confirm(`Delete ${c.name}? This will also remove their interviews.`)) onDelete(c.id); }}
                          disabled={deleteLoading === c.id}
                          className="rounded-md p-1.5 text-[#8a95a3] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors disabled:opacity-40"
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
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#5a6b7c]">No candidates yet</p>
          <p className="mt-1 text-xs text-[#8a95a3]">Add your first candidate above</p>
        </div>
      )}
    </div>
  );
}
