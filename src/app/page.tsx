"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metrics-cards";

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

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch("/api/analytics?days=30")
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics))
      .catch(console.error);

    fetch("/api/candidates")
      .then((r) => r.json())
      .then(() => {})
      .catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Overview of your recruitment metrics and activity
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Candidates"
          value={metrics?.totalCandidates ?? "—"}
          subtitle="Last 30 days"
        />
        <MetricCard
          title="Interviews Scheduled"
          value={metrics?.interviewsScheduled ?? "—"}
          subtitle="Last 30 days"
        />
        <MetricCard
          title="No-Show Rate"
          value={
            metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"
          }
          subtitle={
            metrics?.noShowCount
              ? `${metrics.noShowCount} no-shows`
              : undefined
          }
        />
        <MetricCard
          title="Total Cost"
          value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"}
          subtitle={
            metrics?.hiresCount
              ? `$${metrics.costPerHire.toFixed(0)} per hire`
              : undefined
          }
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Communication Stats
          </h2>
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between">
              <dt className="text-slate-500">Emails sent</dt>
              <dd className="font-medium">{metrics?.emailsSent ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">SMS sent</dt>
              <dd className="font-medium">{metrics?.smsSent ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email response rate</dt>
              <dd className="font-medium">
                {metrics
                  ? `${(metrics.responseRateEmail * 100).toFixed(0)}%`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">SMS response rate</dt>
              <dd className="font-medium">
                {metrics
                  ? `${(metrics.responseRateSms * 100).toFixed(0)}%`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href="/candidates"
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add Candidate
            </a>
            <a
              href="/candidates"
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Contact via AI
            </a>
            <a
              href="/interviews"
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Interviews
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
