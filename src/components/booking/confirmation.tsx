"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { Check, Calendar, Clock, Video, Download, ExternalLink } from "lucide-react";
import { generateICS, buildGoogleCalendarUrl, buildOutlookUrl } from "@/lib/ics";

interface ConfirmationProps {
  interview: {
    id: string;
    scheduledAt: string;
    duration: number;
    meetLink: string | null;
    calendarLink: string | null;
    cancelUrl?: string;
  };
  candidate: {
    name: string;
    email: string;
  };
}

export function Confirmation({ interview, candidate }: ConfirmationProps) {
  const { cancelUrl } = interview;
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + interview.duration * 60 * 1000);
  const title = `Interview - ${candidate.name}`;
  const description = `Interview for ${candidate.name} (${candidate.email})${interview.meetLink ? `\n\nJoin video call: ${interview.meetLink}` : ""}`;

  const calParams = {
    title,
    description,
    startTime: start,
    endTime: end,
    location: interview.meetLink || undefined,
  };

  const gcalUrl = buildGoogleCalendarUrl(calParams);
  const outlookUrl = buildOutlookUrl(calParams);

  const handleDownloadICS = () => {
    const content = generateICS(calParams);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f4fd] ring-4 ring-[#0090d9]/10"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
        >
          <Check className="h-8 w-8 text-[#0090d9]" strokeWidth={2.5} />
        </motion.span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 text-xl font-bold text-[#1a2b3c]"
      >
        Interview Booked!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-1 text-sm text-[#5a6b7c]"
      >
        We&apos;ve sent a calendar invitation with the details.
      </motion.p>

      {/* Details card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="mt-6 w-full overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-left shadow-inner"
      >
        <div className="border-b border-[#e2e8f0] px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
            <Calendar className="h-4 w-4 text-[#0090d9]" />
            {format(start, "EEEE, MMMM d, yyyy")}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-[#5a6b7c]">
            <Clock className="h-4 w-4 text-[#0090d9]" />
            {format(start, "h:mm a")} &ndash; {format(end, "h:mm a")} EST
            <span className="text-[#8a95a3]">&middot; {interview.duration}m</span>
          </div>
        </div>

        {interview.meetLink && (
          <div className="border-b border-[#e2e8f0] px-5 py-3.5">
            <motion.a
              href={interview.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0090d9] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0090d9]/25 transition-all hover:bg-[#0077b6] hover:shadow-xl"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Video className="h-4 w-4" />
              Join Video Call
            </motion.a>
          </div>
        )}

        {/* Cancel / reschedule */}
        {cancelUrl && (
          <div className="flex items-center gap-3 border-b border-[#e2e8f0] px-5 py-3 text-sm text-[#5a6b7c]">
            <span>Need to change?</span>
            <a href="/book" className="font-medium text-[#0090d9] transition-colors hover:text-[#0077b6]">Reschedule</a>
            <span className="text-[#c4cdd8]">·</span>
            <a href={cancelUrl} className="font-medium text-[#dc2626] transition-colors hover:text-[#b91c1c]">Cancel</a>
          </div>
        )}

        {/* Add to calendar */}
        <div className="px-5 py-3.5">
          <p className="mb-2 text-xs font-medium text-[#5a6b7c]">
            Add to calendar
          </p>
          <div className="flex flex-wrap gap-2">
            <motion.a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#5a6b7c] transition-all hover:border-[#0090d9]/30 hover:bg-[#e8f4fd]/50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <ExternalLink className="h-3 w-3" />
              Google
            </motion.a>
            <motion.a
              href={outlookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#5a6b7c] transition-all hover:border-[#0090d9]/30 hover:bg-[#e8f4fd]/50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <ExternalLink className="h-3 w-3" />
              Outlook
            </motion.a>
            <motion.button
              type="button"
              onClick={handleDownloadICS}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#5a6b7c] transition-all hover:border-[#0090d9]/30 hover:bg-[#e8f4fd]/50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Download className="h-3 w-3" />
              .ics File
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
