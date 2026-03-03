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
  applied: "bg-[#f1f1ef] text-[#73726e]",
  contacted: "bg-[#d3e5ef] text-[#2e6b8a]",
  scheduled: "bg-[#fdecc8] text-[#89632a]",
  interviewed: "bg-[#e8deee] text-[#6940a5]",
  offered: "bg-[#dbeddb] text-[#2b593f]",
  hired: "bg-[#dbeddb] text-[#2b593f]",
  rejected: "bg-[#ffe2dd] text-[#93392e]",
  no_show: "bg-[#fdecc8] text-[#89632a]",
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
    "w-full rounded-md border border-[#e8e8e5] bg-white px-2 py-1 text-sm text-[#37352f] focus:border-[#2383e2] focus:outline-none focus:ring-1 focus:ring-[#2383e2]/20";

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[#e8e8e5]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9b9a97]">
              Candidate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9b9a97]">
              Position
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9b9a97]">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#9b9a97]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className="border-b border-[#f0f0ee] transition-colors hover:bg-[#f7f7f5]"
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2383e2] text-xs font-medium text-white">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#37352f]">{c.name}</div>
                      <div className="text-xs text-[#9b9a97]">{c.email}</div>
                      {c.phone && <div className="text-xs text-[#b4b4b0]">{c.phone}</div>}
                    </div>
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {editingId === c.id ? (
                  <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position" className={inputClass} style={{ minWidth: 120 }} />
                ) : (
                  <span className="text-sm text-[#37352f]">{c.position}</span>
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
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1.5">
                  {editingId === c.id ? (
                    <>
                      <button onClick={saveEdit} className="rounded-md p-1.5 text-[#2b593f] hover:bg-[#dbeddb] transition-colors" title="Save">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="rounded-md p-1.5 text-[#73726e] hover:bg-[#f1f1ef] transition-colors" title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {onContactAi && (
                        <button
                          onClick={() => onContactAi(c)}
                          disabled={aiLoading === c.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#2383e2] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1b6ec2] disabled:opacity-40"
                        >
                          {aiLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                          {aiLoading === c.id ? "Contacting..." : "Contact AI"}
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => startEdit(c)} className="rounded-md p-1.5 text-[#9b9a97] hover:bg-[#f1f1ef] hover:text-[#37352f] transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => { if (confirm(`Delete ${c.name}? This will also remove their interviews.`)) onDelete(c.id); }}
                          disabled={deleteLoading === c.id}
                          className="rounded-md p-1.5 text-[#9b9a97] hover:bg-[#ffe2dd] hover:text-[#93392e] transition-colors disabled:opacity-40"
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
          <p className="text-sm text-[#9b9a97]">No candidates yet</p>
          <p className="mt-1 text-xs text-[#b4b4b0]">Add your first candidate above</p>
        </div>
      )}
    </div>
  );
}
