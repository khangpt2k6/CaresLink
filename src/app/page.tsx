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
  Sparkles,
  TrendingUp,
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
      {/* Hero Banner */}
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-500 px-8 py-8 text-white shadow-xl shadow-sky-500/15">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-200" />
              <span className="text-xs font-medium text-sky-100">AI-Powered Recruitment</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to CaresLink
            </h1>
            <p className="mt-1.5 max-w-md text-sm text-sky-100">
              Your AI recruitment agent is ready. Manage candidates, schedule interviews, and automate outreach — all in one place.
            </p>
            <Link
              href="/candidates"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/25"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="hidden lg:block">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
                <TrendingUp className="h-14 w-14 text-white/80" />
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-sky-200" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          value={
            metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"
          }
          subtitle={
            metrics?.noShowCount
              ? `${metrics.noShowCount} missed`
              : undefined
          }
          icon={AlertCircle}
        />
        <MetricCard
          title="Total Cost"
          value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"}
          subtitle={
            metrics?.hiresCount
              ? `$${metrics.costPerHire.toFixed(0)}/hire`
              : undefined
          }
          icon={DollarSign}
        />
      </div>

      {/* Bottom Grid */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Communications */}
        <div className="glass rounded-2xl px-5 py-5">
          <h2 className="text-sm font-semibold text-sky-800">
            Communications
          </h2>
          <p className="mb-3 text-[11px] text-sky-600">Last 30 days activity</p>
          <dl className="space-y-2">
            {[
              {
                icon: Mail,
                label: "Emails sent",
                val: metrics?.emailsSent,
              },
              {
                icon: MessageSquare,
                label: "SMS sent",
                val: metrics?.smsSent,
              },
              {
                icon: Mail,
                label: "Email response",
                val: metrics
                  ? `${(metrics.responseRateEmail * 100).toFixed(0)}%`
                  : null,
              },
              {
                icon: MessageSquare,
                label: "SMS response",
                val: metrics
                  ? `${(metrics.responseRateSms * 100).toFixed(0)}%`
                  : null,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl bg-sky-50/30 px-3.5 py-2.5 transition-colors hover:bg-sky-50/50"
              >
                <dt className="flex items-center gap-2.5 text-xs text-sky-700">
                  <div className="rounded-lg bg-sky-100/50 p-1.5">
                    <row.icon className="h-3 w-3 text-sky-500" />
                  </div>
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-sky-900">
                  {row.val ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="glass rounded-2xl px-5 py-5">
          <h2 className="text-sm font-semibold text-sky-800">
            Quick Actions
          </h2>
          <p className="mb-3 text-[11px] text-sky-600">Jump to common tasks</p>
          <div className="space-y-2">
            {[
              { href: "/candidates", label: "Add Candidate", desc: "Add a new recruitment candidate" },
              { href: "/candidates", label: "Contact via AI", desc: "Let AI draft & send outreach" },
              { href: "/interviews", label: "Book Interview", desc: "Schedule & send calendar invite" },
              { href: "/insights", label: "View Insights", desc: "Analytics & recommendations" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center justify-between rounded-xl bg-sky-50/30 px-3.5 py-3 transition-all hover:bg-sky-50/50 hover:shadow-sm"
              >
                <div>
                  <p className="text-xs font-medium text-sky-800">{action.label}</p>
                  <p className="text-[11px] text-sky-600">{action.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-sky-400 transition-all group-hover:translate-x-0.5 group-hover:text-sky-600" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
