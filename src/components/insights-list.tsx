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
  high: { border: "border-l-2 border-l-[#e03e3e]", badge: "bg-[#ffe2dd] text-[#93392e]" },
  medium: { border: "border-l-2 border-l-[#d9730d]", badge: "bg-[#fdecc8] text-[#89632a]" },
  low: { border: "border-l-2 border-l-[#0f7b6c]", badge: "bg-[#dbeddb] text-[#2b593f]" },
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
              <span className="text-xs text-[#9b9a97]">{insight.currentValue}</span>
            </div>
            <h3 className="mt-2 text-sm font-medium text-[#37352f]">{insight.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#73726e]">{insight.description}</p>
            <p className="mt-2 rounded-md bg-[#f7f7f5] px-2.5 py-1.5 text-xs text-[#73726e]">
              <span className="font-semibold text-[#37352f]">Action:</span> {insight.recommendedAction}
            </p>
          </div>
        );
      })}
      {insights.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-sm text-[#9b9a97]">No insights yet. Add candidates and send communications to see recommendations.</p>
        </div>
      )}
    </div>
  );
}
