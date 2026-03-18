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
  applied: "bg-[#f1f5f9] text-[#475569]",
  contacted: "bg-[#e8f4fd] text-[#0077b6]",
  scheduled: "bg-[#f0f0ff] text-[#5b5fc7]",
  interviewed: "bg-[#e8f6f8] text-[#1a7f8f]",
  offered: "bg-[#e8f5ee] text-[#2d7a4f]",
  hired: "bg-[#e8f5ee] text-[#2d7a4f]",
  rejected: "bg-[#fef2f2] text-[#a04040]",
  no_show: "bg-[#fef8ee] text-[#946b1a]",
};

function scoreColor(score: number) {
  if (score >= 90) return { bg: "bg-[#f6fbf8]", text: "text-[#2d7a4f]", stroke: "#3d9960", track: "#e6f2ea", border: "border-[#dceee2]" };
  if (score >= 75) return { bg: "bg-[#f5faff]", text: "text-[#1a6fb5]", stroke: "#0090d9", track: "#e0eef9", border: "border-[#d6e8f5]" };
  if (score >= 50) return { bg: "bg-[#fdfbf5]", text: "text-[#8a6318]", stroke: "#b8892a", track: "#f0e8d4", border: "border-[#ebe0c8]" };
  if (score >= 25) return { bg: "bg-[#fdf8f4]", text: "text-[#905020]", stroke: "#c06828", track: "#f0ddd0", border: "border-[#e8d4c4]" };
  return { bg: "bg-[#fdf5f5]", text: "text-[#904040]", stroke: "#b85050", track: "#f0dada", border: "border-[#e8d0d0]" };
}

// ── Animated circular score ring ─────────────────────────────

function ScoreRing({
  score,
  colors,
  size = 68,
  delay = 0,
}: {
  score: number;
  colors: ReturnType<typeof scoreColor>;
  size?: number;
  delay?: number;
}) {
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const offset = mounted
    ? circumference - (score / 100) * circumference
    : circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </svg>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: delay / 1000 + 0.3, duration: 0.4, type: "spring", stiffness: 200 }}
      >
        <span className={`text-[17px] font-bold ${colors.text}`}>{score}</span>
      </motion.div>
    </div>
  );
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

type FilterTab = "all" | "strong" | "partial" | "weak";

// ── Card spring animation ────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setJobDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    fetch("/api/jobs?status=open")
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => {});
  }, []);

  const loadMatches = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matching/${jobId}`);
      if (!res.ok) throw new Error("Failed to load matches");
      setMatchData(await res.json());
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

  const filteredMatches =
    matchData?.matches.filter((m) => {
      if (activeFilter === "strong") return m.score >= 75;
      if (activeFilter === "partial") return m.score >= 50 && m.score < 75;
      if (activeFilter === "weak") return m.score < 50;
      return true;
    }) ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 text-sm"
      >
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
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="flex items-end justify-between"
      >
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
      </motion.div>

      {/* Job selector */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="card p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              <ChevronDown
                className={`h-4 w-4 text-[#94a3b8] transition-transform duration-200 ${jobDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {jobDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute z-20 mt-1.5 w-full rounded-xl border border-[#e2e8f0] bg-white shadow-xl shadow-black/8"
                >
                  {jobs.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#94a3b8]">No open jobs</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto py-1.5">
                      {jobs.map((job, i) => (
                        <motion.button
                          key={job.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.2 }}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setJobDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#f8fafc] ${
                            job.id === selectedJobId ? "bg-[#f0f7ff]" : ""
                          }`}
                        >
                          <div>
                            <div className={`font-medium ${job.id === selectedJobId ? "text-[#0090d9]" : "text-[#334155]"}`}>
                              {job.title}
                            </div>
                            {job.department && <div className="text-[11px] text-[#94a3b8]">{job.department}</div>}
                          </div>
                          <span className="text-[11px] text-[#94a3b8]">
                            {job.candidateCount} candidate{job.candidateCount !== 1 ? "s" : ""}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            {matchData?.lastComputed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[#94a3b8] flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                Analyzed {timeAgo(matchData.lastComputed)}
              </motion.span>
            )}
            <button
              onClick={runAnalysis}
              disabled={!selectedJobId || computing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#007bbd] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.97]"
            >
              <RefreshCw className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} />
              {computing ? "Analyzing..." : matchData?.matches.length ? "Re-analyze" : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* Computing overlay */}
        <AnimatePresence>
          {computing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#f0f7ff] to-[#faf5ff] px-4 py-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0090d9] border-t-transparent" />
                <span className="text-sm text-[#475569]">
                  AI is analyzing candidates against <strong>{selectedJob?.title}</strong>
                </span>
                <span className="flex gap-0.5 ml-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1 w-1 animate-bounce rounded-full bg-[#0090d9]"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-40 items-center justify-center"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0090d9] border-t-transparent" />
        </motion.div>
      )}

      {/* Empty state */}
      {!selectedJobId && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="card p-16 text-center"
        >
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0090d9]/10 to-[#6366f1]/10"
          >
            <Sparkles className="h-8 w-8 text-[#0090d9]" />
          </motion.div>
          <p className="mt-4 text-sm font-semibold text-[#334155]">
            Select a job to view matches
          </p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Choose a job posting above to see pre-computed candidate rankings
          </p>
        </motion.div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {selectedJobId && !loading && matchData && (
        <>
          {/* Filter tabs */}
          {matchData.matches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap items-center gap-2"
            >
              {([
                { key: "all" as FilterTab, label: "All", count: matchData.total, color: "text-[#475569]", activeBg: "bg-[#334155] text-white" },
                { key: "strong" as FilterTab, label: "Strong", count: strong, color: "text-[#2d7a4f]", activeBg: "bg-[#2d7a4f] text-white", icon: <TrendingUp className="h-3.5 w-3.5" /> },
                { key: "partial" as FilterTab, label: "Partial", count: partial, color: "text-[#8a6318]", activeBg: "bg-[#8a6318] text-white", icon: <Minus className="h-3.5 w-3.5" /> },
                { key: "weak" as FilterTab, label: "Weak", count: weak, color: "text-[#905020]", activeBg: "bg-[#905020] text-white", icon: <TrendingDown className="h-3.5 w-3.5" /> },
              ]).map((tab) => (
                <motion.button
                  key={tab.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
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
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* No matches yet */}
          {matchData.matches.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-16 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0090d9]/10 to-[#6366f1]/10">
                <Sparkles className="h-8 w-8 text-[#0090d9]" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#334155]">No matches computed yet</p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Click &ldquo;Run Analysis&rdquo; to compute AI match scores for all candidates
              </p>
            </motion.div>
          )}

          {/* Match cards */}
          <AnimatePresence mode="wait">
            {filteredMatches.length > 0 && (
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {filteredMatches.map((match, index) => {
                  const colors = scoreColor(match.score);
                  const rank = (matchData?.matches.findIndex((m) => m.id === match.id) ?? 0) + 1;

                  return (
                    <motion.div
                      key={match.id}
                      custom={index}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover={{ y: -2, transition: { duration: 0.2 } }}
                      className={`group/card card overflow-hidden border ${colors.border} transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5 cursor-default`}
                    >
                      <div className="flex items-stretch">
                        {/* Score column */}
                        <div className={`flex w-[108px] flex-shrink-0 flex-col items-center justify-center ${colors.bg} py-5 relative`}>
                          {/* Rank */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.06 + 0.2, type: "spring", stiffness: 300 }}
                            className="absolute top-2.5 left-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-[9px] font-bold text-[#8a95a3] shadow-sm"
                          >
                            #{rank}
                          </motion.div>
                          <ScoreRing score={match.score} colors={colors} delay={index * 60 + 200} />
                          <div className={`mt-2 text-[10px] font-semibold tracking-wide uppercase ${colors.text}`}>
                            {match.label}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 px-5 py-4 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              {/* Name row */}
                              <div className="flex items-center gap-3">
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: index * 0.06 + 0.15, type: "spring", stiffness: 300 }}
                                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#0090d9] text-sm font-semibold text-white shadow-sm"
                                >
                                  {match.candidateName.charAt(0).toUpperCase()}
                                </motion.div>
                                <div className="min-w-0">
                                  <button
                                    onClick={() => router.push(`/candidates?highlight=${match.candidateId}`)}
                                    className="group/name flex items-center gap-1.5 text-left"
                                  >
                                    <h3 className="text-[15px] font-bold text-[#1a2b3c] group-hover/name:text-[#0090d9] transition-colors truncate">
                                      {match.candidateName}
                                    </h3>
                                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[#d0d8e0] group-hover/name:text-[#0090d9] transition-colors" />
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
                              <p className="mt-3 text-[13px] text-[#475569] leading-relaxed">
                                {match.reason}
                              </p>

                              {/* Tags */}
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
                                  <Briefcase className="h-3 w-3" />
                                  {match.candidatePosition}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                    statusColors[match.candidateStatus] || "bg-[#f1f5f9] text-[#475569]"
                                  }`}
                                >
                                  {statusLabels[match.candidateStatus] || match.candidateStatus}
                                </span>
                              </div>
                            </div>

                            {/* CTA */}
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => router.push(`/candidates?highlight=${match.candidateId}`)}
                              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#007bbd] hover:shadow-md"
                            >
                              View Profile
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty filter */}
          {matchData.matches.length > 0 && filteredMatches.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card p-12 text-center"
            >
              <p className="text-sm text-[#64748b]">No candidates match this filter</p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-2 text-xs font-medium text-[#0090d9] hover:underline"
              >
                Show all candidates
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
