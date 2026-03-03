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
  smsSent: number;
  responseRateEmail: number;
  responseRateSms: number;
  interviewsScheduled: number;
  noShowCount: number;
  noShowRate: number;
  totalCost: number;
  costPerHire: number;
  hiresCount: number;
}

const emptyMetrics = { emailsSent: 0, smsSent: 0, responseRateEmail: 0, responseRateSms: 0, noShowRate: 0 };

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
      <div className="flex items-center justify-center p-8 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-[#37352f]">Insights</h1>
      <p className="mt-1 text-sm text-[#9b9a97]">Data-driven recommendations</p>

      {/* Charts */}
      <div className="mt-6 mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#9b9a97]" />
            <h2 className="text-sm font-semibold text-[#37352f]">Response Rate</h2>
          </div>
          <ResponseRateChart metrics={metrics ?? emptyMetrics} />
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-[#9b9a97]" />
            <h2 className="text-sm font-semibold text-[#37352f]">Communications</h2>
          </div>
          <CommunicationPieChart metrics={metrics ?? emptyMetrics} />
        </div>
      </div>

      {/* Recommendations */}
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#9b9a97]" />
        <h2 className="text-sm font-semibold text-[#37352f]">Recommendations</h2>
      </div>
      <InsightsList insights={insights} />
    </div>
  );
}
