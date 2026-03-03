"use client";

import { format } from "date-fns";

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{interview.candidate.name}</h3>
          <p className="text-sm text-slate-500">{interview.position}</p>
          <p className="mt-2 text-sm text-slate-700">
            {format(new Date(interview.scheduledAt), "EEE, MMM d, yyyy 'at' h:mm a")} ({interview.duration} min)
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!interview.reminderSent && interview.candidate.phone && (
            <button
              onClick={() => onSendReminder(interview.id)}
              disabled={reminderLoading === interview.id}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {reminderLoading === interview.id ? "Sending..." : "Send Reminder"}
            </button>
          )}
          {interview.reminderSent && (
            <span className="text-xs text-slate-500">Reminder sent</span>
          )}
        </div>
      </div>
    </div>
  );
}
