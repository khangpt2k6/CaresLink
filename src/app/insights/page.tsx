"use client";

import { useEffect, useState } from "react";
import { InsightsList } from "@/components/insights-list";
import { ResponseRateChart, CommunicationPieChart } from "@/components/charts";
import { Loader2 } from "lucide-react";

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
      <div className="flex items-center justify-center p-6 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-teal-900">Insights</h1>
        <p className="text-sm text-teal-700">Data-driven recommendations</p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-xl px-5 py-4">
          <h2 className="mb-2 text-sm font-medium text-teal-800">Response Rate</h2>
          <ResponseRateChart metrics={metrics ?? emptyMetrics} />
        </div>
        <div className="glass rounded-xl px-5 py-4">
          <h2 className="mb-2 text-sm font-medium text-teal-800">Communications</h2>
          <CommunicationPieChart metrics={metrics ?? emptyMetrics} />
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium text-teal-800">Recommendations</h2>
      <InsightsList insights={insights} />
    </div>
  );
}
