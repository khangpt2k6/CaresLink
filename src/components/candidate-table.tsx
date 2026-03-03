"use client";

import { cn } from "@/lib/utils";
import { Bot, Loader2 } from "lucide-react";

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
  aiLoading,
}: {
  candidates: Candidate[];
  onContactAi?: (candidate: Candidate) => void;
  aiLoading?: string | null;
}) {
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
              <td className="whitespace-nowrap px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-xs font-semibold text-teal-700">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-teal-900">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-teal-600">{c.email}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-sm text-teal-700">
                {c.position}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    statusStyles[c.status] ?? "bg-teal-50/60 text-teal-700"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      statusDot[c.status] ?? "bg-teal-400"
                    )}
                  />
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                {onContactAi && (
                  <button
                    onClick={() => onContactAi(c)}
                    disabled={aiLoading === c.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500/10 to-teal-600/10 px-3.5 py-2 text-xs font-medium text-teal-700 transition-all hover:from-teal-500/20 hover:to-teal-600/20 hover:shadow-sm disabled:opacity-40"
                  >
                    {aiLoading === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                    {aiLoading === c.id ? "Contacting..." : "Contact AI"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-teal-600">No candidates yet</p>
          <p className="mt-1 text-xs text-teal-500">
            Add your first candidate above
          </p>
        </div>
      )}
    </div>
  );
}
