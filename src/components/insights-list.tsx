"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

interface Insight {
  title: string;
  description: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

const priorityBorder = {
  high: "border-l-2 border-l-rose-400",
  medium: "border-l-2 border-l-amber-400",
  low: "border-l-2 border-l-teal-300",
};

const priorityBadge = {
  high: "bg-rose-100/70 text-rose-700",
  medium: "bg-amber-100/70 text-amber-700",
  low: "bg-teal-100/60 text-teal-700",
};

const priorityIcon = {
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle2,
};

export function InsightsList({ insights }: { insights: Insight[] }) {
  return (
    <div className="stagger-children space-y-3">
      {insights.map((insight, i) => {
        const Icon = priorityIcon[insight.priority];
        return (
          <div
            key={i}
            className={cn(
              "glass card-hover rounded-2xl px-5 py-4",
              priorityBorder[insight.priority]
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      priorityBadge[insight.priority]
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {insight.priority}
                  </span>
                  <span className="text-[11px] text-teal-600">
                    {insight.currentValue}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-teal-900">
                  {insight.title}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-teal-700">
                  {insight.description}
                </p>
                <p className="mt-2 rounded-lg bg-teal-50/40 px-2.5 py-1.5 text-[11px] text-teal-600">
                  <span className="font-semibold text-teal-700">Action:</span>{" "}
                  {insight.recommendedAction}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {insights.length === 0 && (
        <div className="glass rounded-2xl py-16 text-center">
          <p className="text-sm text-teal-600">
            No insights yet. Add candidates and send communications to see
            recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
