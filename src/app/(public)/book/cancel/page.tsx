"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { Loader2, X, Check, Calendar, Clock, AlertTriangle } from "lucide-react";

interface InterviewDetails {
  id: string;
  scheduledAt: string;
  duration: number;
  position: string;
  candidate: { name: string; email: string };
}

function CancelContent() {
  const searchParams = useSearchParams();
  const interviewId = searchParams.get("interviewId");
  const email = searchParams.get("email");

  const [interview, setInterview] = useState<InterviewDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [step, setStep] = useState<"confirm" | "cancelled" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!interviewId || !email) {
      setErrorMsg("Invalid cancel link.");
      setStep("error");
      setLoading(false);
      return;
    }

    fetch(`/api/interviews/${interviewId}?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setStep("error");
        } else {
          setInterview(data);
        }
      })
      .catch(() => {
        setErrorMsg("Failed to load interview details.");
        setStep("error");
      })
      .finally(() => setLoading(false));
  }, [interviewId, email]);

  const handleCancel = async () => {
    if (!interviewId || !email) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("cancelled");
      } else {
        setErrorMsg(data.error || "Failed to cancel. Please try again.");
        setStep("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStep("error");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/careslink_logo.jpg" alt="CaresLink" width={48} height={48} className="rounded-full" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#37352f]">CaresLink</h1>
          <p className="text-sm text-[#9b9a97]">Cancel Interview</p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-xl border border-[#e8e8e5] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
          </div>
        ) : step === "cancelled" ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffe2dd]">
              <X className="h-7 w-7 text-[#93392e]" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-semibold text-[#37352f]">Interview Cancelled</h2>
            <p className="text-sm text-[#73726e]">
              Your interview has been cancelled and removed from the calendar.
              The recruiter has been notified.
            </p>
            <a
              href="/book"
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#2383e2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Reschedule a new time
            </a>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fdecc8]">
              <AlertTriangle className="h-7 w-7 text-[#89632a]" />
            </div>
            <h2 className="text-lg font-semibold text-[#37352f]">Something went wrong</h2>
            <p className="text-sm text-[#73726e]">{errorMsg}</p>
          </div>
        ) : interview ? (
          <>
            <div className="p-6">
              <h2 className="mb-4 text-base font-semibold text-[#37352f]">
                Cancel this interview?
              </h2>

              {/* Interview details */}
              <div className="rounded-lg border border-[#e8e8e5] bg-[#f7f7f5] p-4 flex flex-col gap-2 mb-5">
                <p className="text-sm font-medium text-[#37352f]">{interview.position}</p>
                <div className="flex items-center gap-2 text-sm text-[#73726e]">
                  <Calendar className="h-3.5 w-3.5 text-[#9b9a97]" />
                  {format(new Date(interview.scheduledAt), "EEEE, MMMM d, yyyy")}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#73726e]">
                  <Clock className="h-3.5 w-3.5 text-[#9b9a97]" />
                  {format(new Date(interview.scheduledAt), "h:mm a")} EST &middot; {interview.duration}m
                </div>
              </div>

              <p className="mb-5 text-sm text-[#73726e]">
                This will remove the calendar event and notify the recruiter.
                You can reschedule a new time after cancelling.
              </p>

              <div className="flex gap-3">
                <a
                  href="/book"
                  className="flex-1 rounded-md border border-[#e8e8e5] px-4 py-2.5 text-sm font-medium text-[#73726e] hover:bg-[#f7f7f5] transition-colors text-center"
                >
                  Keep interview
                </a>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#ffe2dd] px-4 py-2.5 text-sm font-medium text-[#93392e] hover:bg-[#ffd0c8] transition-colors disabled:opacity-50"
                >
                  {cancelling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Cancelling...</>
                  ) : (
                    <><X className="h-4 w-4" /> Cancel interview</>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="border-t border-[#e8e8e5] px-6 py-3 text-center">
          <span className="text-xs text-[#b4b4b0]">Powered by CaresLink AI</span>
        </div>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
      </div>
    }>
      <CancelContent />
    </Suspense>
  );
}
