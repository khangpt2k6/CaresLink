"use client";

import { format } from "date-fns";
import {
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Video,
} from "lucide-react";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  reminderSent: boolean;
  calendarLink: string | null;
  candidate: { name: string; email: string; phone: string | null };
}

export function InterviewCard({
  interview,
  onSendReminder,
  reminderLoading,
}: {
  interview: Interview;
  onSendReminder: (id: string) => void;
  reminderLoading: string | null;
}) {
  const scheduledDate = new Date(interview.scheduledAt);
  const isPast = scheduledDate < new Date();

  return (
    <div className="glass card-hover rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: candidate info */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-sm font-semibold text-teal-700">
            {interview.candidate.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-medium text-teal-900">
              {interview.candidate.name}
            </h3>
            <p className="text-[11px] text-teal-600">{interview.position}</p>
          </div>
        </div>

        {/* Middle: schedule info */}
        <div className="flex items-center gap-4 text-[12px] text-teal-700">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-teal-500" />
            {format(scheduledDate, "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-teal-500" />
            {format(scheduledDate, "h:mm a")}
          </span>
          <span className="flex items-center gap-1.5 text-teal-600">
            <Video className="h-3.5 w-3.5 text-teal-500" />
            {interview.duration}m
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {interview.calendarLink && (
            <a
              href={interview.calendarLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50/80 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100/80"
            >
              <ExternalLink className="h-3 w-3" />
              Calendar
            </a>
          )}

          {!interview.reminderSent && interview.candidate.phone && !isPast ? (
            <button
              onClick={() => onSendReminder(interview.id)}
              disabled={reminderLoading === interview.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-500/20 disabled:opacity-40"
            >
              {reminderLoading === interview.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Bell className="h-3 w-3" />
              )}
              Remind
            </button>
          ) : interview.reminderSent ? (
            <span className="flex items-center gap-1 rounded-lg bg-teal-50/60 px-2.5 py-1.5 text-[11px] font-medium text-teal-600">
              <CheckCircle2 className="h-3 w-3" />
              Reminded
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
