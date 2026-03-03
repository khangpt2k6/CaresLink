"use client";

import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
}

const statusColors: Record<string, string> = {
  applied: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  scheduled: "bg-amber-100 text-amber-700",
  interviewed: "bg-purple-100 text-purple-700",
  offered: "bg-emerald-100 text-emerald-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

export function CandidateTable({
  candidates,
  onContactAi,
}: {
  candidates: Candidate[];
  onContactAi?: (candidate: Candidate) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              Position
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {candidates.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-sm text-slate-500">{c.email}</div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                {c.position}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                    statusColors[c.status] ?? "bg-slate-100 text-slate-700"
                  )}
                >
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                {onContactAi && (
                  <button
                    onClick={() => onContactAi(c)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Contact via AI
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="py-12 text-center text-slate-500">No candidates yet</div>
      )}
    </div>
  );
}
