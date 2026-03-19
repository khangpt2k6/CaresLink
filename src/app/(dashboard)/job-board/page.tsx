"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, MapPin, Clock, Search, Filter,
  CheckCircle2, Loader2, X, ChevronDown, Building2,
  Users, Sparkles, Calendar,
} from "lucide-react";

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  description: string | null;
  createdAt: string;
  applied: boolean;
  applicantCount: number;
}

const TYPE_COLORS: Record<string, string> = {
  "Full-time":  "bg-[#e0f2fe] text-[#0369a1]",
  "Part-time":  "bg-[#fef9c3] text-[#854d0e]",
  "Contract":   "bg-[#f3e8ff] text-[#7c3aed]",
  "Temporary":  "bg-[#fce7f3] text-[#be185d]",
  "PRN":        "bg-[#dcfce7] text-[#15803d]",
  "Travel":     "bg-[#ffedd5] text-[#c2410c]",
};

function typeBadge(type: string) {
  return TYPE_COLORS[type] ?? "bg-[#f1f5f9] text-[#475569]";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 24) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

function applicantLabel(count: number) {
  if (count === 0) return "Be the first to apply";
  if (count === 1) return "1 applicant";
  if (count < 10) return `${count} applicants`;
  if (count < 25) return "10+ applicants";
  if (count < 50) return "25+ applicants";
  if (count < 100) return "50+ applicants";
  return "100+ applicants";
}

export default function JobBoardPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Role guard
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.role !== "CANDIDATE") router.replace("/");
        else setRole(d.role);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!role) return;
    fetch("/api/jobs/board")
      .then(r => r.json())
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  const jobTypes = useMemo(() => {
    const types = Array.from(new Set(jobs.map(j => j.type)));
    return ["All", ...types];
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const matchSearch = !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        (j.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
        j.location.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "All" || j.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [jobs, search, typeFilter]);

  const openCount = jobs.filter(j => !j.applied).length;
  const appliedCount = jobs.filter(j => j.applied).length;

  async function handleApply(job: Job) {
    setApplying(job.id);
    try {
      const res = await fetch("/api/jobs/board/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (res.ok) {
        setJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, applied: true, applicantCount: j.applicantCount + 1 } : j
        ));
      } else {
        const d = await res.json();
        alert(d.error ?? "Failed to apply");
      }
    } finally {
      setApplying(null);
    }
  }

  if (!role) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0090d9]" />
            <h1 className="text-xl font-bold text-[#1a2b3c]">Job Board</h1>
          </div>
          <p className="mt-0.5 text-sm text-[#64748b]">Browse open positions and apply instantly.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748b]">
          <span className="flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-3 py-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {openCount} open
          </span>
          {appliedCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-[#15803d]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {appliedCount} applied
            </span>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, department, or location…"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2.5 pl-9 pr-4 text-sm text-[#1a2b3c] placeholder:text-[#94a3b8] focus:border-[#0090d9] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors
              ${typeFilter !== "All" ? "border-[#0090d9] bg-[#e8f4fd] text-[#0090d9]" : "border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"}`}
          >
            <Filter className="h-4 w-4" />
            {typeFilter === "All" ? "Job type" : typeFilter}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-[#e2e8f0] bg-white py-1 shadow-lg"
              >
                {jobTypes.map(t => (
                  <button key={t} onClick={() => { setTypeFilter(t); setShowFilters(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors
                      ${typeFilter === t ? "bg-[#e8f4fd] text-[#0090d9] font-medium" : "text-[#475569] hover:bg-[#f8fafc]"}`}
                  >
                    {typeFilter === t && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className={typeFilter === t ? "" : "pl-5"}>{t}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Briefcase className="h-8 w-8 text-[#cbd5e1]" />
          <p className="text-sm font-medium text-[#334155]">
            {jobs.length === 0 ? "No open positions right now" : "No jobs match your search"}
          </p>
          <p className="text-xs text-[#94a3b8]">Check back soon for new opportunities.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className={`card overflow-hidden transition-all duration-200 ${
                  expanded === job.id ? "shadow-md" : "hover:shadow-sm"
                } ${job.applied ? "opacity-80" : ""}`}
              >
                <div className="p-5">
                  {/* Top row: icon + title/meta + actions */}
                  <div className="flex items-start gap-4">
                    {/* Company/job icon */}
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${
                      job.applied
                        ? "border-[#bbf7d0] bg-[#f0fdf4]"
                        : "border-[#dbeafe] bg-[#eff6ff]"
                    }`}>
                      {job.applied
                        ? <CheckCircle2 className="h-6 w-6 text-[#16a34a]" />
                        : <Briefcase className="h-6 w-6 text-[#3b82f6]" />}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[15px] font-semibold text-[#0f172a] leading-snug">
                            {job.title}
                          </h3>
                          {job.department && (
                            <p className="mt-0.5 flex items-center gap-1 text-sm text-[#475569]">
                              <Building2 className="h-3.5 w-3.5 text-[#94a3b8]" />
                              {job.department}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-2">
                          {job.description && (
                            <button
                              onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                              className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                            >
                              {expanded === job.id ? "Less" : "Details"}
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded === job.id ? "rotate-180" : ""}`} />
                            </button>
                          )}
                          {job.applied ? (
                            <span className="flex items-center gap-1.5 rounded-lg bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#16a34a]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApply(job)}
                              disabled={applying === job.id}
                              className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0077b6] disabled:opacity-60 transition-colors"
                            >
                              {applying === job.id
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…</>
                                : "Easy Apply"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeBadge(job.type)}`}>
                          <Clock className="mr-1 h-3 w-3" />{job.type}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#64748b]">
                          <MapPin className="h-3.5 w-3.5 text-[#94a3b8]" />{job.location}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#64748b]">
                          <Calendar className="h-3.5 w-3.5 text-[#94a3b8]" />{timeAgo(job.createdAt)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#64748b]">
                          <Users className="h-3.5 w-3.5 text-[#94a3b8]" />{applicantLabel(job.applicantCount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable description */}
                  <AnimatePresence>
                    {expanded === job.id && job.description && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 border-t border-[#f1f5f9] pt-4">
                          <p className="text-sm font-medium text-[#1e293b] mb-1.5">About this role</p>
                          <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">
                            {job.description}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
