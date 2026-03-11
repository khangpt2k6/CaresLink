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
  UserX,
  XCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  reminderSent: boolean;
  confirmed: boolean;
  noShow?: boolean;
  completed?: boolean;
  calendarLink: string | null;
  meetLink: string | null;
  candidateId: string;
  candidate: { name: string; email: string; phone: string | null };
}

export function InterviewCard({
  interview,
  onSendReminder,
  onDelete,
  onMarkNoShow,
  onRejectCandidate,
  onFollowUpCandidate,
  onCandidateCancel,
  onCandidateConfirm,
  reminderLoading,
  deleteLoading,
  noShowLoading,
  rejectLoading,
  followUpLoading,
  candidateCancelLoading,
  candidateConfirmLoading,
  showRecruiterActions = true,
  index = 0,
}: {
  interview: Interview;
  onSendReminder: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkNoShow?: (id: string) => void;
  onRejectCandidate?: (interviewId: string, candidateId: string) => void;
  onFollowUpCandidate?: (interviewId: string, candidateId: string) => void;
  onCandidateCancel?: (id: string) => void;
  onCandidateConfirm?: (id: string) => void;
  reminderLoading: string | null;
  deleteLoading: string | null;
  noShowLoading?: string | null;
  rejectLoading?: string | null;
  followUpLoading?: string | null;
  candidateCancelLoading?: string | null;
  candidateConfirmLoading?: string | null;
  showRecruiterActions?: boolean;
  index?: number;
}) {
  const scheduledDate = new Date(interview.scheduledAt);
  const isPast = scheduledDate < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className="card px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0090d9] text-xs font-medium text-white">
            {interview.candidate.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#1a2b3c]">{interview.candidate.name}</h3>
            <p className="text-xs text-[#5a6b7c]">{interview.position}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-[#5a6b7c]">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#0090d9]" />
            {format(scheduledDate, "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#0090d9]" />
            {format(scheduledDate, "h:mm a")}
          </span>
          <span className="text-[#8a95a3]">{interview.duration}m</span>
          {interview.noShow ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-medium text-[#dc2626]">
              <UserX className="h-3 w-3" /> No-show
            </span>
          ) : interview.completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#059669]">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          ) : interview.confirmed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#059669]">
              <CheckCircle2 className="h-3 w-3" /> Confirmed
            </span>
          ) : !isPast ? (
            <span className="inline-flex items-center rounded-full bg-[#fffbeb] px-2 py-0.5 text-[10px] font-medium text-[#b45309]">
              Awaiting confirmation
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {interview.meetLink && (
            <a href={interview.meetLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0077b6] transition-colors">
              <Video className="h-3 w-3" /> Join
            </a>
          )}
          {interview.calendarLink && (
            <a href={interview.calendarLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors">
              <ExternalLink className="h-3 w-3" /> Calendar
            </a>
          )}
          {showRecruiterActions && (
            <>
              {isPast && !interview.noShow && !interview.completed && onMarkNoShow && (
                <button
                  onClick={() => onMarkNoShow(interview.id)}
                  disabled={noShowLoading === interview.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#b45309] hover:bg-[#fffbeb] transition-colors disabled:opacity-40"
                >
                  {noShowLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                  Mark no-show
                </button>
              )}
              {!interview.reminderSent && !isPast ? (
                <button onClick={() => onSendReminder(interview.id)} disabled={reminderLoading === interview.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors disabled:opacity-40">
                  {reminderLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                  Remind
                </button>
              ) : interview.reminderSent && !isPast ? (
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#059669]">
                  <CheckCircle2 className="h-3 w-3" /> Sent
                </span>
              ) : null}
              <button
                onClick={() => { if (confirm("Cancel this interview?")) onDelete(interview.id); }}
                disabled={deleteLoading === interview.id}
                className="rounded-md p-1.5 text-[#8a95a3] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors disabled:opacity-40">
                {deleteLoading === interview.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
          {!showRecruiterActions && !isPast && (
            <>
              {!interview.confirmed && onCandidateConfirm && (
                <button
                  onClick={() => onCandidateConfirm(interview.id)}
                  disabled={candidateConfirmLoading === interview.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-xs font-medium text-[#059669] hover:bg-[#d1fae5] transition-colors disabled:opacity-40"
                >
                  {candidateConfirmLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Confirm
                </button>
              )}
              <Link
                href="/book"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Reschedule
              </Link>
              {onCandidateCancel && (
                <button
                  onClick={() => { if (confirm("Are you sure you want to cancel this interview?")) onCandidateCancel(interview.id); }}
                  disabled={candidateCancelLoading === interview.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#dc2626] hover:bg-[#fef2f2] transition-colors disabled:opacity-40"
                >
                  {candidateCancelLoading === interview.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
