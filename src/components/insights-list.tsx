"use client";

import { cn } from "@/lib/utils";

interface Insight {
  title: string;
  description: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

export function InsightsList({ insights }: { insights: Insight[] }) {
  const priorityStyles = {
    high: "border-l-4 border-l-red-500",
    medium: "border-l-4 border-l-amber-500",
    low: "border-l-4 border-l-slate-400",
  };

  return (
    <div className="space-y-4">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
            priorityStyles[insight.priority]
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase text-slate-500">
                {insight.priority}
              </span>
              <h3 className="mt-1 font-semibold text-slate-900">{insight.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{insight.description}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Action: {insight.recommendedAction}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {insight.currentValue}
            </span>
          </div>
        </div>
      ))}
      {insights.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          No insights yet. Add candidates and send communications to see recommendations.
        </div>
      )}
    </div>
  );
}
