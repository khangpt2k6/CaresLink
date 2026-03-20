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
  Clock,
  Briefcase,
  MapPin,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Sparkles,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface AgentRun {
  id: string;
  trigger: string;
  report: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  status: string;
  candidateCount: number;
}

interface DashCandidate {
  id: string;
  name: string;
  email: string;
  position: string;
  status: string;
  appliedAt: string;
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

interface CredentialCheckSummary {
  id: string;
  firstName: string;
  lastName: string;
  roleType: string;
  status: string;
  aiRecommendation: string | null;
  createdAt: string;
}

interface TopMatch {
  candidateName: string;
  candidatePosition: string;
  score: number;
  label: string;
  reason: string;
  jobTitle: string;
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
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<DashCandidate[]>([]);
  const [credentialChecks, setCredentialChecks] = useState<CredentialCheckSummary[]>([]);
  const [topMatches, setTopMatches] = useState<TopMatch[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRole(d.role));
  }, []);

  const isCandidate = role === "CANDIDATE";
  const isLoading = role === null;

  useEffect(() => {
    if (isCandidate) return;
    fetch("/api/analytics?days=30")
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics))
      .catch(console.error);
    fetch("/api/agent/runs")
      .then((r) => r.json())
      .then((d) => setAgentRuns(d.runs ?? []))
      .catch(console.error);
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(Array.isArray(d) ? d : []))
      .catch(console.error);
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => setCandidates(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(console.error);
    fetch("/api/credential-check")
      .then((r) => r.json())
      .then((d) => setCredentialChecks(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(console.error);
    fetch("/api/dashboard/top-matches")
      .then((r) => r.json())
      .then((d) => setTopMatches(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [isCandidate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-[#0090d9]"
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.12,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

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
              { icon: Mail, label: "Booking conversion", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
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
          <p className="mb-3 text-xs text-[#8a95a3]">Navigate your workspace</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: "/jobs", label: "Job Postings", desc: "Create and manage open roles", icon: Briefcase },
              { href: "/candidates", label: "Candidate Pipeline", desc: "Track and review applicants", icon: Users },
              { href: "/interviews", label: "Interview Schedule", desc: "View upcoming interviews", icon: CalendarCheck },
              { href: "/credential-check", label: "Credential Check", desc: "Verify nursing licenses", icon: ClipboardCheck },
              { href: "/matching", label: "AI Job Matching", desc: "Match candidates to jobs", icon: Sparkles },
              { href: "/calendar", label: "Calendar Overview", desc: "Edit your availability", icon: Calendar },
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
                  <p className="text-[10px] text-[#8a95a3] leading-tight">{action.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Jobs & Candidates */}
      <motion.div {...fadeUp(0.18)} className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Jobs */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Jobs</h2>
              <p className="text-xs text-[#8a95a3]">Your posted positions</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Briefcase className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-xs text-[#8a95a3]">No jobs posted yet</p>
              <Link href="/jobs" className="mt-2 text-xs font-medium text-[#0090d9] hover:underline">Post your first job</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {jobs.slice(0, 4).map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href="/jobs" className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f4fd]">
                        <Briefcase className="h-3.5 w-3.5 text-[#0090d9]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1a2b3c]">{job.title}</p>
                        <p className="flex items-center gap-2 text-[11px] text-[#8a95a3]">
                          <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{job.location}</span>
                          <span>{job.type}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-[#5a6b7c]">{job.candidateCount} applicant{job.candidateCount !== 1 ? "s" : ""}</span>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${job.status === "open" ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#fffbeb] text-[#b45309]"}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Candidates */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Candidates</h2>
              <p className="text-xs text-[#8a95a3]">Recent applicants</p>
            </div>
            <Link href="/candidates" className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-xs text-[#8a95a3]">No candidates yet</p>
              <Link href="/candidates" className="mt-2 text-xs font-medium text-[#0090d9] hover:underline">Add your first candidate</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {candidates.map((c, i) => {
                const statusColors: Record<string, string> = {
                  applied: "bg-[#f1f5f9] text-[#64748b]",
                  contacted: "bg-[#dbeafe] text-[#2563eb]",
                  scheduled: "bg-[#fffbeb] text-[#b45309]",
                  interviewed: "bg-[#e0e7ff] text-[#4f46e5]",
                  offered: "bg-[#ecfdf5] text-[#059669]",
                  hired: "bg-[#ecfdf5] text-[#059669]",
                  rejected: "bg-[#fef2f2] text-[#dc2626]",
                  no_show: "bg-[#fffbeb] text-[#b45309]",
                };
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href="/candidates" className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0090d9] text-[10px] font-medium text-white">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a2b3c]">{c.name}</p>
                          <p className="text-[11px] text-[#8a95a3]">{c.position}</p>
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[c.status] || statusColors.applied}`}>
                        {c.status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Credential Verification & AI Matching */}
      <motion.div {...fadeUp(0.2)} className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Credential Checks */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Credential Verification</h2>
              <p className="text-xs text-[#8a95a3]">Recent license checks</p>
            </div>
            <Link href="/credential-check" className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {credentialChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ShieldCheck className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-xs text-[#8a95a3]">No credential checks yet</p>
              <Link href="/credential-check" className="mt-2 text-xs font-medium text-[#0090d9] hover:underline">Run your first check</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {credentialChecks.map((check, i) => {
                const recColors: Record<string, string> = {
                  EMPLOYABLE: "bg-[#ecfdf5] text-[#059669]",
                  REVIEW_REQUIRED: "bg-[#fffbeb] text-[#b45309]",
                  NOT_EMPLOYABLE: "bg-[#fef2f2] text-[#dc2626]",
                };
                const recIcons: Record<string, React.ReactNode> = {
                  EMPLOYABLE: <CheckCircle2 className="h-3 w-3" />,
                  REVIEW_REQUIRED: <AlertTriangle className="h-3 w-3" />,
                  NOT_EMPLOYABLE: <XCircle className="h-3 w-3" />,
                };
                const statusColors: Record<string, string> = {
                  COMPLETED: "bg-[#ecfdf5] text-[#059669]",
                  PENDING: "bg-[#fffbeb] text-[#b45309]",
                  IN_PROGRESS: "bg-[#dbeafe] text-[#2563eb]",
                  FAILED: "bg-[#fef2f2] text-[#dc2626]",
                };
                return (
                  <motion.div
                    key={check.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href={`/credential-check/${check.id}`} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f4fd]">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#0090d9]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a2b3c]">{check.firstName} {check.lastName}</p>
                          <p className="text-[11px] text-[#8a95a3]">{check.roleType === "NURSE" ? "Nurse (RN)" : "CNA"}</p>
                        </div>
                      </div>
                      {check.aiRecommendation ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${recColors[check.aiRecommendation] || ""}`}>
                          {recIcons[check.aiRecommendation]}
                          {check.aiRecommendation.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      ) : (
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[check.status] || statusColors.PENDING}`}>
                          {check.status.charAt(0) + check.status.slice(1).toLowerCase().replace(/_/g, " ")}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Job Matching */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">AI Job Matching</h2>
              <p className="text-xs text-[#8a95a3]">Top candidate matches</p>
            </div>
            <Link href="/matching" className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Sparkles className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-xs text-[#8a95a3]">No match analyses yet</p>
              <Link href="/matching" className="mt-2 text-xs font-medium text-[#0090d9] hover:underline">Run AI matching</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {topMatches.map((match, i) => {
                const scoreColor = match.score >= 90
                  ? "text-emerald-600 bg-emerald-50"
                  : match.score >= 75
                    ? "text-blue-600 bg-blue-50"
                    : match.score >= 50
                      ? "text-amber-600 bg-amber-50"
                      : "text-red-600 bg-red-50";
                return (
                  <motion.div
                    key={`${match.candidateName}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href="/matching" className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0090d9] text-[10px] font-medium text-white">
                          {match.candidateName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a2b3c]">{match.candidateName}</p>
                          <p className="text-[11px] text-[#8a95a3]">{match.jobTitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#8a95a3]">{match.label}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${scoreColor}`}>
                          {match.score}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Agent Activity Log */}
      <motion.div {...fadeUp(0.25)} className="mt-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Agent Activity</h2>
              <p className="text-xs text-[#8a95a3]">What the AI did autonomously</p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f4fd]">
              <Bot className="h-3.5 w-3.5 text-[#0090d9]" />
            </div>
          </div>

          {agentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="mb-2 h-8 w-8 text-[#d0dbe6]" />
              <p className="text-sm text-[#8a95a3]">No agent runs yet</p>
              <p className="mt-0.5 text-xs text-[#b0bec8]">The agent runs every weekday at 9 AM automatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agentRuns.map((run, i) => {
                const isError = run.report.startsWith("ERROR:");
                const date = new Date(run.createdAt);
                const timeAgo = (() => {
                  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
                  if (diff < 60) return "just now";
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                  return `${Math.floor(diff / 86400)}d ago`;
                })();
                const durationSec = Math.round(
                  (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                );

                // Parse the report into structured sections
                const parseReport = (report: string) => {
                  const headlineMatch = new RegExp("^(.*?)(?:\\*\\*Task Completion Summary:\\*\\*|$)", "s").exec(report);
                  const headline = headlineMatch?.[1]?.replace(/\*\*/g, "").trim() || "";

                  const tasks: { name: string; detail: string; success: boolean }[] = [];
                  const taskRegex = new RegExp("\\*\\*TASK\\s*\\d+\\s*[-–]\\s*(.*?):\\*\\*\\s*(.*?)(?=\\*\\*TASK|\\*\\*Total|$)", "gs");
                  let match;
                  while ((match = taskRegex.exec(report)) !== null) {
                    tasks.push({
                      name: match[1].trim(),
                      detail: match[2].replace(/\*\*/g, "").trim(),
                      success: !match[2].toLowerCase().includes("error") && !match[2].toLowerCase().includes("fail"),
                    });
                  }

                  const totalsMatch = new RegExp("\\*\\*Total Actions Completed:\\*\\*(.*?)$", "s").exec(report);
                  const totalsRaw = totalsMatch?.[1]?.replace(/\*\*/g, "").trim() || "";
                  const totals: { label: string; value: string }[] = [];
                  const totalParts = totalsRaw.split(/\s*[-–]\s*/);
                  for (const part of totalParts) {
                    const kv = part.match(/(.*?):\s*(.*)/);
                    if (kv) totals.push({ label: kv[1].trim(), value: kv[2].trim() });
                  }

                  return { headline, tasks, totals };
                };

                const { headline, tasks, totals } = parseReport(run.report);

                return (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className={`overflow-hidden rounded-xl border ${
                      isError ? "border-red-200 bg-red-50" : "border-[#e2e8f0] bg-white"
                    }`}
                  >
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-2.5 ${
                      isError ? "bg-red-100" : "bg-[#f5faff]"
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          isError ? "bg-red-200" : "bg-[#0090d9]/10"
                        }`}>
                          <Bot className={`h-3 w-3 ${isError ? "text-red-500" : "text-[#0090d9]"}`} />
                        </div>
                        <span className="text-xs font-medium text-[#1a2b3c]">Agent Run</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          run.trigger === "cron"
                            ? "bg-violet-100 text-violet-600"
                            : "bg-[#e8f4fd] text-[#0090d9]"
                        }`}>
                          {run.trigger === "cron" ? "Scheduled" : "Manual"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[10px] text-[#8a95a3]">
                        <span>{durationSec}s</span>
                        <span>{timeAgo}</span>
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {/* Headline */}
                      {headline && (
                        <p className={`text-xs font-medium ${isError ? "text-red-600" : "text-[#1a2b3c]"}`}>
                          {headline}
                        </p>
                      )}

                      {/* Tasks */}
                      {tasks.length > 0 && (
                        <div className="space-y-1.5">
                          {tasks.map((task, ti) => (
                            <div key={ti} className="flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2">
                              <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                                task.success ? "bg-emerald-100" : "bg-red-100"
                              }`}>
                                {task.success ? (
                                  <svg className="h-2.5 w-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="h-2.5 w-2.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-[#1a2b3c]">{task.name}</span>
                                <p className="text-[11px] text-[#5a6b7c] leading-relaxed">{task.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Totals */}
                      {totals.length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-[#e2e8f0] pt-2.5">
                          {totals.map((t, ti) => (
                            <div key={ti} className="flex items-center gap-1.5 rounded-full bg-[#f0f4f8] px-2.5 py-1">
                              <span className="text-[10px] text-[#8a95a3]">{t.label}</span>
                              <span className="text-[10px] font-semibold text-[#1a2b3c]">{t.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fallback: show raw text if nothing was parsed */}
                      {!headline && tasks.length === 0 && totals.length === 0 && (
                        <p className={`text-xs leading-relaxed ${isError ? "text-red-600" : "text-[#5a6b7c]"}`}>
                          {run.report}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
