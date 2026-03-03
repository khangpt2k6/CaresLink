"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metrics-cards";
import Image from "next/image";
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
    <div className="p-8 max-w-5xl">
      {/* Cover Banner */}
      <div className="mb-8 overflow-hidden rounded-lg">
        <Image
          src="/careslink_cover.jpg"
          alt="CaresLink"
          width={1200}
          height={200}
          className="w-full h-36 object-cover"
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-[#37352f]">Dashboard</h1>
      <p className="mt-1 text-sm text-[#9b9a97]">Overview of your recruitment pipeline</p>

      {/* Metric Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {/* Bottom Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Communications */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#37352f]">Communications</h2>
          <p className="mb-4 text-xs text-[#9b9a97]">Last 30 days activity</p>
          <dl className="space-y-2">
            {[
              { icon: Mail, label: "Emails sent", val: metrics?.emailsSent },
              { icon: MessageSquare, label: "SMS sent", val: metrics?.smsSent },
              { icon: Mail, label: "Email response", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
              { icon: MessageSquare, label: "SMS response", val: metrics ? `${(metrics.responseRateSms * 100).toFixed(0)}%` : null },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[#f7f7f5] transition-colors"
              >
                <dt className="flex items-center gap-2.5 text-sm text-[#73726e]">
                  <row.icon className="h-4 w-4 text-[#9b9a97]" />
                  {row.label}
                </dt>
                <dd className="text-sm font-medium text-[#37352f]">
                  {row.val ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#37352f]">Quick Actions</h2>
          <p className="mb-4 text-xs text-[#9b9a97]">Jump to common tasks</p>
          <div className="space-y-1">
            {[
              { href: "/candidates", label: "Add Candidate", desc: "Add a new recruitment candidate" },
              { href: "/candidates", label: "Contact via AI", desc: "Let AI draft & send outreach" },
              { href: "/interviews", label: "Book Interview", desc: "Schedule & send calendar invite" },
              { href: "/insights", label: "View Insights", desc: "Analytics & recommendations" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-[#f7f7f5]"
              >
                <div>
                  <p className="text-sm font-medium text-[#37352f]">{action.label}</p>
                  <p className="text-xs text-[#9b9a97]">{action.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[#d4d4d0] transition-all group-hover:translate-x-0.5 group-hover:text-[#9b9a97]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
