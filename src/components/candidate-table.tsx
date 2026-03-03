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

const statusColors: Record<string, string> = {
  applied: "bg-teal-50/60 text-teal-700",
  contacted: "bg-teal-50/80 text-teal-700",
  scheduled: "bg-teal-100/60 text-teal-700",
  interviewed: "bg-teal-100/80 text-teal-700",
  offered: "bg-teal-200/50 text-teal-700",
  hired: "bg-teal-200/70 text-teal-900",
  rejected: "bg-teal-50/40 text-teal-700",
  no_show: "bg-teal-50/40 text-teal-700",
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
    <div className="glass overflow-hidden rounded-xl">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-teal-100/40">
            <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-teal-700">
              Candidate
            </th>
            <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-teal-700">
              Position
            </th>
            <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-teal-700">
              Status
            </th>
            <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-teal-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className="border-b border-teal-50/40 transition-colors hover:bg-teal-50/20"
            >
              <td className="whitespace-nowrap px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100/50 text-xs font-medium text-teal-700">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-teal-900">{c.name}</div>
                    <div className="text-[11px] text-teal-700">{c.email}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-sm text-teal-700">
                {c.position}
              </td>
              <td className="whitespace-nowrap px-5 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                    statusColors[c.status] ?? "bg-teal-50/60 text-teal-700"
                  )}
                >
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right">
                {onContactAi && (
                  <button
                    onClick={() => onContactAi(c)}
                    disabled={aiLoading === c.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/20 disabled:opacity-40"
                  >
                    {aiLoading === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Bot className="h-3 w-3" />
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
        <div className="py-12 text-center text-sm text-teal-700">
          No candidates yet
        </div>
      )}
    </div>
  );
}
