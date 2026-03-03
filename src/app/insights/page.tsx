"use client";

import { useEffect, useState } from "react";
import { InsightsList } from "@/components/insights-list";
import { ResponseRateChart, CommunicationPieChart } from "@/components/charts";

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

export default function InsightsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    fetch("/api/analytics?days=30")
      .then((r) => r.json())
      .then((d) => {
        setMetrics(d.metrics);
        setInsights(d.insights);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Data-Driven Insights</h1>
        <p className="mt-1 text-slate-500">
          Optimization recommendations based on your recruitment data
        </p>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Response Rate by Channel
          </h2>
          <ResponseRateChart metrics={metrics ?? { emailsSent: 0, smsSent: 0, responseRateEmail: 0, responseRateSms: 0, noShowRate: 0 }} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Communications Sent
          </h2>
          <CommunicationPieChart metrics={metrics ?? { emailsSent: 0, smsSent: 0, responseRateEmail: 0, responseRateSms: 0, noShowRate: 0 }} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Optimization Recommendations
        </h2>
        <InsightsList insights={insights} />
      </div>
    </div>
  );
}
