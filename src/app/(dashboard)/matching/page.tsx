"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  Mail,
  Phone,
  Briefcase,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Users,
  ChevronRight,
  Hash,
  ExternalLink,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  status: string;
  candidateCount: number;
}

interface Match {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  candidatePosition: string;
  candidateStatus: string;
  score: number;
  label: string;
  reason: string;
  computedAt: string;
}

interface MatchData {
  jobId: string;
  jobTitle: string;
  jobDepartment: string | null;
  lastComputed: string | null;
  total: number;
  matches: Match[];
}

// ── Helpers ──────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  applied: "Applied",
  contacted: "Contacted",
  scheduled: "Scheduled",
  interviewed: "Interviewed",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
  no_show: "No-show",
};

const statusColors: Record<string, string> = {
  applied: "bg-slate-100 text-slate-600",
  contacted: "bg-blue-50 text-blue-600",
  scheduled: "bg-indigo-50 text-indigo-600",
  interviewed: "bg-cyan-50 text-cyan-700",
  offered: "bg-emerald-50 text-emerald-700",
  hired: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
  no_show: "bg-amber-50 text-amber-700",
};

function scoreColor(score: number) {
  if (score >= 90) return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", border: "border-emerald-200", glow: "shadow-emerald-100" };
  if (score >= 75) return { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500", border: "border-blue-200", glow: "shadow-blue-100" };
  if (score >= 50) return { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500", border: "border-amber-200", glow: "shadow-amber-100" };
  if (score >= 25) return { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500", border: "border-orange-200", glow: "shadow-orange-100" };
  return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500", border: "border-red-200", glow: "shadow-red-100" };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Filter tabs ──────────────────────────────────────────────
type FilterTab = "all" | "strong" | "partial" | "weak";

// ── Page ─────────────────────────────────────────────────────

export default function MatchingPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch jobs on mount
  useEffect(() => {
    fetch("/api/jobs?status=open")
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => {});
  }, []);

  // Load cached matches when job selected
  const loadMatches = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matching/${jobId}`);
      if (!res.ok) throw new Error("Failed to load matches");
      const data = await res.json();
      setMatchData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      setActiveFilter("all");
      loadMatches(selectedJobId);
    }
  }, [selectedJobId, loadMatches]);

  // Trigger re-computation
  const runAnalysis = async () => {
    if (!selectedJobId) return;
    setComputing(true);
    setError(null);
    try {
      const res = await fetch(`/api/matching/${selectedJobId}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to analyze");
      }
      await loadMatches(selectedJobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setComputing(false);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const strong = matchData?.matches.filter((m) => m.score >= 75).length ?? 0;
  const partial = matchData?.matches.filter((m) => m.score >= 50 && m.score < 75).length ?? 0;
  const weak = matchData?.matches.filter((m) => m.score < 50).length ?? 0;

  // Filter matches
  const filteredMatches = matchData?.matches.filter((m) => {
    if (activeFilter === "strong") return m.score >= 75;
    if (activeFilter === "partial") return m.score >= 50 && m.score < 75;
    if (activeFilter === "weak") return m.score < 50;
    return true;
  }) ?? [];

  return (
    <div className="space-y-5">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/candidates"
          className="flex items-center gap-1.5 text-[#64748b] hover:text-[#0090d9] transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          Candidates
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-[#cbd5e1]" />
        <span className="font-medium text-[#1a2b3c] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#0090d9]" />
          AI Job Matching
        </span>
      </div>

      {/* Header row */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a2b3c]">AI Job Matching</h1>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Pre-computed scores — results load instantly from cache
          </p>
        </div>
        <Link
          href="/candidates"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs font-medium text-[#475569] transition-all hover:bg-[#f8fafc] hover:border-[#0090d9]/30 hover:text-[#0090d9]"
        >
          <Users className="h-3.5 w-3.5" />
          All Candidates
        </Link>
      </div>

      {/* Job selector + action bar */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Job dropdown */}
          <div ref={dropdownRef} className="relative flex-1 max-w-lg">
            <button
              onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm transition-all hover:border-[#0090d9]/40 focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20"
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-[#0090d9]" />
                <span className={selectedJob ? "text-[#1a2b3c] font-medium" : "text-[#94a3b8]"}>
                  {selectedJob
                    ? `${selectedJob.title}${selectedJob.department ? ` — ${selectedJob.department}` : ""}`
                    : "Select a job posting..."}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#94a3b8] transition-transform ${jobDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {jobDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-20 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg"
                >
                  {jobs.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#94a3b8]">No open jobs</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setJobDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#f8fafc] ${
                            job.id === selectedJobId ? "bg-[#f0f7ff] text-[#0090d9]" : "text-[#334155]"
                          }`}
                        >
                          <div>
                            <div className="font-medium">{job.title}</div>
                            {job.department && (
                              <div className="text-xs text-[#94a3b8]">{job.department}</div>
                            )}
                          </div>
                          <span className="text-xs text-[#94a3b8]">
                            {job.candidateCount} candidate{job.candidateCount !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {matchData?.lastComputed && (
              <span className="text-xs text-[#94a3b8] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Analyzed {timeAgo(matchData.lastComputed)}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={!selectedJobId || computing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#007bbd] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} />
              {computing
                ? "Analyzing..."
                : matchData?.matches.length
                ? "Re-analyze"
                : "Run Analysis"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0090d9] border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!selectedJobId && !loading && (
        <div className="card p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0090d9]/10 to-[#6366f1]/10">
            <Sparkles className="h-8 w-8 text-[#0090d9]" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#334155]">Select a job to view matches</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Choose a job posting above to see pre-computed candidate rankings
          </p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {selectedJobId && !loading && matchData && (
        <>
          {/* Stats + filter tabs */}
          {matchData.matches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: "all" as FilterTab, label: "All", count: matchData.total, color: "text-[#1a2b3c]", activeBg: "bg-[#1a2b3c] text-white" },
                { key: "strong" as FilterTab, label: "Strong", count: strong, color: "text-emerald-700", activeBg: "bg-emerald-600 text-white", icon: <TrendingUp className="h-3.5 w-3.5" /> },
                { key: "partial" as FilterTab, label: "Partial", count: partial, color: "text-amber-700", activeBg: "bg-amber-500 text-white", icon: <Minus className="h-3.5 w-3.5" /> },
                { key: "weak" as FilterTab, label: "Weak", count: weak, color: "text-orange-700", activeBg: "bg-orange-500 text-white", icon: <TrendingDown className="h-3.5 w-3.5" /> },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeFilter === tab.key
                      ? tab.activeBg + " shadow-sm"
                      : `bg-white border border-[#e2e8f0] ${tab.color} hover:bg-[#f8fafc]`
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className={`ml-0.5 ${activeFilter === tab.key ? "opacity-80" : "opacity-60"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No matches yet */}
          {matchData.matches.length === 0 && (
            <div className="card p-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0090d9]/10 to-[#6366f1]/10">
                <Sparkles className="h-8 w-8 text-[#0090d9]" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#334155]">No matches computed yet</p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Click &ldquo;Run Analysis&rdquo; to compute AI match scores for all candidates
              </p>
            </div>
          )}

          {/* Match cards */}
          {filteredMatches.length > 0 && (
            <div className="space-y-2.5">
              {filteredMatches.map((match, index) => {
                const colors = scoreColor(match.score);
                const rank = (matchData?.matches.findIndex((m) => m.id === match.id) ?? 0) + 1;

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.025, duration: 0.25 }}
                    className={`card overflow-hidden border ${colors.border} transition-all hover:shadow-md ${colors.glow}`}
                  >
                    <div className="flex items-stretch">
                      {/* Score column */}
                      <div className={`flex w-[88px] flex-shrink-0 flex-col items-center justify-center ${colors.bg} py-4 relative`}>
                        {/* Rank badge */}
                        <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[9px] font-bold text-[#64748b]">
                          <Hash className="h-2.5 w-2.5 mr-[-1px]" />{rank}
                        </div>
                        <div className={`text-2xl font-bold ${colors.text}`}>
                          {match.score}
                        </div>
                        <div className="mt-1 w-14 rounded-full bg-black/10 h-1.5">
                          <div
                            className={`h-full rounded-full ${colors.bar} transition-all`}
                            style={{ width: `${match.score}%` }}
                          />
                        </div>
                        <div className={`mt-1.5 text-[10px] font-semibold ${colors.text}`}>
                          {match.label}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 px-5 py-4 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            {/* Candidate name — clickable, bold, highlighted */}
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0090d9] text-sm font-semibold text-white">
                                {match.candidateName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => router.push(`/candidates?highlight=${match.candidateId}`)}
                                  className="group flex items-center gap-1.5 text-left"
                                >
                                  <h3 className="text-[15px] font-bold text-[#1a2b3c] group-hover:text-[#0090d9] transition-colors truncate">
                                    {match.candidateName}
                                  </h3>
                                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[#cbd5e1] group-hover:text-[#0090d9] transition-colors" />
                                </button>
                                <div className="flex items-center gap-3 text-xs text-[#64748b] mt-0.5">
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{match.candidateEmail}</span>
                                  </span>
                                  {match.candidatePhone && (
                                    <span className="inline-flex items-center gap-1 flex-shrink-0">
                                      <Phone className="h-3 w-3" />
                                      {match.candidatePhone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Reason */}
                            <p className="mt-2.5 text-[13px] text-[#475569] leading-relaxed">
                              {match.reason}
                            </p>

                            {/* Tags */}
                            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
                                <Briefcase className="h-3 w-3" />
                                {match.candidatePosition}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusColors[match.candidateStatus] || "bg-slate-100 text-slate-600"}`}>
                                {statusLabels[match.candidateStatus] || match.candidateStatus}
                              </span>
                            </div>
                          </div>

                          {/* View Profile CTA */}
                          <button
                            onClick={() => router.push(`/candidates?highlight=${match.candidateId}`)}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#007bbd] hover:shadow-md active:scale-[0.97]"
                          >
                            View Profile
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Empty filter state */}
          {matchData.matches.length > 0 && filteredMatches.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-sm text-[#64748b]">No candidates match this filter</p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-2 text-xs font-medium text-[#0090d9] hover:underline"
              >
                Show all candidates
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
