"use client";

import { useEffect, useState } from "react";
import { MetricCard, MetricsSection } from "@/components/metrics-cards";
import {
  Users,
  CalendarCheck,
  AlertCircle,
  DollarSign,
  Mail,
  MessageSquare,
  Bot,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";

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
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">Dashboard</h1>
        <p className="text-sm text-[#5a6b7c]">Overview of your recruitment pipeline</p>
      </div>

      {/* Metric Cards */}
      <MetricsSection>
        <MetricCard
          title="Candidates"
          value={metrics?.totalCandidates ?? "—"}
          subtitle="Last 30 days"
          icon={Users}
        />
        <MetricCard
          title="Interviews"
          value={metrics?.interviewsScheduled ?? "—"}
          subtitle="Last 30 days"
          icon={CalendarCheck}
        />
        <MetricCard
          title="No-Show Rate"
          value={metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"}
          subtitle={metrics?.noShowCount ? `${metrics.noShowCount} missed` : undefined}
          icon={AlertCircle}
        />
        <MetricCard
          title="Total Cost"
          value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"}
          subtitle={metrics?.hiresCount ? `$${metrics.costPerHire.toFixed(0)}/hire` : undefined}
          icon={DollarSign}
        />
      </MetricsSection>

      {/* Bottom Grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Communications */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Communications</h2>
          <p className="mb-3 text-xs text-[#8a95a3]">Last 30 days activity</p>
          <dl className="space-y-1">
            {[
              { icon: Mail, label: "Emails sent", val: metrics?.emailsSent },
              { icon: MessageSquare, label: "SMS sent", val: metrics?.smsSent },
              { icon: Mail, label: "Email response", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
              { icon: MessageSquare, label: "SMS response", val: metrics ? `${(metrics.responseRateSms * 100).toFixed(0)}%` : null },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors"
              >
                <dt className="flex items-center gap-2.5 text-sm text-[#5a6b7c]">
                  <row.icon className="h-4 w-4 text-[#0090d9]" />
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-[#1a2b3c]">
                  {row.val ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Quick Actions</h2>
          <p className="mb-3 text-xs text-[#8a95a3]">Jump to common tasks</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/candidates", label: "Add Candidate", icon: Users },
              { href: "/candidates", label: "Contact via AI", icon: Bot },
              { href: "/interviews", label: "Book Interview", icon: CalendarCheck },
              { href: "/insights", label: "View Insights", icon: Lightbulb },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex flex-col items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-4 text-center transition-colors hover:border-[#0090d9]/30 hover:bg-[#f8fafc]"
              >
                <action.icon className="h-5 w-5 text-[#0090d9] transition-colors" />
                <p className="text-xs font-medium text-[#1a2b3c]">{action.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
