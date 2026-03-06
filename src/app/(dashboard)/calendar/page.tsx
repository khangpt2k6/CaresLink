"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Save, Loader2, X, Ban, Check, Globe, Timer, Link2, Unlink } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (ICT)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

interface AvailabilityDay {
  id: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  enabled: boolean;
}

interface DateOverride {
  id: string;
  date: string;
  available: boolean;
  startHour: number | null;
  endHour: number | null;
  reason: string | null;
}

function HourSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-[#8a95a3] w-10">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CalendarPage() {
  const [schedule, setSchedule] = useState<AvailabilityDay[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [tzSaving, setTzSaving] = useState(false);
  const [duration, setDuration] = useState(60);
  const [durSaving, setDurSaving] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalOauthAvailable, setGcalOauthAvailable] = useState(false);

  // Fetch weekly schedule + timezone + Google Calendar status
  useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/google-calendar").then((r) => r.json()),
    ])
      .then(([scheduleData, settings, gcal]) => {
        setSchedule(scheduleData);
        if (settings?.timezone) setTimezone(settings.timezone);
        if (settings?.defaultDuration) setDuration(settings.defaultDuration);
        setGcalConnected(gcal?.connected || false);
        setGcalEmail(gcal?.email || null);
        setGcalOauthAvailable(gcal?.oauthAvailable || false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Handle Google Calendar OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalResult = params.get("gcal");
    if (gcalResult === "connected") {
      setGcalConnected(true);
      fetch("/api/google-calendar").then((r) => r.json()).then((gcal) => {
        setGcalEmail(gcal?.email || null);
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gcalResult === "error") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch overrides for current month
  const fetchOverrides = useCallback(async (month: Date) => {
    const monthStr = format(month, "yyyy-MM");
    const res = await fetch(`/api/availability/overrides?month=${monthStr}`);
    const data = await res.json();
    setOverrides(data);
  }, []);

  useEffect(() => {
    fetchOverrides(currentMonth);
  }, [currentMonth, fetchOverrides]);

  // Save weekly schedule
  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Toggle day enabled
  const toggleDay = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d))
    );
  };

  // Update hours
  const updateHours = (dayOfWeek: number, field: "startHour" | "endHour", value: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  // Block/unblock a specific date
  const toggleDateOverride = async (date: Date) => {
    const existing = overrides.find((o) => isSameDay(new Date(o.date), date));

    if (existing) {
      // Remove override
      await fetch(`/api/availability/overrides?id=${existing.id}`, { method: "DELETE" });
      setOverrides((prev) => prev.filter((o) => o.id !== existing.id));
    } else {
      // Block this date
      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date.toISOString(),
          available: false,
          reason: overrideReason || "Blocked",
        }),
      });
      const data = await res.json();
      setOverrides((prev) => [...prev, data]);
    }
    setSelectedDate(null);
    setOverrideReason("");
  };

  // Save timezone
  const handleTimezoneChange = async (tz: string) => {
    setTimezone(tz);
    setTzSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
    setTzSaving(false);
  };

  // Save duration
  const handleDurationChange = async (dur: number) => {
    setDuration(dur);
    setDurSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultDuration: dur }),
    }).catch(() => {});
    setDurSaving(false);
  };

  // Connect Google Calendar via OAuth
  const handleConnectGoogleCalendar = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google-calendar", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // ignore
    } finally {
      setGcalLoading(false);
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectGoogleCalendar = async () => {
    setGcalLoading(true);
    try {
      await fetch("/api/google-calendar", { method: "DELETE" });
      setGcalConnected(false);
      setGcalEmail(null);
    } catch {
      // ignore
    } finally {
      setGcalLoading(false);
    }
  };

  // Calendar rendering
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0-6

  // Check if a date is available based on schedule + overrides
  const isDateAvailable = (date: Date) => {
    const override = overrides.find((o) => isSameDay(new Date(o.date), date));
    if (override) return override.available;
    const daySchedule = schedule.find((s) => s.dayOfWeek === getDay(date));
    return daySchedule?.enabled ?? false;
  };

  const getOverride = (date: Date) =>
    overrides.find((o) => isSameDay(new Date(o.date), date));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#1a2b3c]">Calendar & Availability</h1>
          <p className="text-xs text-[#8a95a3]">Set your weekly schedule and block specific dates</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5">
            <Timer className="h-3.5 w-3.5 text-[#0090d9]" />
            <select
              value={duration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              className="bg-transparent text-xs font-medium text-[#1a2b3c] focus:outline-none cursor-pointer"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
            {durSaving && <Loader2 className="h-3 w-3 animate-spin text-[#0090d9]" />}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5">
            <Globe className="h-3.5 w-3.5 text-[#0090d9]" />
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#1a2b3c] focus:outline-none cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            {tzSaving && <Loader2 className="h-3 w-3 animate-spin text-[#0090d9]" />}
          </div>
        </div>
      </div>

      {/* Google Calendar Connection */}
      <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              gcalConnected ? "bg-emerald-50" : "bg-[#f5f7fa]"
            )}>
              <Image src="/google-calendar.svg" alt="Google Calendar" width={20} height={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1a2b3c]">Google Calendar</h3>
              {gcalConnected ? (
                <p className="text-xs text-emerald-600">
                  Connected{gcalEmail ? ` — ${gcalEmail}` : ""}
                </p>
              ) : (
                <p className="text-xs text-[#8a95a3]">
                  Sync your calendar to auto-detect busy times
                </p>
              )}
            </div>
          </div>
          <div>
            {gcalConnected ? (
              <button
                onClick={handleDisconnectGoogleCalendar}
                disabled={gcalLoading}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                {gcalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                Disconnect
              </button>
            ) : gcalOauthAvailable ? (
              <button
                onClick={handleConnectGoogleCalendar}
                disabled={gcalLoading}
                className="flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#007bc0] transition-colors"
              >
                {gcalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                Connect
              </button>
            ) : (
              <span className="text-[10px] text-[#b0b7c0]">OAuth not configured</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Weekly Schedule */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0090d9]" />
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Weekly Schedule</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                saved
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-[#0090d9] text-white hover:bg-[#007bc0]"
              )}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : saved ? (
                <Check className="h-3 w-3" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          <div className="space-y-2">
            {schedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  day.enabled
                    ? "border-[#e2e8f0] bg-white"
                    : "border-[#f0f0f0] bg-[#fafafa]"
                )}
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleDay(day.dayOfWeek)}
                  className={cn(
                    "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                    day.enabled ? "bg-[#0090d9]" : "bg-[#d1d5db]"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow transition-transform",
                      day.enabled && "translate-x-4"
                    )}
                  />
                </button>

                {/* Day name */}
                <span
                  className={cn(
                    "w-24 text-sm font-medium",
                    day.enabled ? "text-[#1a2b3c]" : "text-[#b0b7c0]"
                  )}
                >
                  {DAY_NAMES[day.dayOfWeek]}
                </span>

                {/* Hours */}
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <HourSelect
                      value={day.startHour}
                      onChange={(v) => updateHours(day.dayOfWeek, "startHour", v)}
                      label="From"
                    />
                    <span className="text-[#b0b7c0]">-</span>
                    <HourSelect
                      value={day.endHour}
                      onChange={(v) => updateHours(day.dayOfWeek, "endHour", v)}
                      label="To"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-[#b0b7c0]">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Monthly Calendar with overrides */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="rounded-lg p-1 text-[#8a95a3] hover:bg-[#f5f7fa] hover:text-[#1a2b3c]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-semibold text-[#1a2b3c]">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="rounded-lg p-1 text-[#8a95a3] hover:bg-[#f5f7fa] hover:text-[#1a2b3c]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_SHORT.map((d) => (
              <span key={d} className="py-1 text-[10px] font-semibold uppercase text-[#8a95a3]">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Pad start */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {days.map((date) => {
              const available = isDateAvailable(date);
              const override = getOverride(date);
              const today = isToday(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(isSelected ? null : date)}
                  className={cn(
                    "relative flex h-10 w-full items-center justify-center rounded-lg text-xs font-medium transition-all",
                    today && "ring-1 ring-[#0090d9]",
                    isSelected && "ring-2 ring-[#0090d9]",
                    available && !override
                      ? "bg-[#e8f4fd] text-[#0090d9] hover:bg-[#d0ebfa]"
                      : override && !override.available
                        ? "bg-red-50 text-red-400 hover:bg-red-100"
                        : !available
                          ? "bg-[#f5f7fa] text-[#b0b7c0] hover:bg-[#edf0f4]"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  )}
                >
                  {format(date, "d")}
                  {override && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[#8a95a3]">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded bg-[#e8f4fd]" />
              Available
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded bg-[#f5f7fa]" />
              Unavailable
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded bg-red-50 ring-1 ring-red-200" />
              Blocked
            </div>
          </div>

          {/* Selected date actions */}
          {selectedDate && isSameMonth(selectedDate, currentMonth) && (
            <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f5f7fa] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1a2b3c]">
                  {format(selectedDate, "EEEE, MMM d")}
                </span>
                <button onClick={() => setSelectedDate(null)}>
                  <X className="h-3.5 w-3.5 text-[#8a95a3]" />
                </button>
              </div>

              {getOverride(selectedDate) ? (
                <div>
                  <p className="mb-2 text-[11px] text-[#8a95a3]">
                    This date is blocked{getOverride(selectedDate)?.reason ? `: ${getOverride(selectedDate)!.reason}` : ""}
                  </p>
                  <button
                    onClick={() => toggleDateOverride(selectedDate)}
                    className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
                  >
                    <Check className="h-3 w-3" />
                    Unblock Date
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="mb-2 w-full rounded-md border border-[#e2e8f0] px-2 py-1 text-xs focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
                  />
                  <button
                    onClick={() => toggleDateOverride(selectedDate)}
                    className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                  >
                    <Ban className="h-3 w-3" />
                    Block Date
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
