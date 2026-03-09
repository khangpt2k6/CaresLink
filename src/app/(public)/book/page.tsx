"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Calendar, Home, Clock, Video, Globe } from "lucide-react";
import { DatePicker } from "@/components/booking/date-picker";
import { TimeSlots } from "@/components/booking/time-slots";
import { BookingForm } from "@/components/booking/booking-form";
import { Confirmation } from "@/components/booking/confirmation";

type Step = "select" | "form" | "confirmed";

interface BookingResult {
  interview: {
    id: string;
    scheduledAt: string;
    duration: number;
    meetLink: string | null;
    calendarLink: string | null;
  };
  candidate: { id: string; name: string; email: string };
}

export default function BookPage() {
  const [step, setStep] = useState<Step>("select");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tzLabel, setTzLabel] = useState("Eastern Time (ET)");
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s?.timezone) {
          const abbr = new Intl.DateTimeFormat("en-US", { timeZone: s.timezone, timeZoneName: "short" })
            .formatToParts(new Date())
            .find((p: Intl.DateTimeFormatPart) => p.type === "timeZoneName")?.value || s.timezone;
          setTzLabel(abbr);
        }
        if (s?.defaultDuration) setDuration(s.defaultDuration);
      })
      .catch(() => {});
  }, []);

  const fetchAvailability = useCallback(async (month: Date) => {
    setLoading(true);
    try {
      const monthStr = format(month, "yyyy-MM");
      const res = await fetch(`/api/booking/availability?month=${monthStr}`);
      const data = await res.json();
      setAvailableDates(data.availableDates || []);
      setSlotsByDate(data.slotsByDate || {});
    } catch {
      setAvailableDates([]);
      setSlotsByDate({});
    } finally {
      setLoading(false);
    }
  }, []);

  // Track schedule version — only refetch when recruiter saves changes
  const scheduleVersion = useRef(0);

  useEffect(() => {
    fetchAvailability(currentMonth);

    // Poll lightweight version endpoint every 5s — only refetches availability when recruiter saves
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/booking/version");
        const { version } = await res.json();
        if (version !== scheduleVersion.current) {
          scheduleVersion.current = version;
          fetchAvailability(currentMonth);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentMonth, fetchAvailability]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setError(null);
    setStep("form");
  };

  const handleBooking = async (form: {
    name: string;
    email: string;
    phone: string;
    position: string;
  }) => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: selectedSlot,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        setStep("confirmed");
      } else {
        setError(data.error || "Failed to book. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const daySlots = selectedDateStr ? slotsByDate[selectedDateStr] || [] : [];

  const companyName = "CaresLink Team";

  return (
    <div className="relative flex min-h-screen min-w-0 flex-col items-center overflow-x-hidden bg-gradient-to-br from-[#f8fafc] via-white to-[#e8f4fd]/40 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-[#0090d9]/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-1/4 h-48 w-48 rounded-full bg-[#0090d9]/5 blur-3xl" />

      {/* Back to Home - responsive position */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-4 left-4 z-10 sm:top-6 sm:left-6"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm transition-all hover:border-[#0090d9]/30 hover:bg-white hover:text-[#1a2b3c] hover:shadow-md sm:px-4 sm:text-sm"
        >
          <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Home
        </Link>
      </motion.div>

      {/* Compact header for mobile, full for desktop */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-6 flex flex-col items-center gap-2 sm:mb-8 sm:gap-3"
      >
        <div className="flex items-center gap-2">
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={40}
            height={40}
            className="rounded-lg shadow-md sm:h-12 sm:w-12 sm:rounded-xl"
          />
          <div className="text-left">
            <h1 className="text-lg font-bold text-[#1a2b3c] sm:text-2xl">CaresLink</h1>
            <p className="text-xs text-[#5a6b7c] sm:text-sm">Book your interview</p>
          </div>
        </div>
      </motion.header>

      {/* Main card - Fixed size for smooth step transitions (Slashy-style) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl shadow-[#0090d9]/5"
      >
        <div className="flex min-h-[420px] flex-col sm:min-h-[460px] lg:min-h-[480px]">
          <AnimatePresence mode="wait">
            {step === "confirmed" && result ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-1 flex-col p-5 sm:p-6 lg:p-8"
              >
                <Confirmation
                  interview={result.interview}
                  candidate={result.candidate}
                />
              </motion.div>
            ) : step === "form" && selectedSlot ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-1 flex-col lg:flex-row"
              >
                {/* Left panel - Meeting details (Slashy-style, same structure as select for smooth UX) */}
                <div className="flex flex-col border-b border-[#e2e8f0] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
                  <div className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 lg:p-6">
                    <motion.button
                      type="button"
                      onClick={() => {
                        setStep("select");
                        setError(null);
                      }}
                      className="-ml-1 flex w-fit items-center gap-1.5 text-sm text-[#0090d9] transition-colors hover:text-[#0077b6]"
                      whileHover={{ x: -2 }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </motion.button>
                    <div>
                      <p className="text-sm text-[#5a6b7c]">{companyName}</p>
                      <h2 className="mt-0.5 text-lg font-bold text-[#1a2b3c]">Interview</h2>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                        <Clock className="h-4 w-4 text-[#0090d9]" />
                        <span>{duration} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                        <Video className="h-4 w-4 text-[#0090d9]" />
                        <span>Video Call</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-[#5a6b7c]">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#0090d9]" />
                        <span>
                          {format(new Date(selectedSlot), "h:mm a")} – {format(new Date(new Date(selectedSlot).getTime() + duration * 60000), "h:mm a")}
                          <br />
                          {format(new Date(selectedSlot), "EEEE, MMMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                        <Globe className="h-4 w-4 shrink-0 text-[#0090d9]" />
                        <span>{tzLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right panel - Form (same flex-1 as calendar area) */}
                <div className="flex flex-1 flex-col justify-center p-4 sm:p-5 lg:p-6">
                  <BookingForm
                    selectedSlot={selectedSlot}
                    onSubmit={handleBooking}
                    submitting={submitting}
                    error={error}
                    hideTimeSummary
                  />
                </div>
              </motion.div>
            ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-1 flex-col lg:flex-row"
            >
              {/* Left panel - Meeting details (Slashy-style) - hidden on small, visible lg+ */}
              <div className="hidden border-b border-[#e2e8f0] lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
                <div className="flex flex-col gap-4 p-5 lg:p-6">
                  <div>
                    <p className="text-sm text-[#5a6b7c]">{companyName}</p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#1a2b3c]">Interview</h2>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                      <Clock className="h-4 w-4 text-[#0090d9]" />
                      <span>{duration} min</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#5a6b7c]">
                      <Video className="h-4 w-4 text-[#0090d9]" />
                      <span>Video Call</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile: show meeting summary at top */}
              <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-4 sm:p-5 lg:hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#1a2b3c]">Interview</h2>
                    <p className="text-xs text-[#5a6b7c]">{duration} min &middot; Video Call</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1.5">
                    <Globe className="h-3.5 w-3.5 text-[#0090d9]" />
                    <span className="text-xs font-medium text-[#5a6b7c]">{tzLabel}</span>
                  </div>
                </div>
              </div>

              {/* Center + Right: Calendar & Time slots */}
              <div className="flex flex-1 flex-col p-4 sm:p-5 lg:p-6">
                {loading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16"
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
                    <p className="text-sm text-[#8a95a3]">Loading availability...</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <motion.div
                        className="flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                          <Calendar className="h-4 w-4 text-[#0090d9]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#1a2b3c] sm:text-base">
                            Select a Date & Time
                          </h3>
                          <p className="text-xs text-[#5a6b7c]">
                            All times in {tzLabel}
                          </p>
                        </div>
                      </motion.div>
                      {/* Timezone badge - desktop */}
                      <div className="hidden items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 sm:flex">
                        <Globe className="h-4 w-4 text-[#0090d9]" />
                        <span className="text-sm font-medium text-[#5a6b7c]">{tzLabel}</span>
                      </div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="grid gap-6 lg:grid-cols-[1fr_220px]"
                    >
                      <DatePicker
                        currentMonth={currentMonth}
                        onMonthChange={handleMonthChange}
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onSelectDate={handleDateSelect}
                      />
                      <div className="min-w-0">
                        {selectedDate ? (
                          <>
                            <p className="mb-2 text-xs font-semibold text-[#1a2b3c] sm:text-sm">
                              {format(selectedDate, "EEEE, MMM d")}
                            </p>
                            <div className="max-h-[240px] overflow-y-auto pr-1 sm:max-h-[280px]">
                              <TimeSlots
                                slots={daySlots}
                                selectedSlot={selectedSlot}
                                onSelectSlot={handleSlotSelect}
                              />
                            </div>
                          </>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc]/50 p-4 sm:min-h-[200px]"
                          >
                            <Clock className="h-8 w-8 text-[#c4cdd8]" />
                            <p className="mt-2 text-sm text-[#8a95a3]">Select a date</p>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}

                {availableDates.length === 0 && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-8 text-center"
                  >
                    <Calendar className="mx-auto h-10 w-10 text-[#c4cdd8]" />
                    <p className="mt-3 text-sm font-medium text-[#1a2b3c]">
                      No availability this month
                    </p>
                    <p className="mt-1 text-xs text-[#8a95a3]">
                      Try navigating to the next month
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e2e8f0] px-4 py-2.5 text-center sm:px-6 sm:py-3">
          <span className="text-xs text-[#8a95a3]">
            Scheduled with CaresLink
          </span>
        </div>
      </motion.div>
    </div>
  );
}
