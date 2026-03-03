"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metrics-cards";
import {
  Users,
  CalendarCheck,
  AlertCircle,
  DollarSign,
  Mail,
  MessageSquare,
  ArrowRight,
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
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-teal-900">Dashboard</h1>
        <p className="text-sm text-teal-700">Recruitment overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Candidates" value={metrics?.totalCandidates ?? "—"} subtitle="Last 30 days" icon={Users} />
        <MetricCard title="Interviews" value={metrics?.interviewsScheduled ?? "—"} subtitle="Last 30 days" icon={CalendarCheck} />
        <MetricCard title="No-Show Rate" value={metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"} subtitle={metrics?.noShowCount ? `${metrics.noShowCount} missed` : undefined} icon={AlertCircle} />
        <MetricCard title="Total Cost" value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"} subtitle={metrics?.hiresCount ? `$${metrics.costPerHire.toFixed(0)}/hire` : undefined} icon={DollarSign} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-xl px-5 py-4">
          <h2 className="text-sm font-medium text-teal-800">Communications</h2>
          <dl className="mt-3 space-y-2.5">
            {[
              { icon: Mail, label: "Emails sent", val: metrics?.emailsSent },
              { icon: MessageSquare, label: "SMS sent", val: metrics?.smsSent },
              { icon: Mail, label: "Email response", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
              { icon: MessageSquare, label: "SMS response", val: metrics ? `${(metrics.responseRateSms * 100).toFixed(0)}%` : null },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-teal-50/30 px-3 py-2">
                <dt className="flex items-center gap-2 text-xs text-teal-700">
                  <row.icon className="h-3.5 w-3.5 text-teal-500" />
                  {row.label}
                </dt>
                <dd className="text-xs font-medium text-teal-900">{row.val ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="glass rounded-xl px-5 py-4">
          <h2 className="text-sm font-medium text-teal-800">Quick Actions</h2>
          <div className="mt-3 space-y-2">
            {[
              { href: "/candidates", label: "Add Candidate" },
              { href: "/candidates", label: "Contact via AI" },
              { href: "/interviews", label: "View Interviews" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center justify-between rounded-lg bg-teal-50/30 px-3 py-2.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50/60"
              >
                {action.label}
                <ArrowRight className="h-3 w-3 text-teal-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
