"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  User,
  Mail,
  Phone,
  Briefcase,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
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

function scoreColor(score: number) {
  if (score >= 90) return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", ring: "ring-emerald-200" };
  if (score >= 75) return { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500", ring: "ring-blue-200" };
  if (score >= 50) return { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500", ring: "ring-amber-200" };
  if (score >= 25) return { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500", ring: "ring-orange-200" };
  return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500", ring: "ring-red-200" };
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
    if (selectedJobId) loadMatches(selectedJobId);
  }, [selectedJobId, loadMatches]);

  // Trigger re-computation
  const runAnalysis = async () => {
    if (!selectedJobId) return;
    setComputing(true);
    setError(null);
    try {
      const res = await fetch(`/api/matching/${selectedJobId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to analyze");
      }
      // Reload cached data
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1a2b3c] flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0090d9]" />
            AI Job Matching
          </h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Pre-computed candidate scores — results load instantly
          </p>
        </div>
      </div>

      {/* Job selector + action bar */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Job dropdown */}
          <div className="relative flex-1 max-w-md">
            <button
              onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm transition-colors hover:border-[#0090d9]/40 focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20"
            >
              <span className={selectedJob ? "text-[#1a2b3c] font-medium" : "text-[#94a3b8]"}>
                {selectedJob
                  ? `${selectedJob.title}${selectedJob.department ? ` — ${selectedJob.department}` : ""}`
                  : "Select a job posting..."}
              </span>
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#007bbd] disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Loading state */}
      {loading && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0090d9] border-t-transparent" />
        </div>
      )}

      {/* No job selected */}
      {!selectedJobId && !loading && (
        <div className="card p-16 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-[#cbd5e1]" />
          <p className="mt-3 text-sm font-medium text-[#334155]">Select a job to view matches</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Choose a job posting above to see pre-computed candidate match scores
          </p>
        </div>
      )}

      {/* Results */}
      {selectedJobId && !loading && matchData && (
        <>
          {/* Stats bar */}
          {matchData.matches.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-[#1a2b3c]">{matchData.total}</div>
                <div className="text-xs text-[#64748b] mt-1">Total Ranked</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
                  <TrendingUp className="h-5 w-5" />
                  {strong}
                </div>
                <div className="text-xs text-[#64748b] mt-1">Strong (75+)</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
                  <Minus className="h-5 w-5" />
                  {partial}
                </div>
                <div className="text-xs text-[#64748b] mt-1">Partial (50-74)</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 flex items-center justify-center gap-1">
                  <TrendingDown className="h-5 w-5" />
                  {weak}
                </div>
                <div className="text-xs text-[#64748b] mt-1">Weak (&lt;50)</div>
              </div>
            </div>
          )}

          {/* No matches yet */}
          {matchData.matches.length === 0 && (
            <div className="card p-16 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-[#cbd5e1]" />
              <p className="mt-3 text-sm font-medium text-[#334155]">No matches computed yet</p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Click &ldquo;Run Analysis&rdquo; to compute AI match scores for all candidates
              </p>
            </div>
          )}

          {/* Match cards */}
          {matchData.matches.length > 0 && (
            <div className="space-y-3">
              {matchData.matches.map((match, index) => {
                const colors = scoreColor(match.score);
                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.25 }}
                    className="card p-0 overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      {/* Score column */}
                      <div className={`flex w-24 flex-shrink-0 flex-col items-center justify-center ${colors.bg} px-3 py-4`}>
                        <div className={`text-2xl font-bold ${colors.text}`}>
                          {match.score}
                        </div>
                        <div className="mt-1 w-full rounded-full bg-black/10 h-1.5">
                          <div
                            className={`h-full rounded-full ${colors.bar} transition-all`}
                            style={{ width: `${match.score}%` }}
                          />
                        </div>
                        <div className={`mt-1.5 text-[10px] font-medium ${colors.text}`}>
                          {match.label}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 px-5 py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0090d9] text-xs font-semibold text-white">
                                {match.candidateName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-[#1a2b3c]">
                                  {match.candidateName}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-[#64748b]">
                                  <span className="inline-flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {match.candidateEmail}
                                  </span>
                                  {match.candidatePhone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {match.candidatePhone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                              {match.reason}
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] text-[#475569]">
                                <Briefcase className="h-3 w-3" />
                                {match.candidatePosition}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] text-[#475569]">
                                {statusLabels[match.candidateStatus] || match.candidateStatus}
                              </span>
                            </div>
                          </div>

                          {/* View profile button */}
                          <button
                            onClick={() => router.push(`/candidates/${match.candidateId}`)}
                            className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-[#f8fafc] hover:border-[#0090d9]/30 hover:text-[#0090d9]"
                          >
                            <User className="h-3 w-3" />
                            Profile
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
