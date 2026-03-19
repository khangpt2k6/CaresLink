"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Calendar, Video, CheckCircle, Loader2, XCircle, CheckCircle2, RefreshCw } from "lucide-react";
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
}

export function CandidateDashboard() {
  const { user } = useUser();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/interviews")
      .then((r) => r.json())
      .then((data) => {
        // Filter to only show interviews for this candidate's email
        const mine = (data || []).filter(
          (i: Interview & { candidate?: { email?: string } }) =>
            i.candidate?.email === user?.primaryEmailAddress?.emailAddress
        );
        setInterviews(mine);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.primaryEmailAddress?.emailAddress]);

  const upcoming = interviews.filter(
    (i) => !i.cancelled && !i.completed && new Date(i.scheduledAt) > new Date()
  );
  const past = interviews.filter(
    (i) => i.completed || new Date(i.scheduledAt) <= new Date()
  );

  const fetchInterviews = () => {
    fetch("/api/interviews")
      .then((r) => r.json())
      .then((data) => {
        const mine = (data || []).filter(
          (i: Interview & { candidate?: { email?: string } }) =>
            i.candidate?.email === user?.primaryEmailAddress?.emailAddress
        );
        setInterviews(mine);
      })
      .catch(console.error);
  };

  const handleCancel = async (id: string) => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    setCancelLoading(id);
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id, email: user!.primaryEmailAddress!.emailAddress }),
      });
      const data = await res.json();
      if (data.success) fetchInterviews();
      else alert(data.error || "Failed to cancel");
    } catch { alert("Failed to cancel interview"); }
    finally { setCancelLoading(null); }
  };

  const handleConfirm = async (id: string) => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    setConfirmLoading(id);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id, email: user!.primaryEmailAddress!.emailAddress }),
      });
      const data = await res.json();
      if (data.success) fetchInterviews();
      else alert(data.error || "Failed to confirm");
    } catch { alert("Failed to confirm interview"); }
    finally { setConfirmLoading(null); }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1a2b3c]">
          Welcome back, {user?.firstName || "there"}
        </h1>
        <p className="text-sm text-[#5a6b7c]">
          View your upcoming interviews
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f4fd]">
            <Calendar className="h-5 w-5 text-[#0090d9]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1a2b3c]">{upcoming.length}</div>
            <div className="text-xs text-[#5a6b7c]">Upcoming interviews</div>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1a2b3c]">{past.length}</div>
            <div className="text-xs text-[#5a6b7c]">Completed</div>
          </div>
        </div>
      </div>

      {/* Upcoming Interviews */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#1a2b3c]">Upcoming Interviews</h2>
        {loading ? (
          <p className="text-sm text-[#8a95a3]">Loading...</p>
        ) : upcoming.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-[#c4cdd8]" />
            <p className="text-sm text-[#5a6b7c]">No upcoming interviews</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((interview) => {
              const date = new Date(interview.scheduledAt);
              return (
                <div
                  key={interview.id}
                  className="flex items-center justify-between rounded-lg border border-[#e2e8f0] p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-[#e8f4fd]">
                      <span className="text-[10px] font-semibold uppercase text-[#0090d9]">
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-none text-[#0090d9]">
                        {date.getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#1a2b3c]">
                        {interview.position}
                      </div>
                      <div className="text-xs text-[#5a6b7c]">
                        {date.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        - {interview.duration} min
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {interview.confirmed ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-600">
                        Confirmed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirm(interview.id)}
                        disabled={confirmLoading === interview.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-xs font-medium text-[#059669] hover:bg-[#d1fae5] transition-colors disabled:opacity-40"
                      >
                        {confirmLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Confirm
                      </button>
                    )}
                    {interview.meetLink && (
                      <a
                        href={interview.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0077b6]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Join
                      </a>
                    )}
                    <Link
                      href="/book"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reschedule
                    </Link>
                    <button
                      onClick={() => handleCancel(interview.id)}
                      disabled={cancelLoading === interview.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#dc2626] hover:bg-[#fef2f2] transition-colors disabled:opacity-40"
                    >
                      {cancelLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
