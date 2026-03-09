"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Calendar, Home } from "lucide-react";
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

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-gradient-to-br from-[#f5f7fa] via-white to-[#e8f4fd]/30 px-4 py-8">
      {/* Decorative blob */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-[#0090d9]/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-1/4 h-48 w-48 rounded-full bg-[#0090d9]/5 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-6 left-6"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/80 px-4 py-2 text-sm text-[#5a6b7c] shadow-sm backdrop-blur-sm transition-all hover:border-[#0090d9]/30 hover:bg-white hover:text-[#1a2b3c] hover:shadow-md"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex flex-col items-center gap-3"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={56}
            height={56}
            className="rounded-xl shadow-lg ring-2 ring-[#0090d9]/10"
          />
        </motion.div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1a2b3c]">CaresLink</h1>
          <p className="mt-1 text-sm text-[#5a6b7c]">Book your interview</p>
        </div>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl shadow-[#0090d9]/5"
      >
        <AnimatePresence mode="wait">
          {step === "confirmed" && result ? (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="p-6"
            >
              <Confirmation
                interview={result.interview}
                candidate={result.candidate}
              />
            </motion.div>
          ) : step === "form" && selectedSlot ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="p-6"
            >
              <motion.button
                type="button"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
                className="mb-4 flex items-center gap-1.5 text-sm text-[#5a6b7c] transition-colors hover:text-[#0090d9]"
                whileHover={{ x: -2 }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </motion.button>
              <h2 className="mb-5 text-lg font-semibold text-[#1a2b3c]">
                Your Details
              </h2>
              <BookingForm
                selectedSlot={selectedSlot}
                onSubmit={handleBooking}
                submitting={submitting}
                error={error}
              />
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <motion.div
                className="mb-4 flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f4fd]">
                  <Calendar className="h-4 w-4 text-[#0090d9]" />
                </div>
                <h2 className="text-base font-semibold text-[#1a2b3c]">
                  Select a Date & Time
                </h2>
              </motion.div>
              <p className="mb-5 text-xs text-[#5a6b7c]">
                {duration} min interview &middot; All times shown in {tzLabel}
              </p>

              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-4 py-16"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
                  <p className="text-sm text-[#8a95a3]">Loading availability...</p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="grid gap-6 lg:grid-cols-[1fr_200px]"
                >
                  <DatePicker
                    currentMonth={currentMonth}
                    onMonthChange={handleMonthChange}
                    availableDates={availableDates}
                    selectedDate={selectedDate}
                    onSelectDate={handleDateSelect}
                  />
                  <div>
                    {selectedDate ? (
                      <>
                        <p className="mb-2 text-xs font-medium text-[#5a6b7c]">
                          {format(selectedDate, "EEEE, MMM d")}
                        </p>
                        <div className="max-h-[280px] overflow-y-auto pr-1">
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
                        className="flex h-full min-h-[200px] items-center justify-center rounded-xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc]/50"
                      >
                        <p className="text-sm text-[#8a95a3]">Select a date</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="border-t border-[#e2e8f0] px-6 py-3 text-center">
          <span className="text-xs text-[#8a95a3]">
            Powered by CaresLink AI
          </span>
        </div>
      </motion.div>
    </div>
  );
}
