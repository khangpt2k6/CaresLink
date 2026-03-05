"use client";

import { format } from "date-fns";
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
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dbeddb]">
        <Check className="h-7 w-7 text-[#2b593f]" strokeWidth={2.5} />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-[#37352f]">
        Interview Booked!
      </h2>
      <p className="mt-1 text-sm text-[#9b9a97]">
        We&apos;ve sent a calendar invitation with the details.
      </p>

      {/* Details card */}
      <div className="mt-6 w-full rounded-lg border border-[#e8e8e5] bg-white text-left">
        <div className="border-b border-[#e8e8e5] px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-[#73726e]">
            <Calendar className="h-3.5 w-3.5 text-[#9b9a97]" />
            {format(start, "EEEE, MMMM d, yyyy")}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-[#73726e]">
            <Clock className="h-3.5 w-3.5 text-[#9b9a97]" />
            {format(start, "h:mm a")} &ndash; {format(end, "h:mm a")} EST
            <span className="text-[#9b9a97]">&middot; {interview.duration}m</span>
          </div>
        </div>

        {interview.meetLink && (
          <div className="border-b border-[#e8e8e5] px-5 py-3">
            <a
              href={interview.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-[#2383e2] px-3 py-2 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors"
            >
              <Video className="h-4 w-4" />
              Join Video Call
            </a>
          </div>
        )}

        {/* Cancel / reschedule */}
        {cancelUrl && (
          <div className="border-b border-[#e8e8e5] px-5 py-3 flex items-center gap-3 text-sm text-[#73726e]">
            <span>Need to change?</span>
            <a href="/book" className="text-[#2383e2] hover:underline">Reschedule</a>
            <span className="text-[#d4d4d0]">·</span>
            <a href={cancelUrl} className="text-[#93392e] hover:underline">Cancel</a>
          </div>
        )}

        {/* Add to calendar */}
        <div className="px-5 py-3">
          <p className="mb-2 text-xs font-medium text-[#9b9a97]">
            Add to calendar
          </p>
          <div className="flex items-center gap-2">
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e8e8e5] px-3 py-1.5 text-xs text-[#73726e] hover:bg-[#f7f7f5] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Google
            </a>
            <a
              href={outlookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e8e8e5] px-3 py-1.5 text-xs text-[#73726e] hover:bg-[#f7f7f5] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Outlook
            </a>
            <button
              type="button"
              onClick={handleDownloadICS}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e8e8e5] px-3 py-1.5 text-xs text-[#73726e] hover:bg-[#f7f7f5] transition-colors"
            >
              <Download className="h-3 w-3" />
              .ics File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
