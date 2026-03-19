"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MetricCard, MetricsSection } from "@/components/metrics-cards";
import { motion } from "framer-motion";
import {
  Calendar,
  Video,
  CheckCircle2,
  Loader2,
  XCircle,
  Briefcase,
  UserCircle,
  SlidersHorizontal,
  Clock,
  ArrowRight,
  LayoutList,
  MapPin,
  Building2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  meetLink?: string;
  confirmed: boolean;
  completed: boolean;
  cancelled: boolean;
  candidate?: { email?: string };
}

interface BoardJob {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  applied: boolean;
  createdAt: string;
}

interface Profile {
  user: { name: string | null; email: string };
  profile: {
    headline: string | null;
    summary: string | null;
    phone: string | null;
    city: string | null;
    experiences: unknown[];
    skills: unknown[];
    certifications: unknown[];
    educations: unknown[];
  } | null;
}

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay,
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  };
}

function computeProfileCompletion(data: Profile | null): number {
  if (!data?.profile) return 0;
  const p = data.profile;
  let score = 0;
  if (p.headline) score += 15;
  if (p.summary) score += 15;
  if ((p.experiences?.length ?? 0) >= 1) score += 20;
  if ((p.skills?.length ?? 0) >= 3) score += 20;
  if ((p.certifications?.length ?? 0) >= 1) score += 15;
  if (p.phone && p.city) score += 15;
  return score;
}

export function CandidateDashboard() {
  const { user } = useUser();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<BoardJob[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!email) return;
    Promise.all([
      fetch("/api/interviews").then((r) => r.json()).catch(() => []),
      fetch("/api/jobs/board").then((r) => r.json()).catch(() => []),
      fetch("/api/profile").then((r) => r.json()).catch(() => null),
    ]).then(([interviewsData, jobsData, profileData]) => {
      const mine = (Array.isArray(interviewsData) ? interviewsData : []).filter(
        (i: Interview) => i.candidate?.email === email
      );
      setInterviews(mine);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setProfile(profileData);
    }).finally(() => setLoading(false));
  }, [email]);

  const refetchInterviews = () => {
    if (!email) return;
    fetch("/api/interviews")
      .then((r) => r.json())
      .then((data) => {
        const mine = (Array.isArray(data) ? data : []).filter(
          (i: Interview) => i.candidate?.email === email
        );
        setInterviews(mine);
      })
      .catch(console.error);
  };

  const upcoming = interviews.filter(
    (i) => !i.cancelled && !i.completed && new Date(i.scheduledAt) > new Date()
  );
  const appliedJobs = jobs.filter((j) => j.applied);
  const openJobs = jobs.filter((j) => !j.applied);
  const profileCompletion = computeProfileCompletion(profile);

  const handleConfirm = async (id: string) => {
    if (!email) return;
    setConfirmLoading(id);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id, email }),
      });
      const data = await res.json();
      if (data.success) refetchInterviews();
      else alert(data.error || "Failed to confirm");
    } catch {
      alert("Failed to confirm interview");
    } finally {
      setConfirmLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!email) return;
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    setCancelLoading(id);
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id, email }),
      });
      const data = await res.json();
      if (data.success) refetchInterviews();
      else alert(data.error || "Failed to cancel");
    } catch {
      alert("Failed to cancel interview");
    } finally {
      setCancelLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-[#0090d9]"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">
          {user?.firstName ? `Welcome back, ${user.firstName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#5a6b7c]">Your job search at a glance</p>
      </motion.div>

      {/* Metric Cards */}
      <motion.div {...fadeUp(0.06)}>
        <MetricsSection>
          <MetricCard
            index={0}
            title="Upcoming Interviews"
            value={upcoming.length}
            subtitle={upcoming.length === 1 ? "scheduled" : "scheduled"}
            icon={Calendar}
          />
          <MetricCard
            index={1}
            title="Applications"
            value={appliedJobs.length}
            subtitle="submitted"
            icon={Briefcase}
          />
          <MetricCard
            index={2}
            title="Profile Completion"
            value={`${profileCompletion}%`}
            subtitle={profileCompletion < 100 ? "in progress" : "complete"}
            icon={UserCircle}
          />
          <MetricCard
            index={3}
            title="Open Positions"
            value={openJobs.length}
            subtitle="available now"
            icon={LayoutList}
          />
        </MetricsSection>
      </motion.div>

      {/* Main grid */}
      <motion.div {...fadeUp(0.15)} className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Upcoming Interviews */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Upcoming Interviews</h2>
              <p className="text-xs text-[#8a95a3]">Your next scheduled sessions</p>
            </div>
            <Link
              href="/interviews"
              className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="mb-2 h-8 w-8 text-[#d0dbe6]" />
              <p className="text-sm text-[#5a6b7c]">No upcoming interviews</p>
              <p className="mt-0.5 text-xs text-[#8a95a3]">Browse the job board to apply</p>
              <Link
                href="/job-board"
                className="mt-3 text-xs font-medium text-[#0090d9] hover:underline"
              >
                Browse open positions
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.slice(0, 3).map((interview, i) => {
                const date = new Date(interview.scheduledAt);
                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] p-3"
                  >
                    {/* Date badge */}
                    <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-[#e8f4fd]">
                      <span className="text-[9px] font-semibold uppercase text-[#0090d9]">
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-base font-bold leading-none text-[#0090d9]">
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1a2b3c] truncate">
                        {interview.position}
                      </p>
                      <p className="text-xs text-[#5a6b7c]">
                        {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {" · "}{interview.duration} min
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {interview.confirmed ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#059669]">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirm(interview.id)}
                          disabled={confirmLoading === interview.id}
                          className="flex items-center gap-1 rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-[11px] font-medium text-[#059669] hover:bg-[#d1fae5] transition-colors disabled:opacity-40"
                        >
                          {confirmLoading === interview.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Confirm
                        </button>
                      )}
                      {interview.meetLink && (
                        <a
                          href={interview.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-[#0090d9] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#0077b6] transition-colors"
                        >
                          <Video className="h-3 w-3" /> Join
                        </a>
                      )}
                      <button
                        onClick={() => handleCancel(interview.id)}
                        disabled={cancelLoading === interview.id}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors disabled:opacity-40"
                      >
                        {cancelLoading === interview.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Quick Actions</h2>
          <p className="mb-3 text-xs text-[#8a95a3]">Navigate your workspace</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/job-board", label: "Job Board", desc: "Browse and apply to open roles", icon: LayoutList },
              { href: "/profile", label: "My Profile", desc: "Update resume and experience", icon: UserCircle },
              { href: "/preferences", label: "Preferences", desc: "Set your ideal job criteria", icon: SlidersHorizontal },
              { href: "/availability", label: "Availability", desc: "Manage your schedule", icon: Clock },
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
                    <action.icon className="text-[#0090d9]" style={{ width: 18, height: 18 }} />
                  </div>
                  <p className="text-xs font-medium text-[#1a2b3c]">{action.label}</p>
                  <p className="text-[10px] text-[#8a95a3] leading-tight">{action.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Applications + Profile Completion */}
      <motion.div {...fadeUp(0.22)} className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Applications */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">My Applications</h2>
              <p className="text-xs text-[#8a95a3]">Jobs you have applied to</p>
            </div>
            <Link
              href="/job-board"
              className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline"
            >
              Browse more <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {appliedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Briefcase className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-xs text-[#8a95a3]">No applications yet</p>
              <Link
                href="/job-board"
                className="mt-2 text-xs font-medium text-[#0090d9] hover:underline"
              >
                View open positions
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {appliedJobs.slice(0, 5).map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ecfdf5]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1a2b3c] truncate">{job.title}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-[#8a95a3]">
                      {job.department && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-2.5 w-2.5" />{job.department}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />{job.location}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-medium text-[#059669]">
                    Applied
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Profile Completion */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Profile Completion</h2>
              <p className="text-xs text-[#8a95a3]">A complete profile gets more matches</p>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-1 text-xs font-medium text-[#0090d9] hover:underline"
            >
              Edit <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-[#5a6b7c]">Overall completion</span>
              <span className="font-semibold text-[#1a2b3c]">{profileCompletion}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${profileCompletion}%` }}
                transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-[#0090d9] to-[#0077b6]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {[
              { label: "Professional headline", done: !!profile?.profile?.headline },
              { label: "About / summary", done: !!profile?.profile?.summary },
              { label: "Work experience", done: (profile?.profile?.experiences?.length ?? 0) >= 1 },
              { label: "Skills (3+)", done: (profile?.profile?.skills?.length ?? 0) >= 3 },
              { label: "Certifications", done: (profile?.profile?.certifications?.length ?? 0) >= 1 },
              { label: "Phone & city", done: !!(profile?.profile?.phone && profile?.profile?.city) },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04, duration: 0.22 }}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              >
                <div className={`flex h-4.5 w-4.5 items-center justify-center rounded-full ${item.done ? "bg-[#ecfdf5]" : "bg-[#f1f5f9]"}`}
                  style={{ width: 18, height: 18 }}>
                  {item.done ? (
                    <CheckCircle2 className="h-3 w-3 text-[#059669]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[#cbd5e1]" />
                  )}
                </div>
                <span className={`text-xs ${item.done ? "text-[#1a2b3c]" : "text-[#8a95a3]"}`}>
                  {item.label}
                </span>
                {!item.done && (
                  <Link
                    href="/profile"
                    className="ml-auto text-[10px] font-medium text-[#0090d9] hover:underline"
                  >
                    Add
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
