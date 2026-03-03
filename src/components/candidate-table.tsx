"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Pencil, Trash2, Check, X } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
}

const statusStyles: Record<string, string> = {
  applied: "bg-slate-100/70 text-slate-700",
  contacted: "bg-sky-100/70 text-sky-700",
  scheduled: "bg-amber-100/70 text-amber-700",
  interviewed: "bg-violet-100/70 text-violet-700",
  offered: "bg-teal-100/70 text-teal-700",
  hired: "bg-emerald-100/70 text-emerald-800",
  rejected: "bg-rose-100/60 text-rose-700",
  no_show: "bg-orange-100/60 text-orange-700",
};

const statusDot: Record<string, string> = {
  applied: "bg-slate-400",
  contacted: "bg-sky-400",
  scheduled: "bg-amber-400",
  interviewed: "bg-violet-400",
  offered: "bg-teal-400",
  hired: "bg-emerald-500",
  rejected: "bg-rose-400",
  no_show: "bg-orange-400",
};

export function CandidateTable({
  candidates,
  onContactAi,
  onEdit,
  onDelete,
  aiLoading,
  deleteLoading,
}: {
  candidates: Candidate[];
  onContactAi?: (candidate: Candidate) => void;
  onEdit?: (id: string, data: { name: string; email: string; phone: string; position: string }) => void;
  onDelete?: (id: string) => void;
  aiLoading?: string | null;
  deleteLoading?: string | null;
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
    "w-full rounded-lg border border-teal-200/60 bg-white/70 px-2 py-1 text-xs text-teal-900 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-200/40";

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-teal-100/40">
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Candidate
            </th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Position
            </th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Status
            </th>
            <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => (
            <tr
              key={c.id}
              className="border-b border-teal-50/40 transition-colors hover:bg-teal-50/20"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <td className="px-5 py-3.5">
                {editingId === c.id ? (
                  <div className="flex flex-col gap-1.5" style={{ minWidth: 160 }}>
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className={inputClass} />
                    <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
                    <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inputClass} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-xs font-semibold text-teal-700">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-teal-900">{c.name}</div>
                      <div className="text-[11px] text-teal-600">{c.email}</div>
                      {c.phone && <div className="text-[10px] text-teal-500">{c.phone}</div>}
                    </div>
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5">
                {editingId === c.id ? (
                  <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position" className={inputClass} style={{ minWidth: 120 }} />
                ) : (
                  <span className="text-sm text-teal-700">{c.position}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    statusStyles[c.status] ?? "bg-teal-50/60 text-teal-700"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[c.status] ?? "bg-teal-400")} />
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                <div className="inline-flex items-center gap-1.5">
                  {editingId === c.id ? (
                    <>
                      <button onClick={saveEdit} className="rounded-lg bg-emerald-50/80 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100/80" title="Save">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="rounded-lg bg-slate-50/80 p-1.5 text-slate-500 transition-colors hover:bg-slate-100/80" title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {onContactAi && (
                        <button
                          onClick={() => onContactAi(c)}
                          disabled={aiLoading === c.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500/10 to-teal-600/10 px-3.5 py-2 text-xs font-medium text-teal-700 transition-all hover:from-teal-500/20 hover:to-teal-600/20 hover:shadow-sm disabled:opacity-40"
                        >
                          {aiLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                          {aiLoading === c.id ? "Contacting..." : "Contact AI"}
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => startEdit(c)} className="rounded-lg bg-sky-50/80 p-1.5 text-sky-600 transition-colors hover:bg-sky-100/80" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => { if (confirm(`Delete ${c.name}? This will also remove their interviews.`)) onDelete(c.id); }}
                          disabled={deleteLoading === c.id}
                          className="rounded-lg bg-rose-50/80 p-1.5 text-rose-500 transition-colors hover:bg-rose-100/80 disabled:opacity-40"
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
          <p className="text-sm text-teal-600">No candidates yet</p>
          <p className="mt-1 text-xs text-teal-500">Add your first candidate above</p>
        </div>
      )}
    </div>
  );
}
