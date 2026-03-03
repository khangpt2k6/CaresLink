"use client";

import { format } from "date-fns";
import { Calendar, Clock, Bell, CheckCircle2, Loader2 } from "lucide-react";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  reminderSent: boolean;
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
  return (
    <div className="glass card-hover rounded-xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100/50 text-sm font-medium text-teal-700">
            {interview.candidate.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-medium text-teal-900">
              {interview.candidate.name}
            </h3>
            <p className="text-[11px] text-teal-700">{interview.position}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[12px] text-teal-700">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-teal-700" />
              {format(new Date(interview.scheduledAt), "MMM d")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-teal-700" />
              {format(new Date(interview.scheduledAt), "h:mm a")}
            </span>
            <span className="text-teal-700">{interview.duration}m</span>
          </div>
          {!interview.reminderSent && interview.candidate.phone ? (
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
            <span className="flex items-center gap-1 text-[11px] text-teal-700">
              <CheckCircle2 className="h-3 w-3" />
              Sent
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
