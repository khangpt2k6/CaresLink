"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { MetricCard, MetricsSection } from "@/components/metrics-cards";
import { CandidateDashboard } from "@/components/candidate-dashboard";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Activity,
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
  recruiterDecision: string | null;
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

// ── Parse agent report into structured lines ─────────────────
interface ParsedReport {
  headline: string | null;
  lines: { type: "contact" | "followup" | "reminder" | "embed" | "info" | "error"; text: string }[];
}

function parseAgentReport(report: string): ParsedReport {
  const clean = report.replace(/\*\*/g, "").replace(/##/g, "").replace(/✅/g, "").trim();
  const lines: ParsedReport["lines"] = [];
  let headline: string | null = null;

  // Split by common delimiters in the reports
  const parts = clean
    .split(/(?:\.\s+(?=[A-Z])|\s*-\s+(?=[A-Z])|\s*(?:TASK\s*\d+\s*[-–]\s*))/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  for (const part of parts) {
    const lower = part.toLowerCase();

    // Detect type
    if (/^contacted\s+\d+/i.test(part)) {
      if (!headline) headline = part.endsWith(".") ? part : part + ".";
      lines.push({ type: "contact", text: part });
    } else if (/follow.?up/i.test(lower)) {
      lines.push({ type: "followup", text: part });
    } else if (/reminder/i.test(lower)) {
      lines.push({ type: "reminder", text: part });
    } else if (/embed/i.test(lower)) {
      lines.push({ type: "embed", text: part });
    } else if (/error|fail/i.test(lower)) {
      lines.push({ type: "error", text: part });
    } else if (part.length > 10) {
      lines.push({ type: "info", text: part });
    }
  }

  // If nothing parsed, fall back to sentence splitting
  if (lines.length === 0) {
    const sentences = clean.split(/(?<=\.)\s+/).filter((s) => s.length > 5);
    for (const s of sentences) {
      lines.push({ type: "info", text: s });
    }
  }

  return { headline, lines };
}

// ── Typing animation component ──────────────────────────────
function TypingLine({ text, delay, icon }: { text: string; delay: number; icon: React.ReactNode }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current += 2; // 2 chars at a time for speed
        if (indexRef.current >= text.length) {
          setDisplayed(text);
          setDone(true);
          clearInterval(interval);
        } else {
          setDisplayed(text.slice(0, indexRef.current));
        }
      }, 12); // Fast typing
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000, duration: 0.25 }}
      className="flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2"
    >
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <p className="text-xs leading-relaxed text-[#5a6b7c]">
        {displayed}
        {!done && (
          <motion.span
            className="inline-block ml-0.5 h-3.5 w-[2px] bg-[#0090d9] align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </p>
    </motion.div>
  );
}

// Stagger animation for children
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };
}

// Collapsible card with show more / show less
function CollapsibleCard({
  title,
  subtitle,
  icon: Icon,
  href,
  emptyIcon: EmptyIcon,
  emptyText,
  emptyAction,
  children,
  count,
  defaultExpanded = true,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  href: string;
  emptyIcon: React.ElementType;
  emptyText: string;
  emptyAction: string;
  children: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  delay?: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      {...fadeUp(delay)}
      className="card overflow-hidden"
    >
      {/* Header — always visible, clickable to toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[#f8fafc] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f4fd]">
            <Icon className="h-3.5 w-3.5 text-[#0090d9]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1a2b3c]">{title}</h2>
            <p className="text-[11px] text-[#8a95a3]">{subtitle}</p>
          </div>
          {count > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0090d9]/10 px-1.5 text-[10px] font-semibold text-[#0090d9]">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-medium text-[#0090d9] hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#f0f4f8] px-5 pb-4 pt-2">
              {count === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <EmptyIcon className="mb-2 h-6 w-6 text-[#d0dbe6]" />
                  <p className="text-xs text-[#8a95a3]">{emptyText}</p>
                  <Link href={href} className="mt-1.5 text-xs font-medium text-[#0090d9] hover:underline">{emptyAction}</Link>
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
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
  const [showAllAgentRuns, setShowAllAgentRuns] = useState(false);

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
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#0090d9]/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0090d9]"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="h-5 w-5 text-[#0090d9]" />
            </div>
          </div>
          <motion.p
            className="text-xs text-[#94a3b8]"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Loading dashboard...
          </motion.p>
        </div>
      </div>
    );
  }

  if (isCandidate) {
    return <CandidateDashboard />;
  }

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

  const visibleAgentRuns = showAllAgentRuns ? agentRuns : agentRuns.slice(0, 3);

  return (
    <div className="p-6">
      {/* Header with animated greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="mb-5"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#1a2b3c]">
            {user?.firstName ? `Welcome back, ${user.firstName}` : "Dashboard"}
          </h1>
          <motion.div
            animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
            className="origin-bottom-right"
          >
            <span className="text-xl">👋</span>
          </motion.div>
        </div>
        <p className="text-sm text-[#5a6b7c]">Overview of your recruitment pipeline</p>
      </motion.div>

      {/* Metric Cards with count-up animation feel */}
      <motion.div {...fadeUp(0.08)}>
        <MetricsSection>
          <MetricCard index={0} title="Candidates" value={metrics?.totalCandidates ?? "—"} subtitle="Last 30 days" icon={Users} />
          <MetricCard index={1} title="Interviews" value={metrics?.interviewsScheduled ?? "—"} subtitle="Last 30 days" icon={CalendarCheck} />
          <MetricCard index={2} title="No-Show Rate" value={metrics ? `${(metrics.noShowRate * 100).toFixed(0)}%` : "—"} subtitle={metrics?.noShowCount ? `${metrics.noShowCount} missed` : undefined} icon={AlertCircle} />
          <MetricCard index={3} title="Total Cost" value={metrics ? `$${metrics.totalCost.toFixed(2)}` : "—"} subtitle={metrics?.hiresCount ? `$${metrics.costPerHire.toFixed(0)}/hire` : undefined} icon={DollarSign} />
        </MetricsSection>
      </motion.div>

      {/* Quick Actions + Communications row */}
      <motion.div {...fadeUp(0.14)} className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Communications — compact */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f4fd]">
              <Mail className="h-3.5 w-3.5 text-[#0090d9]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Communications</h2>
              <p className="text-[11px] text-[#8a95a3]">Last 30 days activity</p>
            </div>
          </div>
          <dl className="space-y-1">
            {[
              { icon: Mail, label: "Emails sent", val: metrics?.emailsSent },
              { icon: Mail, label: "Booking conversion", val: metrics ? `${(metrics.responseRateEmail * 100).toFixed(0)}%` : null },
            ].map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors"
              >
                <dt className="flex items-center gap-2.5 text-sm text-[#5a6b7c]">
                  <row.icon className="h-4 w-4 text-[#0090d9]" />
                  {row.label}
                </dt>
                <dd className="text-sm font-semibold text-[#1a2b3c]">{row.val ?? "—"}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f4fd]">
              <Sparkles className="h-3.5 w-3.5 text-[#0090d9]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Quick Actions</h2>
              <p className="text-[11px] text-[#8a95a3]">Navigate your workspace</p>
            </div>
          </div>
          <motion.div
            className="grid grid-cols-3 gap-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {[
              { href: "/jobs", label: "Job Postings", icon: Briefcase },
              { href: "/candidates", label: "Pipeline", icon: Users },
              { href: "/interviews", label: "Interviews", icon: CalendarCheck },
              { href: "/credential-check", label: "Credentials", icon: ClipboardCheck },
              { href: "/matching", label: "AI Matching", icon: Sparkles },
              { href: "/calendar", label: "Calendar", icon: Calendar },
            ].map((action) => (
              <motion.div key={action.label} variants={staggerItem} whileHover={{ y: -2, transition: { duration: 0.15 } }}>
                <Link
                  href={action.href}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border border-[#e2e8f0] px-3 py-3 text-center transition-all duration-200 hover:border-[#0090d9]/30 hover:bg-[#f0f7ff] hover:shadow-sm"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f4fd] group-hover:bg-[#d0ebf9] transition-colors duration-200">
                    <action.icon className="h-4 w-4 text-[#0090d9]" />
                  </div>
                  <p className="text-[11px] font-medium text-[#1a2b3c]">{action.label}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* 4 collapsible cards in a 2x2 grid — compact with show/hide */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Jobs */}
        <CollapsibleCard
          title="Jobs"
          subtitle="Your posted positions"
          icon={Briefcase}
          href="/jobs"
          emptyIcon={Briefcase}
          emptyText="No jobs posted yet"
          emptyAction="Post your first job"
          count={jobs.length}
          delay={0.18}
        >
          <motion.div className="space-y-1" variants={staggerContainer} initial="hidden" animate="show">
            {jobs.slice(0, 4).map((job) => (
              <motion.div key={job.id} variants={staggerItem}>
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
          </motion.div>
        </CollapsibleCard>

        {/* Candidates */}
        <CollapsibleCard
          title="Candidates"
          subtitle="Recent applicants"
          icon={Users}
          href="/candidates"
          emptyIcon={Users}
          emptyText="No candidates yet"
          emptyAction="Add your first candidate"
          count={candidates.length}
          delay={0.2}
        >
          <motion.div className="space-y-1" variants={staggerContainer} initial="hidden" animate="show">
            {candidates.map((c) => (
              <motion.div key={c.id} variants={staggerItem}>
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
            ))}
          </motion.div>
        </CollapsibleCard>

        {/* Credential Verification */}
        <CollapsibleCard
          title="Credential Verification"
          subtitle="Recent license checks"
          icon={ShieldCheck}
          href="/credential-check"
          emptyIcon={ShieldCheck}
          emptyText="No credential checks yet"
          emptyAction="Run your first check"
          count={credentialChecks.length}
          delay={0.22}
        >
          <motion.div className="space-y-1" variants={staggerContainer} initial="hidden" animate="show">
            {credentialChecks.map((check) => {
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
              const checkStatusColors: Record<string, string> = {
                COMPLETED: "bg-[#ecfdf5] text-[#059669]",
                PENDING: "bg-[#fffbeb] text-[#b45309]",
                IN_PROGRESS: "bg-[#dbeafe] text-[#2563eb]",
                FAILED: "bg-[#fef2f2] text-[#dc2626]",
              };
              const effRec = check.recruiterDecision
                ? check.recruiterDecision === "APPROVED" ? "EMPLOYABLE" : "NOT_EMPLOYABLE"
                : check.aiRecommendation;
              return (
                <motion.div key={check.id} variants={staggerItem}>
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
                    {effRec ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${recColors[effRec] || ""}`}>
                        {recIcons[effRec]}
                        {effRec.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${checkStatusColors[check.status] || checkStatusColors.PENDING}`}>
                        {check.status.charAt(0) + check.status.slice(1).toLowerCase().replace(/_/g, " ")}
                      </span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </CollapsibleCard>

        {/* AI Job Matching */}
        <CollapsibleCard
          title="AI Job Matching"
          subtitle="Top candidate matches"
          icon={Sparkles}
          href="/matching"
          emptyIcon={Sparkles}
          emptyText="No match analyses yet"
          emptyAction="Run AI matching"
          count={topMatches.length}
          delay={0.24}
        >
          <motion.div className="space-y-1" variants={staggerContainer} initial="hidden" animate="show">
            {topMatches.map((match, i) => {
              const scoreColor = match.score >= 90
                ? "text-emerald-600 bg-emerald-50"
                : match.score >= 75
                  ? "text-blue-600 bg-blue-50"
                  : match.score >= 50
                    ? "text-amber-600 bg-amber-50"
                    : "text-red-600 bg-red-50";
              return (
                <motion.div key={`${match.candidateName}-${i}`} variants={staggerItem}>
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
          </motion.div>
        </CollapsibleCard>
      </div>

      {/* Agent Activity Log — collapsible with show more/less */}
      <motion.div {...fadeUp(0.28)} className="mt-4">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f4fd]">
                <Bot className="h-3.5 w-3.5 text-[#0090d9]" />
                {/* Animated pulse dot */}
                <motion.div
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#059669]"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1a2b3c]">Agent Activity</h2>
                <p className="text-[11px] text-[#8a95a3]">What the AI did autonomously</p>
              </div>
              {agentRuns.length > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-600">
                  {agentRuns.length}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-[#f0f4f8] px-5 pb-4 pt-2">
            {agentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="mb-2 h-7 w-7 text-[#d0dbe6]" />
                <p className="text-xs text-[#8a95a3]">No agent runs yet</p>
                <p className="mt-0.5 text-[11px] text-[#b0bec8]">The agent runs every weekday at 9 AM automatically</p>
              </div>
            ) : (
              <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
                <AnimatePresence mode="sync">
                  {visibleAgentRuns.map((run, runIdx) => {
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

                    const parsed = parseAgentReport(run.report);

                    const lineIcons: Record<string, React.ReactNode> = {
                      contact: <Mail className="h-3.5 w-3.5 text-[#0090d9]" />,
                      followup: <Clock className="h-3.5 w-3.5 text-amber-500" />,
                      reminder: <CalendarCheck className="h-3.5 w-3.5 text-violet-500" />,
                      embed: <Sparkles className="h-3.5 w-3.5 text-emerald-500" />,
                      info: <CheckCircle2 className="h-3.5 w-3.5 text-[#94a3b8]" />,
                      error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
                    };

                    return (
                      <motion.div
                        key={run.id}
                        variants={staggerItem}
                        layout
                        className={`overflow-hidden rounded-xl border ${
                          isError ? "border-red-200 bg-red-50" : "border-[#e2e8f0] bg-white"
                        }`}
                      >
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-2 ${
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
                              run.trigger === "cron" ? "bg-violet-100 text-violet-600" : "bg-[#e8f4fd] text-[#0090d9]"
                            }`}>
                              {run.trigger === "cron" ? "Scheduled" : "Manual"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[10px] text-[#8a95a3]">
                            <span>{durationSec}s</span>
                            <span>{timeAgo}</span>
                          </div>
                        </div>

                        {/* Structured report body with typing animation */}
                        <div className="px-4 py-3 space-y-1.5">
                          {parsed.lines.map((line, lineIdx) => (
                            <TypingLine
                              key={lineIdx}
                              text={line.text}
                              delay={runIdx === 0 ? 200 + lineIdx * 600 : 0}
                              icon={lineIcons[line.type] || lineIcons.info}
                            />
                          ))}

                          {/* Summary bar */}
                          {parsed.lines.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{ opacity: 1, scaleX: 1 }}
                              transition={{
                                delay: runIdx === 0 ? (200 + parsed.lines.length * 600) / 1000 : 0.3,
                                duration: 0.4,
                                ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                              }}
                              className="mt-2 flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f0f7ff] px-3 py-1.5 origin-left"
                            >
                              <CheckCircle2 className="h-3 w-3 text-[#059669]" />
                              <span className="text-[10px] font-medium text-[#334155]">
                                Completed in {durationSec}s
                              </span>
                              <span className="text-[10px] text-[#94a3b8]">
                                {parsed.lines.length} task{parsed.lines.length !== 1 ? "s" : ""} processed
                              </span>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Show more / Show less */}
                {agentRuns.length > 3 && (
                  <motion.button
                    onClick={() => setShowAllAgentRuns((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e2e8f0] py-2 text-xs font-medium text-[#5a6b7c] hover:bg-[#f8fafc] hover:text-[#0090d9] transition-colors"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <motion.div
                      animate={{ rotate: showAllAgentRuns ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </motion.div>
                    {showAllAgentRuns ? "Show less" : `Show ${agentRuns.length - 3} more`}
                  </motion.button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
