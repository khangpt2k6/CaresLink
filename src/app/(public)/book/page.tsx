"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { format, startOfMonth } from "date-fns";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
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
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/careslink_logo.jpg"
          alt="CaresLink"
          width={48}
          height={48}
          className="rounded-full"
        />
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#37352f]">CaresLink</h1>
          <p className="text-sm text-[#9b9a97]">Book your interview</p>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-2xl rounded-xl border border-[#e8e8e5] bg-white shadow-sm overflow-hidden">
        {/* Confirmed step */}
        {step === "confirmed" && result ? (
          <div key="confirmed" className="p-6 animate-in">
            <Confirmation
              interview={result.interview}
              candidate={result.candidate}
            />
          </div>
        ) : step === "form" && selectedSlot ? (
          /* Form step */
          <div key="form" className="p-6 animate-slide-in">
            <button
              type="button"
              onClick={() => {
                setStep("select");
                setError(null);
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-[#73726e] hover:text-[#37352f] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h2 className="mb-5 text-base font-semibold text-[#37352f]">
              Your Details
            </h2>
            <BookingForm
              selectedSlot={selectedSlot}
              onSubmit={handleBooking}
              submitting={submitting}
              error={error}
            />
          </div>
        ) : (
          /* Select step */
          <div key="select" className="p-6 animate-in">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#9b9a97]" />
              <h2 className="text-base font-semibold text-[#37352f]">
                Select a Date & Time
              </h2>
            </div>
            <p className="mb-5 text-xs text-[#9b9a97]">
              {duration} min interview &middot; All times shown in {tzLabel}
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
                {/* Calendar */}
                <DatePicker
                  currentMonth={currentMonth}
                  onMonthChange={handleMonthChange}
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                />

                {/* Time slots */}
                <div>
                  {selectedDate ? (
                    <>
                      <p className="mb-2 text-xs font-medium text-[#73726e]">
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
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-[#9b9a97]">Select a date</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {availableDates.length === 0 && !loading && (
              <div className="py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-[#d4d4d0]" />
                <p className="mt-3 text-sm font-medium text-[#37352f]">
                  No availability this month
                </p>
                <p className="mt-1 text-xs text-[#9b9a97]">
                  Try navigating to the next month
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[#e8e8e5] px-6 py-3 text-center">
          <span className="text-xs text-[#b4b4b0]">
            Powered by CaresLink AI
          </span>
        </div>
      </div>
    </div>
  );
}
