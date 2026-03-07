"use client";

import { useEffect, useState } from "react";
import { InsightsList } from "@/components/insights-list";
import { ResponseRateChart, CommunicationPieChart } from "@/components/charts";
import { BarChart3, PieChart as PieIcon, Loader2, Lightbulb } from "lucide-react";

interface Insight {
  title: string;
  description: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

interface Metrics {
  totalCandidates: number;
  emailsSent: number;
  responseRateEmail: number;
  interviewsScheduled: number;
  noShowCount: number;
  noShowRate: number;
  totalCost: number;
  costPerHire: number;
  hiresCount: number;
}

const emptyMetrics = { emailsSent: 0, responseRateEmail: 0, noShowRate: 0 };

export default function InsightsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics?days=30")
      .then((r) => r.json())
      .then((d) => { setMetrics(d.metrics); setInsights(d.insights); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">Insights</h1>
        <p className="text-sm text-[#5a6b7c]">Data-driven recommendations</p>
      </div>

      {/* Charts */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#0090d9]" />
            <h2 className="text-sm font-semibold text-[#1a2b3c]">Response Rate</h2>
          </div>
          <ResponseRateChart metrics={metrics ?? emptyMetrics} />
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-[#0090d9]" />
            <h2 className="text-sm font-semibold text-[#1a2b3c]">Communications</h2>
          </div>
          <CommunicationPieChart metrics={metrics ?? emptyMetrics} />
        </div>
      </div>

      {/* Recommendations */}
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#f59e0b]" />
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Recommendations</h2>
      </div>
      <InsightsList insights={insights} />
    </div>
  );
}
