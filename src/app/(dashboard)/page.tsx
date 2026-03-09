"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MetricCard, MetricsSection } from "@/components/metrics-cards";
import { CandidateDashboard } from "@/components/candidate-dashboard";
import { motion } from "framer-motion";
import {
  Users,
  CalendarCheck,
  AlertCircle,
  DollarSign,
  Mail,
  Bot,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";

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

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };
}

export default function DashboardPage() {
  const { user } = useUser();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRole(d.role));
  }, []);

  const isCandidate = role === "CANDIDATE";

  useEffect(() => {
    if (isCandidate) return;
    fetch("/api/analytics?days=30")
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics))
      .catch(console.error);
  }, [isCandidate]);

  if (isCandidate) {
    return <CandidateDashboard />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <motion.div
        {...fadeUp(0)}
        className="mb-5"
      >
        <h1 className="text-xl font-bold text-[#1a2b3c]">
          {user?.firstName ? `Welcome back, ${user.firstName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#5a6b7c]">Overview of your recruitment pipeline</p>
      </motion.div>

      {/* Metric Cards */}
      <motion.div
        {...fadeUp(0.06)}
      >
        <MetricsSection>
          <MetricCard index={0} title="Candidates" value={metrics?.totalCandidates ?? "—"} subtitle="Last 30 days" icon={Users} />
          <MetricCard index={1} title="Interviews" value={metrics?.interviewsScheduled ?? "—"} subtitle="Last 30 days" icon={CalendarCheck} />
          <MetricCard index={2} title="No-Show Rate" value={metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"} subtitle={metrics?.noShowCount ? `${metrics.noShowCount} missed` : undefined} icon={AlertCircle} />
          <MetricCard index={3} title="Total Cost" value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"} subtitle={metrics?.hiresCount ? `$${metrics.costPerHire.toFixed(0)}/hire` : undefined} icon={DollarSign} />
        </MetricsSection>
      </motion.div>

      {/* Bottom Grid */}
      <motion.div
        {...fadeUp(0.15)}
        className="mt-4 grid gap-4 lg:grid-cols-2"
      >
        {/* Communications */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Communications</h2>
          <p className="mb-3 text-xs text-[#8a95a3]">Last 30 days activity</p>
          <dl className="space-y-1">
            {[
              { icon: Mail, label: "Emails sent", val: metrics?.emailsSent },
              { icon: Mail, label: "Email response", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
            ].map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors"
              >
                <dt className="flex items-center gap-2.5 text-sm text-[#5a6b7c]">
                  <row.icon className="h-4 w-4 text-[#0090d9]" />
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-[#1a2b3c]">
                  {row.val ?? "—"}
                </dd>
              </motion.div>
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
            ].map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.22 + i * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
              >
                <Link
                  href={action.href}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-4 text-center transition-all duration-200 hover:border-[#0090d9]/30 hover:bg-[#f0f7ff] hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f4fd] group-hover:bg-[#d0ebf9] transition-colors duration-200">
                    <action.icon className="h-4.5 w-4.5 text-[#0090d9]" style={{ width: 18, height: 18 }} />
                  </div>
                  <p className="text-xs font-medium text-[#1a2b3c]">{action.label}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
