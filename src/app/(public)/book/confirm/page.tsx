"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { Loader2, Check, Calendar, Clock, Video, AlertTriangle, Bot, ArrowRight } from "lucide-react";

interface InterviewDetails {
  id: string;
  scheduledAt: string;
  duration: number;
  position: string;
  candidate: { name: string; email: string };
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const interviewId = searchParams.get("interviewId");
  const email = searchParams.get("email");

  const [interview, setInterview] = useState<InterviewDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<"confirm" | "confirmed" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!interviewId || !email) {
      setErrorMsg("Invalid confirmation link.");
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

  const handleConfirm = async () => {
    if (!interviewId || !email) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("confirmed");
      } else {
        setErrorMsg(data.error || "Failed to confirm. Please try again.");
        setStep("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStep("error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/careslink.png" alt="CaresLink" width={48} height={48} className="rounded-full" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#37352f]">CaresLink</h1>
          <p className="text-sm text-[#9b9a97]">Confirm Interview</p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-xl border border-[#e8e8e5] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
          </div>
        ) : step === "confirmed" ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dbeddb]">
              <Check className="h-7 w-7 text-[#2b593f]" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-semibold text-[#37352f]">Attendance Confirmed!</h2>
            <p className="text-sm text-[#73726e]">
              You&apos;re all set. Please complete a quick AI screening before your interview.
            </p>
            {interview && (
              <div className="mt-2 w-full rounded-lg border border-[#e8e8e5] bg-[#f7f7f5] px-4 py-3 text-left">
                <div className="flex items-center gap-2 text-sm text-[#73726e]">
                  <Calendar className="h-3.5 w-3.5 text-[#9b9a97]" />
                  {format(new Date(interview.scheduledAt), "EEEE, MMMM d, yyyy")}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-[#73726e]">
                  <Clock className="h-3.5 w-3.5 text-[#9b9a97]" />
                  {format(new Date(interview.scheduledAt), "h:mm a")} EST
                </div>
              </div>
            )}

            {/* AI Screening CTA */}
            <a
              href={`/screening/${interviewId}?email=${encodeURIComponent(email || "")}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0090d9] px-4 py-3 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors"
            >
              <Bot className="h-4 w-4" />
              Start AI Screening
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-[11px] text-[#b4b4b0]">Takes about 5 minutes</p>
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
          <div className="p-6">
            <h2 className="mb-4 text-base font-semibold text-[#37352f]">
              Confirm your attendance
            </h2>

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

            <div className="flex gap-3">
              <a
                href={`/book/cancel?interviewId=${interviewId}&email=${encodeURIComponent(email || "")}`}
                className="flex-1 rounded-lg border border-[#e8e8e5] px-4 py-2.5 text-sm font-medium text-[#73726e] hover:bg-[#f7f7f5] transition-colors text-center"
              >
                Can&apos;t make it
              </a>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors disabled:opacity-50"
              >
                {confirming ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                ) : (
                  <><Check className="h-4 w-4" /> Yes, I&apos;ll be there</>
                )}
              </button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[#e8e8e5] px-6 py-3 text-center">
          <span className="text-xs text-[#b4b4b0]">Powered by CaresLink AI</span>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
