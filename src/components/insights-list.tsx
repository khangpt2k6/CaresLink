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

const priorityBorder = {
  high: "border-l-2 border-l-teal-500",
  medium: "border-l-2 border-l-teal-300",
  low: "border-l-2 border-l-teal-200",
};

const priorityBadge = {
  high: "bg-teal-100/60 text-teal-700",
  medium: "bg-teal-50/80 text-teal-600",
  low: "bg-teal-50/50 text-teal-700",
};

export function InsightsList({ insights }: { insights: Insight[] }) {
  return (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={cn("glass card-hover rounded-xl px-5 py-4", priorityBorder[insight.priority])}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", priorityBadge[insight.priority])}>
                  {insight.priority}
                </span>
                <span className="text-[11px] text-teal-600">{insight.currentValue}</span>
              </div>
              <h3 className="mt-1.5 text-sm font-medium text-teal-900">{insight.title}</h3>
              <p className="mt-0.5 text-xs text-teal-700">{insight.description}</p>
              <p className="mt-2 text-[11px] text-teal-600">
                <span className="font-medium text-teal-700">Action:</span> {insight.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      ))}
      {insights.length === 0 && (
        <div className="glass rounded-xl py-12 text-center text-sm text-teal-600">
          No insights yet. Add candidates and send communications to see recommendations.
        </div>
      )}
    </div>
  );
}
