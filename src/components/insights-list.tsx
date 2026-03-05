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

const priorityStyles = {
  high: { border: "border-l-3 border-l-[#ef4444]", badge: "bg-[#fef2f2] text-[#dc2626]" },
  medium: { border: "border-l-3 border-l-[#f59e0b]", badge: "bg-[#fffbeb] text-[#b45309]" },
  low: { border: "border-l-3 border-l-[#10b981]", badge: "bg-[#ecfdf5] text-[#059669]" },
};

const priorityIcon = { high: AlertTriangle, medium: Info, low: CheckCircle2 };

export function InsightsList({ insights }: { insights: Insight[] }) {
  return (
    <div className="space-y-3">
      {insights.map((insight, i) => {
        const Icon = priorityIcon[insight.priority];
        const style = priorityStyles[insight.priority];
        return (
          <div key={i} className={cn("card px-5 py-4", style.border)}>
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase", style.badge)}>
                <Icon className="h-2.5 w-2.5" />
                {insight.priority}
              </span>
              <span className="text-xs text-[#8a95a3]">{insight.currentValue}</span>
            </div>
            <h3 className="mt-2 text-sm font-medium text-[#1a2b3c]">{insight.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5a6b7c]">{insight.description}</p>
            <p className="mt-2 rounded-lg bg-[#f0f4f8] px-2.5 py-1.5 text-xs text-[#5a6b7c]">
              <span className="font-semibold text-[#1a2b3c]">Action:</span> {insight.recommendedAction}
            </p>
          </div>
        );
      })}
      {insights.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-sm text-[#8a95a3]">No insights yet. Add candidates and send communications to see recommendations.</p>
        </div>
      )}
    </div>
  );
}
