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
  Trash2,
} from "lucide-react";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  reminderSent: boolean;
  calendarLink: string | null;
  meetLink: string | null;
  candidate: { name: string; email: string; phone: string | null };
}

export function InterviewCard({
  interview,
  onSendReminder,
  onDelete,
  reminderLoading,
  deleteLoading,
}: {
  interview: Interview;
  onSendReminder: (id: string) => void;
  onDelete: (id: string) => void;
  reminderLoading: string | null;
  deleteLoading: string | null;
}) {
  const scheduledDate = new Date(interview.scheduledAt);
  const isPast = scheduledDate < new Date();

  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2383e2] text-xs font-medium text-white">
            {interview.candidate.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#37352f]">{interview.candidate.name}</h3>
            <p className="text-xs text-[#9b9a97]">{interview.position}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-[#73726e]">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#9b9a97]" />
            {format(scheduledDate, "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#9b9a97]" />
            {format(scheduledDate, "h:mm a")}
          </span>
          <span className="text-[#9b9a97]">{interview.duration}m</span>
        </div>

        <div className="flex items-center gap-1.5">
          {interview.meetLink && (
            <a href={interview.meetLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#2383e2] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1b6ec2] transition-colors">
              <Video className="h-3 w-3" /> Join
            </a>
          )}
          {interview.calendarLink && (
            <a href={interview.calendarLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[#73726e] hover:bg-[#f1f1ef] transition-colors">
              <ExternalLink className="h-3 w-3" /> Calendar
            </a>
          )}
          {!interview.reminderSent && !isPast ? (
            <button onClick={() => onSendReminder(interview.id)} disabled={reminderLoading === interview.id}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[#73726e] hover:bg-[#f1f1ef] transition-colors disabled:opacity-40">
              {reminderLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              Remind
            </button>
          ) : interview.reminderSent ? (
            <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#2b593f]">
              <CheckCircle2 className="h-3 w-3" /> Sent
            </span>
          ) : null}
          <button
            onClick={() => { if (confirm("Cancel this interview?")) onDelete(interview.id); }}
            disabled={deleteLoading === interview.id}
            className="rounded-md p-1.5 text-[#9b9a97] hover:bg-[#ffe2dd] hover:text-[#93392e] transition-colors disabled:opacity-40">
            {deleteLoading === interview.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
