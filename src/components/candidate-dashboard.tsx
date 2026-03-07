"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Calendar, Clock, Video, CheckCircle } from "lucide-react";
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
  const { data: session } = useSession();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/interviews")
      .then((r) => r.json())
      .then((data) => {
        // Filter to only show interviews for this candidate's email
        const mine = (data || []).filter(
          (i: Interview & { candidate?: { email?: string } }) =>
            i.candidate?.email === session?.user?.email
        );
        setInterviews(mine);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session?.user?.email]);

  const upcoming = interviews.filter(
    (i) => !i.cancelled && !i.completed && new Date(i.scheduledAt) > new Date()
  );
  const past = interviews.filter(
    (i) => i.completed || new Date(i.scheduledAt) <= new Date()
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1a2b3c]">
          Welcome back, {session?.user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-[#5a6b7c]">
          View your upcoming interviews and book new ones
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
        <Link href="/book" className="card flex items-center gap-4 p-5 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f4fd]">
            <Clock className="h-5 w-5 text-[#0090d9]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0090d9]">Book Interview</div>
            <div className="text-xs text-[#5a6b7c]">Schedule a new one</div>
          </div>
        </Link>
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
            <Link
              href="/book"
              className="mt-3 inline-block rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6]"
            >
              Book an Interview
            </Link>
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
                  <div className="flex items-center gap-3">
                    {interview.confirmed && (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-600">
                        Confirmed
                      </span>
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
