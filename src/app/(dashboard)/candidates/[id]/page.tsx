"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, Briefcase, Calendar, Clock, MapPin, Video, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  completed: boolean;
  noShow: boolean;
  cancelled: boolean;
  confirmed: boolean;
}

interface Event {
  id: string;
  type: string;
  metadata: string | null;
  createdAt: string;
}

interface CandidateDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  fitStatus: string | null;
  appliedAt: string;
  interviews: Interview[];
  events: Event[];
}

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

const fitLabels: Record<string, string> = {
  good_fit: "Good Fit",
  waitlist: "Waitlist",
  not_a_fit: "Not a Fit",
};

const eventLabels: Record<string, string> = {
  email_sent: "Email Sent",
  booking_link_sent: "Booking Link Sent",
  interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  interview_cancelled: "Interview Cancelled",
  status_change: "Status Changed",
  fit_status_change: "Fit Status Changed",
};

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/candidates/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setCandidate)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0090d9] border-t-transparent" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-[#94a3b8]" />
        <p className="text-sm text-[#64748b]">Candidate not found</p>
        <button onClick={() => router.push("/candidates")} className="text-sm text-[#0090d9] hover:underline">
          Back to candidates
        </button>
      </div>
    );
  }

  const upcoming = candidate.interviews.filter((i) => !i.completed && !i.cancelled && !i.noShow && new Date(i.scheduledAt) > new Date());
  const past = candidate.interviews.filter((i) => i.completed || i.cancelled || i.noShow || new Date(i.scheduledAt) <= new Date());

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/candidates")}
        className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#0090d9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to candidates
      </button>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#0090d9] text-lg font-semibold text-white">
            {candidate.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[#1a2b3c]">{candidate.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {candidate.email}
              </span>
              {candidate.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {candidate.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {candidate.position}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-[#475569]">
                {statusLabels[candidate.status] || candidate.status}
              </span>
              {candidate.fitStatus && (
                <span className="inline-flex items-center rounded-full bg-[#e0f2fe] px-2.5 py-1 text-xs font-medium text-[#0090d9]">
                  {fitLabels[candidate.fitStatus] || candidate.fitStatus}
                </span>
              )}
              <span className="text-xs text-[#94a3b8]">
                Applied {new Date(candidate.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Interviews */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">Interviews</h2>

          {candidate.interviews.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No interviews scheduled</p>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcoming.map((i) => (
                      <InterviewCard key={i.id} interview={i} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-2">Past</p>
                  <div className="space-y-2">
                    {past.map((i) => (
                      <InterviewCard key={i.id} interview={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activity timeline */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">Activity</h2>

          {candidate.events.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No activity yet</p>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e2e8f0]" />

              {candidate.events.map((event) => (
                <div key={event.id} className="relative flex items-start gap-3 py-2.5">
                  <div className="relative z-10 mt-0.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 border-[#e2e8f0] bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#334155]">
                      {eventLabels[event.type] || event.type}
                    </p>
                    {event.metadata && (
                      <p className="text-xs text-[#94a3b8] truncate">{event.metadata}</p>
                    )}
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InterviewCard({ interview }: { interview: Interview }) {
  const date = new Date(interview.scheduledAt);
  const isPast = date <= new Date() || interview.completed || interview.cancelled || interview.noShow;

  let statusIcon = <Calendar className="h-4 w-4 text-[#0090d9]" />;
  let statusText = "Scheduled";
  if (interview.completed) { statusIcon = <CheckCircle2 className="h-4 w-4 text-[#10b981]" />; statusText = "Completed"; }
  else if (interview.cancelled) { statusIcon = <XCircle className="h-4 w-4 text-[#94a3b8]" />; statusText = "Cancelled"; }
  else if (interview.noShow) { statusIcon = <AlertCircle className="h-4 w-4 text-[#f59e0b]" />; statusText = "No-show"; }
  else if (interview.confirmed) { statusIcon = <CheckCircle2 className="h-4 w-4 text-[#0090d9]" />; statusText = "Confirmed"; }

  return (
    <div className={`rounded-lg border p-3 ${isPast ? "border-[#f1f5f9] bg-[#fafbfc]" : "border-[#e2e8f0] bg-white"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium text-[#1a2b3c]">{interview.position}</span>
        </div>
        <span className="text-xs text-[#94a3b8]">{statusText}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b]">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {interview.duration}min
        </span>
        <span className="inline-flex items-center gap-1">
          {interview.location.toLowerCase().includes("video") ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
          {interview.location}
        </span>
      </div>
    </div>
  );
}
