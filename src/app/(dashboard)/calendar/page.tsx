"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight,
  Save, Loader2, X, Ban, Check, Globe, Timer, Link2, Unlink,
  Copy, Clock, List, CalendarDays, Plus,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Grid config: 0 AM -> 12 AM (24h), 30-min slots
const GRID_START = 0;
const GRID_END = 24;
const SLOT_MINS = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINS;
const TOTAL_SLOTS = (GRID_END - GRID_START) * SLOTS_PER_HOUR; // 48
const HOUR_HEIGHT = 60;
const SLOT_HEIGHT = HOUR_HEIGHT / 2;

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon first for schedule
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Calendly-style day config
const CALENDLY_DAYS = [
  { dayOfWeek: 0, label: "S", fullLabel: "Sunday", color: "bg-[#f59e0b]" },
  { dayOfWeek: 1, label: "M", fullLabel: "Monday", color: "bg-[#0090d9]" },
  { dayOfWeek: 2, label: "T", fullLabel: "Tuesday", color: "bg-[#0090d9]" },
  { dayOfWeek: 3, label: "W", fullLabel: "Wednesday", color: "bg-[#0090d9]" },
  { dayOfWeek: 4, label: "T", fullLabel: "Thursday", color: "bg-[#0090d9]" },
  { dayOfWeek: 5, label: "F", fullLabel: "Friday", color: "bg-[#0090d9]" },
  { dayOfWeek: 6, label: "S", fullLabel: "Saturday", color: "bg-[#f59e0b]" },
];

// Generate time options at 30-minute intervals (0:00 to 23:30)
function generateTimeOptions(): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = h + m / 60;
      const ampm = h < 12 ? "am" : "pm";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const mStr = m === 0 ? ":00" : `:${m}`;
      options.push({ value, label: `${h12}${mStr}${ampm}` });
    }
  }
  return options;
}
const TIME_OPTIONS = generateTimeOptions();

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)", short: "EST" },
  { value: "America/Chicago", label: "Central Time (CT)", short: "CST" },
  { value: "America/Denver", label: "Mountain Time (MT)", short: "MST" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", short: "PST" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)", short: "AKST" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)", short: "HST" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)", short: "GMT" },
  { value: "Europe/Paris", label: "Central European Time (CET)", short: "CET" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)", short: "JST" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)", short: "CST" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", short: "IST" },
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (ICT)", short: "ICT" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)", short: "AEST" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", short: "UTC" },
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

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatSlotTime(slotIndex: number): string {
  const totalMins = GRID_START * 60 + slotIndex * SLOT_MINS;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h < 12 || h === 24 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
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

// slotGrid[dayIndex 0-6][slotIndex 0-47]  (dayIndex: 0=Mon...6=Sun)
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

// Get current time position as percentage of 24h
function getCurrentTimePosition(): { percent: number; hours: number; minutes: number } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const percent = (totalMinutes / (24 * 60)) * 100;
  return { percent, hours, minutes };
}

export default function CalendarPage() {
  const [schedule, setSchedule] = useState<AvailabilityDay[]>([]);
  const [slotGrid, setSlotGrid] = useState<boolean[][]>(
    () => Array.from({ length: 7 }, () => Array(TOTAL_SLOTS).fill(false))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(true);

  // Multi-slot support: additional time ranges per day (beyond the primary one)
  const [extraSlots, setExtraSlots] = useState<Record<number, { startHour: number; endHour: number }[]>>({});

  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
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
  const [gcalOauthConnected, setGcalOauthConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalOauthAvailable, setGcalOauthAvailable] = useState(false);

  const [mscalConnected, setMscalConnected] = useState(false);
  const [mscalEmail, setMscalEmail] = useState<string | null>(null);
  const [mscalLoading, setMscalLoading] = useState(false);
  const [mscalOauthAvailable, setMscalOauthAvailable] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [videoDropdownOpen, setVideoDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const videoDropdownRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(getCurrentTimePosition());

  // Week days for the calendar view
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Current time ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimePosition());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to ~8 AM on mount
  useEffect(() => {
    if (gridContainerRef.current && !loading) {
      gridContainerRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, [loading]);

  // Timezone short label
  const tzShort = TIMEZONES.find((tz) => tz.value === timezone)?.short || "EST";

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/google-calendar").then((r) => r.json()),
      fetch("/api/microsoft-calendar").then((r) => r.json()).catch(() => ({ connected: false, oauthAvailable: false })),
    ])
      .then(([scheduleData, settings, gcal, mscal]) => {
        setSchedule(scheduleData);
        setSlotGrid(scheduleToGrid(scheduleData));
        if (settings?.timezone) setTimezone(settings.timezone);
        if (settings?.defaultDuration) setDuration(settings.defaultDuration);
        if (settings?.videoPlatform) setVideoPlatform(settings.videoPlatform);
        if (settings?.videoLink) setVideoLink(settings.videoLink);
        setGcalConnected(gcal?.connected || false);
        setGcalOauthConnected(gcal?.oauthConnected || false);
        setGcalEmail(gcal?.email || null);
        setGcalOauthAvailable(gcal?.oauthAvailable || false);
        setMscalConnected(mscal?.connected || false);
        setMscalEmail(mscal?.email || null);
        setMscalOauthAvailable(mscal?.oauthAvailable || false);
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
      setGcalOauthConnected(true);
      fetch("/api/google-calendar")
        .then((r) => r.json())
        .then((gcal) => {
          setGcalEmail(gcal?.email || null);
          setGcalOauthConnected(gcal?.oauthConnected || false);
        });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gcalResult === "error") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Microsoft Calendar OAuth redirect
    const mscalResult = params.get("mscal");
    if (mscalResult === "connected") {
      setMscalConnected(true);
      fetch("/api/microsoft-calendar")
        .then((r) => r.json())
        .then((mscal) => {
          setMscalEmail(mscal?.email || null);
          setMscalConnected(mscal?.connected || false);
        });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (mscalResult === "error") {
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

  // Sync mini calendar month when week changes
  useEffect(() => {
    const midWeek = addDays(currentWeekStart, 3);
    if (!isSameMonth(midWeek, currentMonth)) {
      setCurrentMonth(startOfMonth(midWeek));
    }
  }, [currentWeekStart, currentMonth]);

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

  // MouseMove during drag: capture fast movements that skip over cells (mouseenter misses them)
  // IMPORTANT: Display columns are Sun,Mon,Tue... but slotGrid uses Mon=0,Tue=1...Sun=6
  useEffect(() => {
    if (!isDragging) return;
    const grid = gridContainerRef.current;
    if (!grid) return;

    const handleMove = (e: MouseEvent) => {
      const rect = grid.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top + grid.scrollTop;
      if (relY < 0 || relY >= TOTAL_SLOTS * SLOT_HEIGHT || relX < 60) return;

      const dayColWidth = (rect.width - 60) / 7;
      if (relX >= rect.width) return;

      const colIndex = Math.min(6, Math.max(0, Math.floor((relX - 60) / dayColWidth)));
      const dIdx = DAYS_ORDER.indexOf(getDay(weekDays[colIndex]));
      const sIdx = Math.min(TOTAL_SLOTS - 1, Math.max(0, Math.floor(relY / SLOT_HEIGHT)));

      setSlotGrid((prev) => {
        if (prev[dIdx]?.[sIdx] === dragValue) return prev;
        const g = prev.map((row) => [...row]);
        g[dIdx][sIdx] = dragValue;
        return g;
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [isDragging, dragValue, weekDays]);

  // Map a calendar date to its slotGrid day index (0=Mon...6=Sun)
  const dateToDayIndex = (date: Date): number => {
    const jsDay = getDay(date); // 0=Sun
    return DAYS_ORDER.indexOf(jsDay);
  };

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

  const handleConnectMicrosoftCalendar = async () => {
    setMscalLoading(true);
    try {
      const res = await fetch("/api/microsoft-calendar", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setMscalLoading(false);
    }
  };

  const handleDisconnectMicrosoftCalendar = async () => {
    setMscalLoading(true);
    try {
      await fetch("/api/microsoft-calendar", { method: "DELETE" });
      setMscalConnected(false);
      setMscalEmail(null);
    } catch {
      // ignore
    } finally {
      setMscalLoading(false);
    }
  };

  // Calendly-style: update a day's hours
  const handleDayTimeChange = (dayOfWeek: number, field: "startHour" | "endHour", value: number) => {
    const dIdx = DAYS_ORDER.indexOf(dayOfWeek);
    if (dIdx === -1) return;
    const daySchedule = schedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySchedule) return;

    const newStart = field === "startHour" ? value : daySchedule.startHour;
    const newEnd = field === "endHour" ? value : daySchedule.endHour;

    // Update slotGrid
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      for (let s = 0; s < TOTAL_SLOTS; s++) {
        const slotHour = GRID_START + s / SLOTS_PER_HOUR;
        g[dIdx][s] = slotHour >= newStart && slotHour < newEnd;
      }
      return g;
    });

    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, startHour: newStart, endHour: newEnd, enabled: true } : d
      )
    );
  };

  const handleDayToggle = (dayOfWeek: number) => {
    const dIdx = DAYS_ORDER.indexOf(dayOfWeek);
    if (dIdx === -1) return;
    const daySchedule = schedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySchedule) return;
    const newEnabled = !daySchedule.enabled;

    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      if (!newEnabled) {
        g[dIdx] = Array(TOTAL_SLOTS).fill(false);
      } else {
        for (let s = 0; s < TOTAL_SLOTS; s++) {
          const slotHour = GRID_START + s / SLOTS_PER_HOUR;
          g[dIdx][s] = slotHour >= daySchedule.startHour && slotHour < daySchedule.endHour;
        }
      }
      return g;
    });

    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, enabled: newEnabled } : d
      )
    );

    // Clear extra slots when disabling
    if (!newEnabled) {
      setExtraSlots((prev) => {
        const next = { ...prev };
        delete next[dayOfWeek];
        return next;
      });
    }
  };

  // Add a new time slot to a day
  const handleAddSlot = (dayOfWeek: number) => {
    const dIdx = DAYS_ORDER.indexOf(dayOfWeek);
    if (dIdx === -1) return;
    const daySchedule = schedule.find((s) => s.dayOfWeek === dayOfWeek);

    // If day is disabled, enable it with default 9-5
    if (!daySchedule?.enabled) {
      setSchedule((prev) =>
        prev.map((d) =>
          d.dayOfWeek === dayOfWeek ? { ...d, enabled: true, startHour: 9, endHour: 17 } : d
        )
      );
      setSlotGrid((prev) => {
        const g = prev.map((row) => [...row]);
        for (let s = 0; s < TOTAL_SLOTS; s++) {
          const slotHour = GRID_START + s / SLOTS_PER_HOUR;
          g[dIdx][s] = slotHour >= 9 && slotHour < 17;
        }
        return g;
      });
      return;
    }

    // Find the latest end hour across all slots for this day
    const existing = extraSlots[dayOfWeek] || [];
    const allEnds = [daySchedule.endHour, ...existing.map((s) => s.endHour)];
    const latestEnd = Math.max(...allEnds);
    const newStart = latestEnd + 1;
    const newEnd = newStart + 1;
    if (newStart >= 24) return;

    const clampedEnd = Math.min(24, newEnd);

    setExtraSlots((prev) => ({
      ...prev,
      [dayOfWeek]: [...(prev[dayOfWeek] || []), { startHour: newStart, endHour: clampedEnd }],
    }));

    // Update slotGrid
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      for (let s = 0; s < TOTAL_SLOTS; s++) {
        const slotHour = GRID_START + s / SLOTS_PER_HOUR;
        if (slotHour >= newStart && slotHour < clampedEnd) {
          g[dIdx][s] = true;
        }
      }
      return g;
    });
  };

  // Remove an extra slot
  const handleRemoveExtraSlot = (dayOfWeek: number, slotIndex: number) => {
    const dIdx = DAYS_ORDER.indexOf(dayOfWeek);
    if (dIdx === -1) return;
    const slot = extraSlots[dayOfWeek]?.[slotIndex];
    if (!slot) return;

    setExtraSlots((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).filter((_, i) => i !== slotIndex),
    }));

    // Remove from slotGrid
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      for (let s = 0; s < TOTAL_SLOTS; s++) {
        const slotHour = GRID_START + s / SLOTS_PER_HOUR;
        if (slotHour >= slot.startHour && slotHour < slot.endHour) {
          g[dIdx][s] = false;
        }
      }
      return g;
    });
  };

  // Update an extra slot's time
  const handleExtraSlotTimeChange = (dayOfWeek: number, slotIndex: number, field: "startHour" | "endHour", value: number) => {
    const dIdx = DAYS_ORDER.indexOf(dayOfWeek);
    if (dIdx === -1) return;
    const slot = extraSlots[dayOfWeek]?.[slotIndex];
    if (!slot) return;

    const oldStart = slot.startHour;
    const oldEnd = slot.endHour;
    const newStart = field === "startHour" ? value : oldStart;
    const newEnd = field === "endHour" ? value : oldEnd;

    setExtraSlots((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).map((s, i) =>
        i === slotIndex ? { startHour: newStart, endHour: newEnd } : s
      ),
    }));

    // Update slotGrid: clear old range, set new range
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      for (let s = 0; s < TOTAL_SLOTS; s++) {
        const slotHour = GRID_START + s / SLOTS_PER_HOUR;
        if (slotHour >= oldStart && slotHour < oldEnd) {
          g[dIdx][s] = false;
        }
      }
      for (let s = 0; s < TOTAL_SLOTS; s++) {
        const slotHour = GRID_START + s / SLOTS_PER_HOUR;
        if (slotHour >= newStart && slotHour < newEnd) {
          g[dIdx][s] = true;
        }
      }
      return g;
    });
  };

  const handleCopyToAll = (sourceDayOfWeek: number) => {
    const source = schedule.find((s) => s.dayOfWeek === sourceDayOfWeek);
    if (!source || !source.enabled) return;

    setSchedule((prev) =>
      prev.map((d) => ({ ...d, startHour: source.startHour, endHour: source.endHour, enabled: true }))
    );
    setSlotGrid((prev) => {
      const g = prev.map((row) => [...row]);
      for (let dIdx = 0; dIdx < 7; dIdx++) {
        for (let s = 0; s < TOTAL_SLOTS; s++) {
          const slotHour = GRID_START + s / SLOTS_PER_HOUR;
          g[dIdx][s] = slotHour >= source.startHour && slotHour < source.endHour;
        }
      }
      return g;
    });
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

  // Mini calendar helpers
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

  // Check if date is in current viewed week
  const isInCurrentWeek = (date: Date) => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    return date >= currentWeekStart && date <= weekEnd;
  };

  // Block start/end helpers for availability display
  const isBlockStart = (dIdx: number, sIdx: number) => {
    if (!slotGrid[dIdx]?.[sIdx]) return false;
    if (sIdx === 0) return true;
    return !slotGrid[dIdx]?.[sIdx - 1];
  };

  const isBlockEnd = (dIdx: number, sIdx: number) => {
    if (!slotGrid[dIdx]?.[sIdx]) return false;
    if (sIdx === TOTAL_SLOTS - 1) return true;
    return !slotGrid[dIdx]?.[sIdx + 1];
  };

  const getBlockLabel = (dIdx: number, sIdx: number) => {
    if (!isBlockStart(dIdx, sIdx)) return null;
    let end = sIdx;
    while (end < TOTAL_SLOTS - 1 && slotGrid[dIdx]?.[end + 1]) end++;
    const startTime = formatSlotTime(sIdx);
    const endTime = formatSlotTime(end + 1);
    const slotCount = end - sIdx + 1;
    return { startTime, endTime, slotCount };
  };

  // Seamless blocks overlay (Slashy-style): one div per contiguous block, no gaps
  const availabilityBlocks = useMemo(() => {
    const blocks: { colIndex: number; startSlot: number; slotCount: number; startTime: string; endTime: string }[] = [];
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const slots = slotGrid[dIdx] || [];
      let i = 0;
      while (i < TOTAL_SLOTS) {
        if (!slots[i]) {
          i++;
          continue;
        }
        let end = i;
        while (end < TOTAL_SLOTS && slots[end]) end++;
        const colIndex = weekDays.findIndex((d) => DAYS_ORDER.indexOf(getDay(d)) === dIdx);
        if (colIndex >= 0) {
          blocks.push({
            colIndex,
            startSlot: i,
            slotCount: end - i,
            startTime: formatSlotTime(i),
            endTime: formatSlotTime(end),
          });
        }
        i = end;
      }
    }
    return blocks;
  }, [slotGrid, weekDays]);

  // Navigation
  const goToPrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  // Format current time for display
  const formatCurrentTime = () => {
    const { hours, minutes } = currentTime;
    const ampm = hours < 12 ? "AM" : "PM";
    const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-3 h-screen flex flex-col">
      {/* Top bar: Settings */}
      <div className="mb-2 flex flex-wrap items-center gap-2 relative z-30">
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2">
          <Timer className="h-4 w-4 text-[#6b7280]" />
          <select
            value={duration}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="bg-transparent text-sm text-[#374151] focus:outline-none cursor-pointer"
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
          </select>
          {durSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6b7280]" />}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2">
          <Globe className="h-4 w-4 text-[#6b7280]" />
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="bg-transparent text-sm text-[#374151] focus:outline-none cursor-pointer"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          {tzSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6b7280]" />}
        </div>

        <div className="relative" ref={videoDropdownRef}>
          <button
            onClick={() => setVideoDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 hover:border-[#d1d5db] transition-colors"
          >
            <Image
              src={VIDEO_PLATFORM_ICONS[videoPlatform]?.src || "/jitsi.png"}
              alt={VIDEO_PLATFORM_ICONS[videoPlatform]?.alt || "Video"}
              width={18}
              height={18}
              className="rounded-sm"
            />
            <span className="text-sm text-[#374151]">
              {VIDEO_PLATFORMS.find((p) => p.value === videoPlatform)?.label || "Select"}
            </span>
            {videoSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6b7280]" />
            ) : (
              <ChevronDown className={cn("h-3.5 w-3.5 text-[#9ca3af] transition-transform", videoDropdownOpen && "rotate-180")} />
            )}
          </button>
          {videoDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-60 rounded-lg border border-[#e5e7eb] bg-white shadow-lg z-50 overflow-hidden">
              <div className="py-1">
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
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-[#e0f2fe]" : "hover:bg-gray-50"
                      )}
                    >
                      <Image src={platform.src} alt={platform.label} width={22} height={22} className="rounded" />
                      <span className={cn("text-sm", isActive ? "text-[#0090d9] font-medium" : "text-[#374151]")}>{platform.label}</span>
                      {isActive && <Check className="h-4 w-4 text-[#0090d9] ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Google Meet OAuth connect - shown when Google Meet selected but no OAuth */}
          {videoPlatform === "google_meet" && !gcalOauthConnected && gcalOauthAvailable && (
            <button
              onClick={handleConnectGoogleCalendar}
              disabled={gcalLoading}
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 hover:bg-amber-100 transition-colors"
            >
              <Image src="/google-meet.webp" alt="Google Meet" width={16} height={16} />
              <span className="text-xs font-medium text-amber-700">Connect OAuth for Meet</span>
              {gcalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" /> : <Link2 className="h-3.5 w-3.5 text-amber-600" />}
            </button>
          )}

          {/* Microsoft Calendar connect/disconnect */}
          {mscalConnected ? (
            <button
              onClick={handleDisconnectMicrosoftCalendar}
              disabled={mscalLoading}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors group"
            >
              <Image src="/outlook.svg" alt="Outlook" width={16} height={16} />
              <span className="text-xs font-medium text-emerald-600 group-hover:hidden">Outlook</span>
              <span className="text-xs font-medium text-red-500 hidden group-hover:inline">Disconnect</span>
              {mscalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9ca3af]" /> : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500 group-hover:hidden" />
                  <Unlink className="h-3.5 w-3.5 text-red-400 hidden group-hover:block" />
                </>
              )}
            </button>
          ) : mscalOauthAvailable ? (
            <button
              onClick={handleConnectMicrosoftCalendar}
              disabled={mscalLoading}
              className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 hover:bg-[#e0f2fe] hover:border-[#0090d9]/30 transition-colors"
            >
              <Image src="/outlook.svg" alt="Outlook" width={16} height={16} />
              <span className="text-xs font-medium text-[#0078d4]">Connect Outlook</span>
              {mscalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0078d4]" /> : <Link2 className="h-3.5 w-3.5 text-[#0078d4]" />}
            </button>
          ) : null}

          {/* Google Calendar connect/disconnect */}
          {gcalConnected ? (
            <button
              onClick={handleDisconnectGoogleCalendar}
              disabled={gcalLoading}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors group"
            >
              <Image src="/google-calendar.svg" alt="Google Calendar" width={16} height={16} />
              <span className="text-xs font-medium text-emerald-600 group-hover:hidden">Connected</span>
              <span className="text-xs font-medium text-red-500 hidden group-hover:inline">Disconnect</span>
              {gcalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9ca3af]" /> : (
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
              className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 hover:bg-[#e0f2fe] hover:border-[#0090d9]/30 transition-colors"
            >
              <Image src="/google-calendar.svg" alt="Google Calendar" width={16} height={16} />
              <span className="text-xs font-medium text-[#0090d9]">Connect Calendar</span>
              {gcalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0090d9]" /> : <Link2 className="h-3.5 w-3.5 text-[#0090d9]" />}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2">
              <Image src="/google-calendar.svg" alt="Google Calendar" width={16} height={16} />
              <span className="text-xs text-[#9ca3af]">Not configured</span>
            </div>
          )}

          {/* List / Calendar toggle */}
          <div className="flex items-center rounded-lg border border-[#e5e7eb] bg-white overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                viewMode === "list" ? "bg-gray-100 text-[#374151]" : "text-[#6b7280] hover:bg-gray-50"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                viewMode === "calendar" ? "bg-gray-100 text-[#374151]" : "text-[#6b7280] hover:bg-gray-50"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              saved
                ? "bg-emerald-500 text-white"
                : "bg-[#0090d9] text-white hover:bg-[#007bc0]"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Auto-generated Google Meet info */}
      {videoPlatform === "google_meet" && gcalOauthConnected && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <Image src="/google-meet.webp" alt="Google Meet" width={20} height={20} />
          <div className="flex-1">
            <p className="text-xs font-medium text-emerald-800">Google Meet links will be auto-generated for each booking</p>
          </div>
          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        </div>
      )}

      {/* Custom Video Link */}
      {videoPlatform !== "jitsi" && !(videoPlatform === "google_meet" && gcalOauthConnected) && (
        <div className="mb-3 rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 flex items-center gap-3">
          <Image
            src={VIDEO_PLATFORM_ICONS[videoPlatform]?.src || "/jitsi.png"}
            alt={VIDEO_PLATFORM_ICONS[videoPlatform]?.alt || "Video"}
            width={20}
            height={20}
          />
          <input
            type="url"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder={
              videoPlatform === "zoom" ? "https://zoom.us/j/..." :
              videoPlatform === "google_meet" ? "https://meet.google.com/..." :
              "https://teams.microsoft.com/l/meetup-join/..."
            }
            className="flex-1 text-sm text-[#374151] placeholder:text-[#9ca3af] focus:outline-none bg-transparent"
          />
          <button
            onClick={handleVideoLinkSave}
            disabled={videoSaving}
            className="rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#007bc0] transition-colors"
          >
            {videoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </button>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-lg border border-[#e5e7eb] bg-white">
            {/* Schedule header */}
            <div className="border-b border-[#e5e7eb] px-6 py-5">
              <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wider">Schedule</p>
              <h2 className="text-lg font-semibold text-[#1a2b3c]">Working hours (default)</h2>
            </div>

            {/* Main content: Weekly hours + Date-specific hours */}
            <div className="flex divide-x divide-[#e5e7eb]">
              {/* Weekly hours - left side */}
              <div className="flex-1 px-6 py-5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-[#374151]" />
                  <h3 className="text-sm font-semibold text-[#374151]">Weekly hours</h3>
                </div>
                <p className="text-xs text-[#9ca3af] mb-5">Set when you are typically available for meetings</p>

                <div className="space-y-3">
                  {CALENDLY_DAYS.map((day) => {
                    const daySchedule = schedule.find((s) => s.dayOfWeek === day.dayOfWeek);
                    const isEnabled = daySchedule?.enabled ?? false;
                    return (
                      <div key={day.dayOfWeek} className="flex items-center gap-3">
                        <button
                          onClick={() => handleDayToggle(day.dayOfWeek)}
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white transition-all",
                            isEnabled ? day.color : "bg-[#d1d5db]"
                          )}
                          title={`${isEnabled ? "Disable" : "Enable"} ${day.fullLabel}`}
                        >
                          {day.label}
                        </button>
                        {isEnabled ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={daySchedule?.startHour ?? 9}
                              onChange={(e) => handleDayTimeChange(day.dayOfWeek, "startHour", Number(e.target.value))}
                              className="w-[110px] rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]/30"
                            >
                              {TIME_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <span className="text-sm text-[#9ca3af]">-</span>
                            <select
                              value={daySchedule?.endHour ?? 17}
                              onChange={(e) => handleDayTimeChange(day.dayOfWeek, "endHour", Number(e.target.value))}
                              className="w-[110px] rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#374151] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]/30"
                            >
                              {TIME_OPTIONS.filter((opt) => opt.value > (daySchedule?.startHour ?? 9)).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleDayToggle(day.dayOfWeek)}
                              className="rounded-md p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAddHour(day.dayOfWeek)}
                              className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#e0f2fe] hover:text-[#0090d9] transition-colors"
                              title="Extend by 1 hour"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCopyToAll(day.dayOfWeek)}
                              className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#e0f2fe] hover:text-[#0090d9] transition-colors"
                              title="Copy to all days"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-[#d1d5db]">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Timezone */}
                <div className="mt-5 pt-4 border-t border-[#f3f4f6]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#9ca3af]">Total weekly hours</span>
                    <span className="text-sm font-semibold text-[#0090d9]">
                      {((slotGrid.flat().filter(Boolean).length * SLOT_MINS) / 60).toFixed(1)}h
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#0090d9]">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone}</span>
                  </div>
                </div>
              </div>

              {/* Date-specific hours - right side */}
              <div className="w-[360px] flex-shrink-0 px-6 py-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#374151]" />
                    <h3 className="text-sm font-semibold text-[#374151]">Date-specific hours</h3>
                  </div>
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Hours
                  </button>
                </div>
                <p className="text-xs text-[#9ca3af] mb-4">Adjust hours for specific days</p>

                {/* Mini Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="rounded p-1 text-[#9ca3af] hover:bg-gray-100 hover:text-[#374151] transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium text-[#374151]">{format(currentMonth, "MMMM yyyy")}</span>
                    <button
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="rounded p-1 text-[#9ca3af] hover:bg-gray-100 hover:text-[#374151] transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 mb-1">
                    {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((d) => (
                      <span key={d} className="py-1.5 text-center text-[11px] font-medium text-[#9ca3af]">{d}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                    {days.map((date) => {
                      const today = isToday(date);
                      const override = getOverride(date);
                      const isSelected = selectedDate && isSameDay(date, selectedDate);
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => setSelectedDate(isSelected ? null : date)}
                          className={cn(
                            "flex h-8 w-full items-center justify-center text-xs transition-all relative rounded-md",
                            today ? "font-bold" : "font-normal",
                            today && !isSelected ? "text-white" : "text-[#374151] hover:bg-gray-50",
                            isSelected && "ring-1 ring-[#0090d9] bg-[#e0f2fe]",
                            override && !override.available && "text-red-400",
                          )}
                        >
                          {today && !isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="w-7 h-7 rounded-full bg-[#0090d9]" />
                            </span>
                          )}
                          <span className="relative z-10">{format(date, "d")}</span>
                          {override && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date override panel */}
                {selectedDate && isSameMonth(selectedDate, currentMonth) && (
                  <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-[#374151]">
                        {format(selectedDate, "EEE, MMM d")}
                      </span>
                      <button onClick={() => setSelectedDate(null)} className="rounded p-1 hover:bg-gray-100">
                        <X className="h-3.5 w-3.5 text-[#9ca3af]" />
                      </button>
                    </div>
                    {getOverride(selectedDate) ? (
                      <div>
                        <p className="mb-3 text-xs text-[#6b7280]">
                          Blocked{getOverride(selectedDate)?.reason ? `: ${getOverride(selectedDate)!.reason}` : ""}
                        </p>
                        <button
                          onClick={() => toggleDateOverride(selectedDate)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Unblock
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="mb-3 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]/30"
                        />
                        <button
                          onClick={() => toggleDateOverride(selectedDate)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Block Date
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Active overrides list */}
                {overrides.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
                    <p className="text-[11px] font-medium text-[#9ca3af] mb-2">Blocked dates</p>
                    <div className="space-y-1.5">
                      {overrides.filter((o) => !o.available).map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-md bg-red-50 px-3 py-1.5">
                          <span className="text-xs text-red-600">
                            {format(new Date(o.date), "MMM d")}
                            {o.reason ? ` — ${o.reason}` : ""}
                          </span>
                          <button
                            onClick={async () => {
                              await fetch(`/api/availability/overrides?id=${o.id}`, { method: "DELETE" });
                              setOverrides((prev) => prev.filter((x) => x.id !== o.id));
                            }}
                            className="rounded p-0.5 text-red-400 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
      <div className="flex-1 flex min-h-0 border border-[#e5e7eb] rounded-lg bg-white overflow-hidden">
        {/* Week calendar */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Calendar header with navigation */}
          <div className="flex items-center justify-between px-4 h-[41px] border-b border-[#e5e7eb] relative z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[#374151]">
                {format(currentWeekStart, "MMMM yyyy")}
              </h2>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={goToPrevWeek}
                  className="rounded-md p-1 text-[#6b7280] hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goToNextWeek}
                  className="rounded-md p-1 text-[#6b7280] hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-[#374151] cursor-default"
              >
                Week
              </button>
              <button
                onClick={goToToday}
                className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>

          {/* Day column headers */}
          <div
            className="grid border-b border-[#e5e7eb]"
            style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
          >
            <div className="py-2 text-center text-[10px] font-medium text-[#9ca3af] uppercase border-r border-[#f3f4f6]">
              {tzShort}
            </div>
            {weekDays.map((date) => {
              const dayName = format(date, "EEE");
              const dayNum = format(date, "d");
              const today = isToday(date);
              return (
                <div
                  key={date.toISOString()}
                  className="py-2 text-center border-r border-[#f3f4f6] last:border-r-0"
                >
                  <span className={cn(
                    "text-xs",
                    today ? "text-[#0090d9] font-semibold" : "text-[#6b7280]"
                  )}>
                    {dayName}
                  </span>
                  <span className={cn(
                    "ml-1.5 text-xs",
                    today
                      ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0090d9] text-white font-semibold"
                      : "text-[#6b7280]"
                  )}>
                    {dayNum}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={gridContainerRef} className="flex-1 min-h-0 overflow-y-auto select-none relative">
            {/* Current time indicator */}
            {weekDays.some((d) => isToday(d)) && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${currentTime.hours * HOUR_HEIGHT + (currentTime.minutes / 60) * HOUR_HEIGHT}px` }}
              >
                <div className="relative" style={{ marginLeft: "60px" }}>
                  <div className="absolute -left-[60px] -translate-y-1/2 w-[60px] flex justify-end pr-1">
                    <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {formatCurrentTime()}
                    </span>
                  </div>
                  <div className="h-[2px] bg-red-500 relative">
                    <div className="absolute -left-1.5 -top-[4px] w-[10px] h-[10px] rounded-full bg-red-500" />
                  </div>
                </div>
              </div>
            )}

            {/* Availability blocks overlay */}
            <div
              className="absolute top-0 left-0 right-0 z-[1] pointer-events-none"
              style={{
                height: `${24 * HOUR_HEIGHT}px`,
                display: "grid",
                gridTemplateColumns: "60px repeat(7, 1fr)",
                gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
              }}
            >
              {availabilityBlocks.map((block, i) => (
                <div
                  key={`${block.colIndex}-${block.startSlot}-${i}`}
                  className="relative mx-0.5 rounded-md bg-[#e0f2fe] border-l-2 border-l-[#0090d9] shadow-sm"
                  style={{
                    gridColumn: block.colIndex + 2,
                    gridRow: `${block.startSlot + 1} / span ${block.slotCount}`,
                  }}
                >
                  {block.slotCount >= 2 && (
                    <span className="absolute left-1 top-0.5 right-1 text-[9px] font-medium text-[#0090d9] truncate">
                      {block.startTime} - {block.endTime}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Hour rows */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="grid relative"
                style={{
                  gridTemplateColumns: "60px repeat(7, 1fr)",
                  height: `${HOUR_HEIGHT}px`,
                }}
              >
                <div className="relative border-r border-[#f3f4f6]">
                  {hour > 0 && (
                    <span className="absolute -top-[9px] right-2 text-[11px] text-[#9ca3af]">
                      {formatHour(hour)}
                    </span>
                  )}
                </div>

                {weekDays.map((date, colIdx) => {
                  const dIdx = dateToDayIndex(date);
                  const sIdx1 = hour * SLOTS_PER_HOUR;
                  const sIdx2 = hour * SLOTS_PER_HOUR + 1;
                  const active1 = slotGrid[dIdx]?.[sIdx1] ?? false;
                  const active2 = slotGrid[dIdx]?.[sIdx2] ?? false;

                  return (
                    <div
                      key={colIdx}
                      className="border-r border-[#f3f4f6] last:border-r-0 relative z-10"
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 top-0 cursor-pointer transition-colors",
                          !active1 && "hover:bg-[#f9fafb]",
                        )}
                        style={{ height: `${SLOT_HEIGHT}px` }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSlotMouseDown(dIdx, sIdx1);
                        }}
                        onMouseEnter={() => handleSlotMouseEnter(dIdx, sIdx1)}
                      />
                      <div
                        className={cn(
                          "absolute inset-x-0 cursor-pointer transition-colors",
                          !active2 && "hover:bg-[#f9fafb]",
                        )}
                        style={{ top: `${SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSlotMouseDown(dIdx, sIdx2);
                        }}
                        onMouseEnter={() => handleSlotMouseEnter(dIdx, sIdx2)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar - shares same card */}
        <div className={cn(
          "flex-shrink-0 border-l border-[#e5e7eb] bg-white transition-all duration-200 overflow-hidden",
          sidebarOpen ? "w-[260px]" : "w-10"
        )}>
          {/* Sidebar header - height matches calendar header */}
          <div className={cn(
            "flex items-center border-b border-[#e5e7eb] px-2",
            sidebarOpen ? "justify-between" : "justify-center"
          )} style={{ height: "41px" }}>
            {sidebarOpen && (
              <span className="text-xs font-semibold text-[#374151]">
                {format(currentMonth, "MMMM yyyy")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-md p-1.5 text-[#6b7280] hover:bg-gray-100 hover:text-[#374151] transition-colors"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? (
                <ChevronsRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronsLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div className="p-3 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100% - 40px)" }}>
              {/* Date-specific hours */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-semibold text-[#374151]">Date-specific hours</h3>
                    <p className="text-[10px] text-[#9ca3af]">Adjust hours for specific days</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="rounded p-0.5 text-[#9ca3af] hover:bg-gray-100 hover:text-[#374151] transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-medium text-[#374151]">{format(currentMonth, "MMMM yyyy")}</span>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="rounded p-0.5 text-[#9ca3af] hover:bg-gray-100 hover:text-[#374151] transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-1">
                  {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((d) => (
                    <span key={d} className="py-1 text-center text-[10px] font-medium text-[#9ca3af]">{d}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                  {days.map((date) => {
                    const today = isToday(date);
                    const inWeek = isInCurrentWeek(date);
                    const override = getOverride(date);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(isSelected ? null : date)}
                        className={cn(
                          "flex h-7 w-full items-center justify-center text-[11px] transition-all relative rounded",
                          inWeek && "bg-[#e0f2fe]",
                          today ? "font-bold" : "font-normal",
                          today && !isSelected
                            ? "text-white"
                            : inWeek ? "text-[#374151]" : "text-[#6b7280] hover:bg-gray-50",
                          isSelected && "ring-1 ring-[#0090d9]",
                          override && !override.available && "text-red-400",
                        )}
                      >
                        {today && !isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full bg-[#0090d9]" />
                          </span>
                        )}
                        <span className="relative z-10">{format(date, "d")}</span>
                        {override && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date override panel */}
              {selectedDate && isSameMonth(selectedDate, currentMonth) && (
                <div className="border-t border-[#f3f4f6] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#374151]">
                      {format(selectedDate, "EEE, MMM d")}
                    </span>
                    <button onClick={() => setSelectedDate(null)} className="rounded p-0.5 hover:bg-gray-100">
                      <X className="h-3 w-3 text-[#9ca3af]" />
                    </button>
                  </div>
                  {getOverride(selectedDate) ? (
                    <div>
                      <p className="mb-2 text-[11px] text-[#6b7280]">
                        Blocked{getOverride(selectedDate)?.reason ? `: ${getOverride(selectedDate)!.reason}` : ""}
                      </p>
                      <button
                        onClick={() => toggleDateOverride(selectedDate)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        Unblock
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="mb-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]/30"
                      />
                      <button
                        onClick={() => toggleDateOverride(selectedDate)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                      >
                        <Ban className="h-3 w-3" />
                        Block Date
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Schedule Summary */}
              <div className="border-t border-[#f3f4f6] pt-3">
                <h3 className="text-xs font-semibold text-[#374151] mb-2">Schedule Summary</h3>
                <div className="space-y-1.5">
                  {DAY_LABELS.map((d, dIdx) => {
                    const slots = slotGrid[dIdx];
                    const activeCount = slots?.filter(Boolean).length ?? 0;
                    const first = slots?.findIndex(Boolean) ?? -1;
                    const reversedFirst = slots ? [...slots].reverse().findIndex(Boolean) : -1;
                    const last = reversedFirst === -1 ? -1 : TOTAL_SLOTS - 1 - reversedFirst;
                    return (
                      <div key={d} className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-semibold w-7",
                          activeCount > 0 ? "text-[#374151]" : "text-[#d1d5db]"
                        )}>
                          {d}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0090d9] transition-all duration-300"
                            style={{ width: `${(activeCount / TOTAL_SLOTS) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#9ca3af] w-20 text-right">
                          {activeCount > 0 ? (
                            <>{formatSlotTime(first)} - {formatSlotTime(last + 1)}</>
                          ) : (
                            <span className="text-[#d1d5db]">Unavailable</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-[#f3f4f6]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#9ca3af]">Total weekly hours</span>
                    <span className="text-sm font-semibold text-[#0090d9]">
                      {((slotGrid.flat().filter(Boolean).length * SLOT_MINS) / 60).toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
