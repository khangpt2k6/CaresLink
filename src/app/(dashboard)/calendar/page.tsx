"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, Clock, Save, Loader2, X,
  Ban, Check, Globe, Timer, Link2, Unlink,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Grid config: 7 AM -> 9 PM, 30-min slots
const GRID_START = 7;
const GRID_END = 21;
const SLOT_MINS = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINS;
const TOTAL_SLOTS = (GRID_END - GRID_START) * SLOTS_PER_HOUR; // 28

// Mon first
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
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

function formatSlotTime(slotIndex: number): string {
  const totalMins = GRID_START * 60 + slotIndex * SLOT_MINS;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")}`;
}

const VIDEO_PLATFORMS = [
  { value: "jitsi", label: "Jitsi Meet (Free)", src: "/jitsi.png" },
  { value: "zoom", label: "Zoom", src: "/zoom.webp" },
  { value: "google_meet", label: "Google Meet", src: "/google-meet.webp" },
  { value: "ms_teams", label: "Microsoft Teams", src: "/teams.webp" },
];

const VIDEO_PLATFORM_ICONS: Record<string, { src: string; alt: string }> = {
  jitsi: { src: "/jitsi.png", alt: "Jitsi Meet" },
  zoom: { src: "/zoom.webp", alt: "Zoom" },
  google_meet: { src: "/google-meet.webp", alt: "Google Meet" },
  ms_teams: { src: "/teams.webp", alt: "Microsoft Teams" },
};

function formatHourLabel(slotIndex: number): string {
  const totalMins = GRID_START * 60 + slotIndex * SLOT_MINS;
  const h = Math.floor(totalMins / 60);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}

// slotGrid[dayIndex 0-6][slotIndex 0-27]  (dayIndex: 0=Mon...6=Sun)
function scheduleToGrid(schedule: AvailabilityDay[]): boolean[][] {
  const grid = Array.from({ length: 7 }, () => Array(TOTAL_SLOTS).fill(false));
  schedule.forEach((day) => {
    if (!day.enabled) return;
    const dIdx = DAYS_ORDER.indexOf(day.dayOfWeek);
    if (dIdx === -1) return;
    for (let s = 0; s < TOTAL_SLOTS; s++) {
      const slotHour = GRID_START + s / SLOTS_PER_HOUR;
      if (slotHour >= day.startHour && slotHour < day.endHour) {
        grid[dIdx][s] = true;
      }
    }
  });
  return grid;
}

function gridToSchedule(schedule: AvailabilityDay[], slotGrid: boolean[][]): AvailabilityDay[] {
  return schedule.map((day) => {
    const dIdx = DAYS_ORDER.indexOf(day.dayOfWeek);
    if (dIdx === -1) return day;
    const slots = slotGrid[dIdx];
    const first = slots.findIndex(Boolean);
    const reversedFirst = [...slots].reverse().findIndex(Boolean);
    const last = reversedFirst === -1 ? -1 : TOTAL_SLOTS - 1 - reversedFirst;
    if (first === -1) return { ...day, enabled: false, startHour: 9, endHour: 17 };
    return {
      ...day,
      enabled: true,
      startHour: GRID_START + first / SLOTS_PER_HOUR,
      endHour: GRID_START + (last + 1) / SLOTS_PER_HOUR,
    };
  });
}

export default function CalendarPage() {
  const [schedule, setSchedule] = useState<AvailabilityDay[]>([]);
  const [slotGrid, setSlotGrid] = useState<boolean[][]>(
    () => Array.from({ length: 7 }, () => Array(TOTAL_SLOTS).fill(false))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(true);

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
  const [videoPlatform, setVideoPlatform] = useState("jitsi");
  const [videoLink, setVideoLink] = useState("");
  const [videoSaving, setVideoSaving] = useState(false);

  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalOauthAvailable, setGcalOauthAvailable] = useState(false);

  const [videoDropdownOpen, setVideoDropdownOpen] = useState(false);
  const videoDropdownRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/google-calendar").then((r) => r.json()),
    ])
      .then(([scheduleData, settings, gcal]) => {
        setSchedule(scheduleData);
        setSlotGrid(scheduleToGrid(scheduleData));
        if (settings?.timezone) setTimezone(settings.timezone);
        if (settings?.defaultDuration) setDuration(settings.defaultDuration);
        if (settings?.videoPlatform) setVideoPlatform(settings.videoPlatform);
        if (settings?.videoLink) setVideoLink(settings.videoLink);
        setGcalConnected(gcal?.connected || false);
        setGcalEmail(gcal?.email || null);
        setGcalOauthAvailable(gcal?.oauthAvailable || false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Google Calendar OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalResult = params.get("gcal");
    if (gcalResult === "connected") {
      setGcalConnected(true);
      fetch("/api/google-calendar")
        .then((r) => r.json())
        .then((gcal) => setGcalEmail(gcal?.email || null));
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gcalResult === "error") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch overrides for current month
  const fetchOverrides = useCallback(async (month: Date) => {
    const monthStr = format(month, "yyyy-MM");
    const res = await fetch(`/api/availability/overrides?month=${monthStr}`);
    setOverrides(await res.json());
  }, []);

  useEffect(() => {
    fetchOverrides(currentMonth);
  }, [currentMonth, fetchOverrides]);

  // Close video dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (videoDropdownRef.current && !videoDropdownRef.current.contains(e.target as Node)) {
        setVideoDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global mouseup to end drag
  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // Slot interaction
  const handleSlotMouseDown = (dIdx: number, sIdx: number) => {
    const newVal = !slotGrid[dIdx][sIdx];
    setDragValue(newVal);
    setIsDragging(true);
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      g[dIdx][sIdx] = newVal;
      return g;
    });
  };

  const handleSlotMouseEnter = (dIdx: number, sIdx: number) => {
    if (!isDragging) return;
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      g[dIdx][sIdx] = dragValue;
      return g;
    });
  };

  // Save schedule
  const handleSave = async () => {
    setSaving(true);
    try {
      const newSchedule = gridToSchedule(schedule, slotGrid);
      await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      setSchedule(newSchedule);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Settings
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

  const handleVideoPlatformChange = async (platform: string) => {
    setVideoPlatform(platform);
    setVideoSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPlatform: platform }),
    }).catch(() => {});
    setVideoSaving(false);
  };

  const handleVideoLinkSave = async () => {
    setVideoSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoLink }),
    }).catch(() => {});
    setVideoSaving(false);
  };

  // Google Calendar
  const handleConnectGoogleCalendar = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google-calendar", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setGcalLoading(false);
    }
  };

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

  // Date override
  const toggleDateOverride = async (date: Date) => {
    const existing = overrides.find((o) => isSameDay(new Date(o.date), date));
    if (existing) {
      await fetch(`/api/availability/overrides?id=${existing.id}`, { method: "DELETE" });
      setOverrides((prev) => prev.filter((o) => o.id !== existing.id));
    } else {
      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: date.toISOString(), available: false, reason: overrideReason || "Blocked" }),
      });
      const data = await res.json();
      setOverrides((prev) => [...prev, data]);
    }
    setSelectedDate(null);
    setOverrideReason("");
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const isDateAvailable = (date: Date) => {
    const override = overrides.find((o) => isSameDay(new Date(o.date), date));
    if (override) return override.available;
    const daySchedule = schedule.find((s) => s.dayOfWeek === getDay(date));
    return daySchedule?.enabled ?? false;
  };

  const getOverride = (date: Date) =>
    overrides.find((o) => isSameDay(new Date(o.date), date));

  // Check if a slot is the start of a contiguous block
  const isBlockStart = (dIdx: number, sIdx: number) => {
    if (!slotGrid[dIdx]?.[sIdx]) return false;
    if (sIdx === 0) return true;
    return !slotGrid[dIdx]?.[sIdx - 1];
  };

  // Check if a slot is the end of a contiguous block
  const isBlockEnd = (dIdx: number, sIdx: number) => {
    if (!slotGrid[dIdx]?.[sIdx]) return false;
    if (sIdx === TOTAL_SLOTS - 1) return true;
    return !slotGrid[dIdx]?.[sIdx + 1];
  };

  // Get block info for labeling
  const getBlockLabel = (dIdx: number, sIdx: number) => {
    if (!isBlockStart(dIdx, sIdx)) return null;
    let end = sIdx;
    while (end < TOTAL_SLOTS - 1 && slotGrid[dIdx]?.[end + 1]) end++;
    const startTime = formatSlotTime(sIdx);
    const endTime = formatSlotTime(end + 1);
    const slotCount = end - sIdx + 1;
    return { startTime, endTime, slotCount };
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a2b3c]">Calendar & Availability</h1>
            <p className="text-sm text-[#8a95a3] mt-0.5">Manage your weekly schedule, block dates, and configure meeting settings</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-sm",
              saved
                ? "bg-emerald-500 text-white shadow-emerald-200"
                : "bg-[#0090d9] text-white hover:bg-[#007bc0] shadow-blue-200 hover:shadow-md"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {/* Settings bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm">
            <Timer className="h-4 w-4 text-[#0090d9]" />
            <select
              value={duration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-[#1a2b3c] focus:outline-none cursor-pointer"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
            {durSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0090d9]" />}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm">
            <Globe className="h-4 w-4 text-[#0090d9]" />
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-[#1a2b3c] focus:outline-none cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            {tzSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0090d9]" />}
          </div>
          <div className="relative" ref={videoDropdownRef}>
            <button
              onClick={() => setVideoDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm hover:border-[#c8d0da] transition-colors"
            >
              <Image
                src={VIDEO_PLATFORM_ICONS[videoPlatform]?.src || "/jitsi.png"}
                alt={VIDEO_PLATFORM_ICONS[videoPlatform]?.alt || "Video"}
                width={20}
                height={20}
                className="rounded-sm"
              />
              <span className="text-sm font-medium text-[#1a2b3c]">
                {VIDEO_PLATFORMS.find((p) => p.value === videoPlatform)?.label || "Select"}
              </span>
              {videoSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0090d9]" />
              ) : (
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#8a95a3] transition-transform", videoDropdownOpen && "rotate-180")} />
              )}
            </button>

            {videoDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xl border border-[#e2e8f0] bg-white shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="py-1.5">
                  {VIDEO_PLATFORMS.map((platform) => {
                    const isActive = videoPlatform === platform.value;
                    return (
                      <button
                        key={platform.value}
                        onClick={() => {
                          handleVideoPlatformChange(platform.value);
                          setVideoDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-[#f0f7ff]"
                            : "hover:bg-[#f8fafc]"
                        )}
                      >
                        <Image
                          src={platform.src}
                          alt={platform.label}
                          width={24}
                          height={24}
                          className="rounded-md"
                        />
                        <span className={cn(
                          "text-sm font-medium",
                          isActive ? "text-[#0090d9]" : "text-[#1a2b3c]"
                        )}>
                          {platform.label}
                        </span>
                        {isActive && (
                          <Check className="h-4 w-4 text-[#0090d9] ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Google Calendar connect/disconnect */}
          {gcalConnected ? (
            <button
              onClick={handleDisconnectGoogleCalendar}
              disabled={gcalLoading}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 shadow-sm ml-auto hover:bg-red-50 hover:border-red-200 transition-colors group"
            >
              <Image src="/google-calendar.svg" alt="Google Calendar" width={18} height={18} />
              <span className="text-xs font-medium text-emerald-600 group-hover:hidden">Connected</span>
              <span className="text-xs font-medium text-red-500 hidden group-hover:inline">Disconnect</span>
              {gcalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8a95a3]" /> : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500 group-hover:hidden" />
                  <Unlink className="h-3.5 w-3.5 text-red-400 hidden group-hover:block" />
                </>
              )}
            </button>
          ) : gcalOauthAvailable ? (
            <button
              onClick={handleConnectGoogleCalendar}
              disabled={gcalLoading}
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 shadow-sm ml-auto hover:bg-[#f0f8ff] hover:border-[#0090d9]/30 transition-colors"
            >
              <Image src="/google-calendar.svg" alt="Google Calendar" width={18} height={18} />
              <span className="text-xs font-medium text-[#0090d9]">Connect Calendar</span>
              {gcalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0090d9]" /> : <Link2 className="h-3.5 w-3.5 text-[#0090d9]" />}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 shadow-sm ml-auto">
              <Image src="/google-calendar.svg" alt="Google Calendar" width={18} height={18} />
              <span className="text-xs text-[#b0b7c0]">Not configured</span>
            </div>
          )}
        </div>
      </div>

      {/* Auto-generated Google Meet info */}
      {videoPlatform === "google_meet" && gcalConnected && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <Image src="/google-meet.webp" alt="Google Meet" width={24} height={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Google Meet - Auto-Generated</p>
              <p className="text-xs text-emerald-600">
                A unique Google Meet link will be automatically created for each booking via your connected Google Calendar. No manual link needed.
              </p>
            </div>
            <Check className="h-5 w-5 text-emerald-500 ml-auto flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Custom Video Link */}
      {videoPlatform !== "jitsi" && !(videoPlatform === "google_meet" && gcalConnected) && (
        <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Image
                src={VIDEO_PLATFORM_ICONS[videoPlatform]?.src || "/jitsi.png"}
                alt={VIDEO_PLATFORM_ICONS[videoPlatform]?.alt || "Video"}
                width={24}
                height={24}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1a2b3c] mb-2">
                {videoPlatform === "zoom" ? "Zoom" : videoPlatform === "google_meet" ? "Google Meet" : "Microsoft Teams"} Meeting Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder={
                    videoPlatform === "zoom" ? "https://zoom.us/j/..." :
                    videoPlatform === "google_meet" ? "https://meet.google.com/..." :
                    "https://teams.microsoft.com/l/meetup-join/..."
                  }
                  className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#b0b7c0] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20"
                />
                <button
                  onClick={handleVideoLinkSave}
                  disabled={videoSaving}
                  className="rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#007bc0] transition-colors"
                >
                  {videoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Visual week grid */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          {/* Grid header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0] bg-gradient-to-r from-[#f8fafc] to-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0090d9]/10">
                <Clock className="h-4 w-4 text-[#0090d9]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1a2b3c]">Weekly Schedule</h2>
                <p className="text-[11px] text-[#8a95a3]">Click or drag to set your availability</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#8a95a3]">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] bg-gradient-to-b from-[#0090d9] to-[#0078c0]" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] border border-[#e2e8f0] bg-[#fafbfc]" />
                <span>Unavailable</span>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="select-none">
            {/* Day headers */}
            <div
              className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
              style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
            >
              <div className="border-r border-[#edf0f4]" />
              {DAY_LABELS.map((d, dIdx) => {
                const hasAvail = slotGrid[dIdx]?.some(Boolean);
                return (
                  <div
                    key={d}
                    className={cn(
                      "py-3 text-center border-r border-[#edf0f4] last:border-r-0",
                    )}
                  >
                    <div className={cn(
                      "text-[11px] font-bold tracking-wider",
                      hasAvail ? "text-[#0090d9]" : "text-[#8a95a3]"
                    )}>
                      {d}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            <div className="relative overflow-y-auto max-h-[560px]">
              {Array.from({ length: TOTAL_SLOTS }, (_, sIdx) => {
                const isHourStart = sIdx % SLOTS_PER_HOUR === 0;
                return (
                  <div
                    key={sIdx}
                    className="grid"
                    style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
                  >
                    {/* Time label */}
                    <div className={cn(
                      "flex h-[24px] items-center justify-end pr-3 border-r border-[#edf0f4]",
                      isHourStart && "border-t border-[#e2e8f0]"
                    )}>
                      {isHourStart && (
                        <span className="text-[10px] font-medium text-[#8a95a3] leading-none -translate-y-[1px]">
                          {formatHourLabel(sIdx)}
                        </span>
                      )}
                    </div>

                    {/* Day cells */}
                    {Array.from({ length: 7 }, (_, dIdx) => {
                      const active = slotGrid[dIdx]?.[sIdx] ?? false;
                      const blockStart = isBlockStart(dIdx, sIdx);
                      const blockEnd = isBlockEnd(dIdx, sIdx);
                      const label = blockStart ? getBlockLabel(dIdx, sIdx) : null;

                      return (
                        <div
                          key={dIdx}
                          className={cn(
                            "h-[24px] cursor-pointer border-r border-[#f0f2f5] last:border-r-0 relative group",
                            isHourStart && !active && "border-t border-[#edf0f4]",
                            isHourStart && active && "border-t border-[#0078c0]/30",
                            active
                              ? cn(
                                  "bg-gradient-to-r from-[#0090d9] to-[#00a1f0]",
                                  blockStart && "rounded-t-[4px]",
                                  blockEnd && "rounded-b-[4px]",
                                )
                              : "bg-white hover:bg-[#f0f7ff]",
                            !active && !isHourStart && "border-t border-[#f5f7fa]",
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSlotMouseDown(dIdx, sIdx);
                          }}
                          onMouseEnter={() => handleSlotMouseEnter(dIdx, sIdx)}
                        >
                          {/* Block label on the first slot */}
                          {label && label.slotCount >= 2 && (
                            <div className="absolute inset-x-0 top-[2px] flex justify-center pointer-events-none z-10">
                              <span className="text-[9px] font-semibold text-white/90 drop-shadow-sm truncate px-1">
                                {label.startTime} - {label.endTime}
                              </span>
                            </div>
                          )}
                          {/* Hover tooltip for empty slots */}
                          {!active && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0090d9]/30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Monthly Calendar */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-lg p-1.5 text-[#8a95a3] hover:bg-[#f5f7fa] hover:text-[#1a2b3c] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold text-[#1a2b3c]">
                {format(currentMonth, "MMMM yyyy")}
              </h3>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-lg p-1.5 text-[#8a95a3] hover:bg-[#f5f7fa] hover:text-[#1a2b3c] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 text-center">
              {DAY_SHORT.map((d) => (
                <span key={d} className="py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8a95a3]">{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
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
                      "relative flex h-10 w-full items-center justify-center rounded-xl text-xs font-semibold transition-all",
                      today && "ring-2 ring-[#0090d9] ring-offset-1",
                      isSelected && "ring-2 ring-[#0090d9] scale-110 shadow-md",
                      available && !override
                        ? "bg-gradient-to-b from-[#e8f4fd] to-[#d4ecfa] text-[#0078c0] hover:from-[#d4ecfa] hover:to-[#c0e2f7]"
                        : override && !override.available
                          ? "bg-gradient-to-b from-red-50 to-red-100 text-red-500 hover:from-red-100 hover:to-red-150"
                          : !available
                            ? "bg-[#f5f7fa] text-[#b0b7c0] hover:bg-[#edf0f4] hover:text-[#8a95a3]"
                            : "bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-600 hover:from-emerald-100 hover:to-emerald-150"
                    )}
                  >
                    {format(date, "d")}
                    {override && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[#8a95a3]">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] bg-gradient-to-b from-[#e8f4fd] to-[#d4ecfa]" />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] bg-[#f5f7fa]" />
                Unavailable
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] bg-gradient-to-b from-red-50 to-red-100 ring-1 ring-red-200" />
                Blocked
              </div>
            </div>

            {selectedDate && isSameMonth(selectedDate, currentMonth) && (
              <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-gradient-to-b from-[#f8fafc] to-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1a2b3c]">
                    {format(selectedDate, "EEEE, MMM d")}
                  </span>
                  <button onClick={() => setSelectedDate(null)} className="rounded-lg p-1 hover:bg-[#f5f7fa]">
                    <X className="h-4 w-4 text-[#8a95a3]" />
                  </button>
                </div>
                {getOverride(selectedDate) ? (
                  <div>
                    <p className="mb-3 text-xs text-[#8a95a3]">
                      This date is blocked{getOverride(selectedDate)?.reason ? `: ${getOverride(selectedDate)!.reason}` : ""}
                    </p>
                    <button
                      onClick={() => toggleDateOverride(selectedDate)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
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
                      className="mb-3 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20"
                    />
                    <button
                      onClick={() => toggleDateOverride(selectedDate)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Block This Date
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#1a2b3c] mb-3">Schedule Summary</h3>
            <div className="space-y-2">
              {DAY_LABELS.map((d, dIdx) => {
                const slots = slotGrid[dIdx];
                const activeCount = slots?.filter(Boolean).length ?? 0;
                const hours = (activeCount * SLOT_MINS) / 60;
                const first = slots?.findIndex(Boolean) ?? -1;
                const reversedFirst = slots ? [...slots].reverse().findIndex(Boolean) : -1;
                const last = reversedFirst === -1 ? -1 : TOTAL_SLOTS - 1 - reversedFirst;
                return (
                  <div key={d} className="flex items-center gap-3">
                    <span className={cn(
                      "text-[11px] font-bold w-8",
                      activeCount > 0 ? "text-[#0090d9]" : "text-[#c8cdd4]"
                    )}>
                      {d.slice(0, 3)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[#f0f2f5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0090d9] to-[#00a1f0] transition-all duration-300"
                        style={{ width: `${(activeCount / TOTAL_SLOTS) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#8a95a3] w-24 text-right">
                      {activeCount > 0 ? (
                        <>{formatSlotTime(first)} - {formatSlotTime(last + 1)}</>
                      ) : (
                        <span className="text-[#c8cdd4]">Unavailable</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#f0f2f5]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#8a95a3]">Total weekly hours</span>
                <span className="text-sm font-bold text-[#0090d9]">
                  {((slotGrid.flat().filter(Boolean).length * SLOT_MINS) / 60).toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
