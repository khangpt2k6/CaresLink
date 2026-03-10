"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight,
  Save, Loader2, Check, X, Plus, Copy, List, Calendar, Clock, Globe,
  MoreVertical, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Grid config
const GRID_START = 0;
const GRID_END = 24;
const SLOT_MINS = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINS;
const TOTAL_SLOTS = (GRID_END - GRID_START) * SLOTS_PER_HOUR;
const HOUR_HEIGHT = 60;
const SLOT_HEIGHT = HOUR_HEIGHT / 2;

const DAYS_ORDER = [0, 1, 2, 3, 4, 5, 6]; // Sun=0 first for Calendly-style display
const DAYS_ORDER_GRID = [1, 2, 3, 4, 5, 6, 0]; // Mon first for grid internals
const DAY_LABELS_FULL = ["Sunday", "Tuesday", "Monday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

// Calendly-style day config: dayOfWeek (JS: 0=Sun) -> display info
const CALENDLY_DAYS = [
  { dayOfWeek: 0, label: "Sunday", short: "S", color: "bg-[#0069ff]" },
  { dayOfWeek: 1, label: "Monday", short: "M", color: "bg-[#0069ff]" },
  { dayOfWeek: 2, label: "Tuesday", short: "T", color: "bg-[#0069ff]" },
  { dayOfWeek: 3, label: "Wednesday", short: "W", color: "bg-[#0069ff]" },
  { dayOfWeek: 4, label: "Thursday", short: "T", color: "bg-[#0069ff]" },
  { dayOfWeek: 5, label: "Friday", short: "F", color: "bg-[#0069ff]" },
  { dayOfWeek: 6, label: "Saturday", short: "S", color: "bg-[#0069ff]" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time - US & Canada" },
  { value: "America/Chicago", label: "Central Time - US & Canada" },
  { value: "America/Denver", label: "Mountain Time - US & Canada" },
  { value: "America/Los_Angeles", label: "Pacific Time - US & Canada" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

// Generate time options in 30-min increments for dropdowns
const TIME_OPTIONS: { value: number; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const totalMins = h * 60 + m;
    const hour = totalMins / 60;
    const ampm = h < 12 ? "am" : "pm";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = m === 0 ? `${h12}:00${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
    TIME_OPTIONS.push({ value: hour, label });
  }
}
// Add end of day
TIME_OPTIONS.push({ value: 24, label: "12:00am" });

interface AvailabilityDay {
  id?: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  enabled: boolean;
}

interface DateOverride {
  date: string;
  startHour: number | null;
  endHour: number | null;
  reason?: string;
}

function formatHourDisplay(hour: number): string {
  if (hour === 0 || hour === 24) return "12:00am";
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}:00${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function formatSlotTime(slotIndex: number): string {
  const totalMins = GRID_START * 60 + slotIndex * SLOT_MINS;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h < 12 || h === 24 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

// slotGrid helpers for Calendar view
function scheduleToGrid(schedule: AvailabilityDay[]): boolean[][] {
  const grid = Array.from({ length: 7 }, () => Array(TOTAL_SLOTS).fill(false));
  schedule.forEach((day) => {
    if (!day.enabled) return;
    const dIdx = DAYS_ORDER_GRID.indexOf(day.dayOfWeek);
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
  return DAYS_ORDER_GRID.map((dayOfWeek, dIdx) => {
    const existing = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    const slots = slotGrid[dIdx];
    const first = slots.findIndex(Boolean);
    const reversedFirst = [...slots].reverse().findIndex(Boolean);
    const last = reversedFirst === -1 ? -1 : TOTAL_SLOTS - 1 - reversedFirst;
    if (first === -1) return { ...existing, dayOfWeek, enabled: false, startHour: 9, endHour: 17 };
    return {
      ...existing,
      dayOfWeek,
      enabled: true,
      startHour: GRID_START + first / SLOTS_PER_HOUR,
      endHour: GRID_START + (last + 1) / SLOTS_PER_HOUR,
    };
  });
}

function getCurrentTimePosition(): { percent: number; hours: number; minutes: number } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const percent = (totalMinutes / (24 * 60)) * 100;
  return { percent, hours, minutes };
}

// Time select dropdown component (Calendly-style)
function TimeSelect({
  value,
  onChange,
  minValue,
  maxValue,
}: {
  value: number;
  onChange: (v: number) => void;
  minValue?: number;
  maxValue?: number;
}) {
  const options = TIME_OPTIONS.filter((o) => {
    if (minValue !== undefined && o.value <= minValue) return false;
    if (maxValue !== undefined && o.value >= maxValue) return false;
    return true;
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="appearance-none bg-white border border-[#dadce0] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] font-medium cursor-pointer hover:border-[#0069ff] focus:border-[#0069ff] focus:ring-2 focus:ring-[#0069ff]/20 outline-none transition-all min-w-[110px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function CandidateAvailabilityPage() {
  const [schedule, setSchedule] = useState<AvailabilityDay[]>([]);
  const [slotGrid, setSlotGrid] = useState<boolean[][]>(
    () => Array.from({ length: 7 }, () => Array(TOTAL_SLOTS).fill(false))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [timezone, setTimezone] = useState("America/New_York");
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideStart, setOverrideStart] = useState(9);
  const [overrideEnd, setOverrideEnd] = useState(17);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Scroll to ~8 AM on mount (calendar view)
  useEffect(() => {
    if (gridContainerRef.current && !loading && viewMode === "calendar") {
      gridContainerRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, [loading, viewMode]);

  // Detect timezone
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const match = TIMEZONES.find((t) => t.value === tz);
      if (match) setTimezone(tz);
    } catch {}
  }, []);

  // Load data
  useEffect(() => {
    fetch("/api/candidate-availability")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSchedule(data);
          setSlotGrid(scheduleToGrid(data));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sync mini calendar month when week changes
  useEffect(() => {
    const midWeek = addDays(currentWeekStart, 3);
    if (!isSameMonth(midWeek, currentMonth)) {
      setCurrentMonth(startOfMonth(midWeek));
    }
  }, [currentWeekStart, currentMonth]);

  // Global mouseup to end drag
  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // MouseMove during drag
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
      const dIdx = DAYS_ORDER_GRID.indexOf(getDay(weekDays[colIndex]));
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

  const dateToDayIndex = (date: Date): number => {
    const jsDay = getDay(date);
    return DAYS_ORDER_GRID.indexOf(jsDay);
  };

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

  // Update schedule from list view changes
  const updateDaySchedule = (dayOfWeek: number, updates: Partial<AvailabilityDay>) => {
    setSchedule((prev) => {
      const newSchedule = prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, ...updates } : d
      );
      // If day doesn't exist yet, add it
      if (!prev.find((d) => d.dayOfWeek === dayOfWeek)) {
        newSchedule.push({
          dayOfWeek,
          startHour: 9,
          endHour: 17,
          enabled: true,
          ...updates,
        });
      }
      setSlotGrid(scheduleToGrid(newSchedule));
      return newSchedule;
    });
  };

  const toggleDay = (dayOfWeek: number) => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    updateDaySchedule(dayOfWeek, {
      enabled: !(day?.enabled ?? false),
      startHour: day?.startHour ?? 9,
      endHour: day?.endHour ?? 17,
    });
  };

  const copyToAll = (sourceDayOfWeek: number) => {
    const source = schedule.find((d) => d.dayOfWeek === sourceDayOfWeek);
    if (!source) return;
    setSchedule((prev) => {
      const newSchedule = DAYS_ORDER.map((dow) => {
        const existing = prev.find((d) => d.dayOfWeek === dow);
        return {
          ...existing,
          dayOfWeek: dow,
          startHour: source.startHour,
          endHour: source.endHour,
          enabled: source.enabled,
        };
      });
      setSlotGrid(scheduleToGrid(newSchedule));
      return newSchedule;
    });
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      let newSchedule: AvailabilityDay[];
      if (viewMode === "calendar") {
        newSchedule = gridToSchedule(schedule, slotGrid);
      } else {
        newSchedule = schedule;
      }
      const res = await fetch("/api/candidate-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedule(updated);
        setSlotGrid(scheduleToGrid(updated));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Calendar view helpers
  const availabilityBlocks = useMemo(() => {
    const blocks: { colIndex: number; startSlot: number; slotCount: number; startTime: string; endTime: string }[] = [];
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const slots = slotGrid[dIdx] || [];
      let i = 0;
      while (i < TOTAL_SLOTS) {
        if (!slots[i]) { i++; continue; }
        let end = i;
        while (end < TOTAL_SLOTS && slots[end]) end++;
        const colIndex = weekDays.findIndex((d) => DAYS_ORDER_GRID.indexOf(getDay(d)) === dIdx);
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

  const goToPrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  const formatCurrentTime = () => {
    const { hours, minutes } = currentTime;
    const ampm = hours < 12 ? "AM" : "PM";
    const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const isInCurrentWeek = (date: Date) => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    return date >= currentWeekStart && date <= weekEnd;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const isDateAvailable = useCallback((date: Date) => {
    const daySchedule = schedule.find((s) => s.dayOfWeek === getDay(date));
    return daySchedule?.enabled ?? false;
  }, [schedule]);

  // Get total weekly hours
  const totalWeeklyHours = useMemo(() => {
    return schedule.reduce((total, day) => {
      if (!day.enabled) return total;
      return total + (day.endHour - day.startHour);
    }, 0);
  }, [schedule]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0069ff]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-screen flex flex-col bg-[#f8f9fa]">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Availability</h1>
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-[#e5e7eb] shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-[#e8e8e8]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#666] font-medium uppercase tracking-wide mb-1">Schedule</p>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#0069ff]">Working hours (default)</h2>
                <ChevronDown className="h-4 w-4 text-[#0069ff]" />
              </div>
              <p className="text-xs text-[#0069ff] mt-1 cursor-pointer hover:underline">
                Active on: 1 event type
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* List / Calendar toggle */}
              <div className="flex items-center bg-[#f3f4f6] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === "list"
                      ? "bg-white text-[#1a1a1a] shadow-sm"
                      : "text-[#666] hover:text-[#1a1a1a]"
                  )}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === "calendar"
                      ? "bg-white text-[#1a1a1a] shadow-sm"
                      : "text-[#666] hover:text-[#1a1a1a]"
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  Calendar
                </button>
              </div>

              {/* More options */}
              <button className="p-2 text-[#666] hover:bg-[#f3f4f6] rounded-lg transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "list" ? (
            /* =================== LIST VIEW (Calendly-style) =================== */
            <div className="px-6 py-6">
              <div className="max-w-3xl">
                {/* Weekly hours / Date-specific hours header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-12">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="h-4 w-4 text-[#1a1a1a]" />
                        <h3 className="text-base font-bold text-[#1a1a1a]">Weekly hours</h3>
                      </div>
                      <p className="text-sm text-[#666]">Set when you are typically available for meetings</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-[#1a1a1a]" />
                        <h3 className="text-base font-bold text-[#1a1a1a]">Date-specific hours</h3>
                      </div>
                      <p className="text-sm text-[#666]">Adjust hours for specific days</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddOverride(true)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-[#dadce0] rounded-full text-sm font-semibold text-[#0069ff] hover:bg-[#f0f6ff] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Hours
                  </button>
                </div>

                {/* Day rows */}
                <div className="space-y-0">
                  {CALENDLY_DAYS.map((day) => {
                    const dayData = schedule.find((d) => d.dayOfWeek === day.dayOfWeek);
                    const isEnabled = dayData?.enabled ?? false;
                    const startHour = dayData?.startHour ?? 9;
                    const endHour = dayData?.endHour ?? 17;

                    return (
                      <div
                        key={day.dayOfWeek}
                        className="flex items-center gap-4 py-4 border-b border-[#eee] last:border-b-0"
                      >
                        {/* Day toggle */}
                        <button
                          onClick={() => toggleDay(day.dayOfWeek)}
                          className={cn(
                            "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                            isEnabled
                              ? "bg-[#0069ff] text-white"
                              : "bg-[#e8e8e8] text-[#999]"
                          )}
                        >
                          {day.short}
                        </button>

                        {/* Time range or "Unavailable" */}
                        {isEnabled ? (
                          <div className="flex items-center gap-2 flex-1">
                            <TimeSelect
                              value={startHour}
                              onChange={(v) => updateDaySchedule(day.dayOfWeek, { startHour: v })}
                              maxValue={endHour}
                            />
                            <span className="text-[#999] text-sm">-</span>
                            <TimeSelect
                              value={endHour}
                              onChange={(v) => updateDaySchedule(day.dayOfWeek, { endHour: v })}
                              minValue={startHour}
                            />

                            {/* Action buttons */}
                            <button
                              onClick={() => updateDaySchedule(day.dayOfWeek, { enabled: false })}
                              className="p-1.5 text-[#999] hover:text-[#666] hover:bg-[#f3f4f6] rounded-lg transition-colors ml-1"
                              title="Remove hours"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 text-[#999] hover:text-[#666] hover:bg-[#f3f4f6] rounded-lg transition-colors"
                              title="Add another time range"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => copyToAll(day.dayOfWeek)}
                              className="p-1.5 text-[#999] hover:text-[#666] hover:bg-[#f3f4f6] rounded-lg transition-colors"
                              title="Copy times to all days"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-[#999]">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Date overrides section */}
                {showAddOverride && (
                  <div className="mt-6 p-4 border border-[#dadce0] rounded-xl bg-[#fafafa]">
                    <h4 className="text-sm font-semibold text-[#1a1a1a] mb-3">Add date-specific hours</h4>
                    <div className="flex items-end gap-3">
                      <div>
                        <label className="text-xs text-[#666] mb-1 block">Date</label>
                        <input
                          type="date"
                          value={overrideDate}
                          onChange={(e) => setOverrideDate(e.target.value)}
                          className="border border-[#dadce0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0069ff] focus:ring-2 focus:ring-[#0069ff]/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#666] mb-1 block">Start</label>
                        <TimeSelect value={overrideStart} onChange={setOverrideStart} maxValue={overrideEnd} />
                      </div>
                      <div>
                        <label className="text-xs text-[#666] mb-1 block">End</label>
                        <TimeSelect value={overrideEnd} onChange={setOverrideEnd} minValue={overrideStart} />
                      </div>
                      <button
                        onClick={() => {
                          if (overrideDate) {
                            setDateOverrides((prev) => [
                              ...prev,
                              { date: overrideDate, startHour: overrideStart, endHour: overrideEnd },
                            ]);
                            setShowAddOverride(false);
                            setOverrideDate("");
                          }
                        }}
                        className="px-4 py-2 bg-[#0069ff] text-white rounded-lg text-sm font-medium hover:bg-[#0055cc] transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddOverride(false)}
                        className="px-4 py-2 text-[#666] rounded-lg text-sm font-medium hover:bg-[#f3f4f6] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing date overrides */}
                {dateOverrides.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {dateOverrides.map((override, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 bg-[#f9fafb] rounded-lg border border-[#eee]">
                        <Calendar className="h-4 w-4 text-[#666]" />
                        <span className="text-sm font-medium text-[#1a1a1a]">{override.date}</span>
                        <span className="text-sm text-[#666]">
                          {formatHourDisplay(override.startHour!)} - {formatHourDisplay(override.endHour!)}
                        </span>
                        <button
                          onClick={() => setDateOverrides((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-auto p-1 text-[#999] hover:text-[#666]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timezone */}
                <div className="mt-8 pt-6 border-t border-[#eee]">
                  <div className="relative">
                    <button
                      onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
                      className="flex items-center gap-2 text-sm text-[#0069ff] font-medium hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {TIMEZONES.find((t) => t.value === timezone)?.label || timezone}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    {showTimezoneDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowTimezoneDropdown(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#dadce0] rounded-xl shadow-lg z-50 py-2 max-h-64 overflow-y-auto w-80">
                          {TIMEZONES.map((tz) => (
                            <button
                              key={tz.value}
                              onClick={() => {
                                setTimezone(tz.value);
                                setShowTimezoneDropdown(false);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2 text-sm hover:bg-[#f0f6ff] transition-colors",
                                timezone === tz.value ? "text-[#0069ff] font-medium bg-[#f0f6ff]" : "text-[#1a1a1a]"
                              )}
                            >
                              {tz.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =================== CALENDAR VIEW =================== */
            <div className="flex flex-1 min-h-0 h-full">
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
                    <button className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-[#374151] cursor-default">
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
                    TIME
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
                        <span className={cn("text-xs", today ? "text-blue-600 font-semibold" : "text-[#6b7280]")}>
                          {dayName}
                        </span>
                        <span className={cn(
                          "ml-1.5 text-xs",
                          today
                            ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-semibold"
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
                        className="relative mx-0.5 rounded-md bg-[#e0f2fe] border-l-2 border-l-[#0069ff] shadow-sm"
                        style={{
                          gridColumn: block.colIndex + 2,
                          gridRow: `${block.startSlot + 1} / span ${block.slotCount}`,
                        }}
                      >
                        {block.slotCount >= 2 && (
                          <span className="absolute left-1 top-0.5 right-1 text-[9px] font-medium text-[#0069ff] truncate">
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

                        return (
                          <div
                            key={colIdx}
                            className="border-r border-[#f3f4f6] last:border-r-0 relative z-10"
                          >
                            <div
                              className="absolute inset-x-0 top-0 cursor-pointer transition-colors hover:bg-[#f9fafb]"
                              style={{ height: `${SLOT_HEIGHT}px` }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSlotMouseDown(dIdx, sIdx1);
                              }}
                              onMouseEnter={() => handleSlotMouseEnter(dIdx, sIdx1)}
                            />
                            <div
                              className="absolute inset-x-0 cursor-pointer transition-colors hover:bg-[#f9fafb]"
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

              {/* Right sidebar */}
              <div className={cn(
                "flex-shrink-0 border-l border-[#e5e7eb] bg-white transition-all duration-200 overflow-hidden",
                sidebarOpen ? "w-[260px]" : "w-10"
              )}>
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
                    {sidebarOpen ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {sidebarOpen && (
                  <div className="p-3 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100% - 40px)" }}>
                    {/* Mini Calendar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                          className="rounded p-0.5 text-[#9ca3af] hover:bg-gray-100 hover:text-[#374151] transition-colors"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
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
                          const available = isDateAvailable(date);
                          return (
                            <button
                              key={date.toISOString()}
                              onClick={() => setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 0 }))}
                              className={cn(
                                "flex h-7 w-full items-center justify-center text-[11px] transition-all relative rounded",
                                inWeek && "bg-blue-50",
                                today ? "font-bold" : "font-normal",
                                today ? "text-white" : inWeek ? "text-[#374151]" : "text-[#6b7280] hover:bg-gray-50",
                              )}
                            >
                              {today && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="w-6 h-6 rounded-full bg-blue-600" />
                                </span>
                              )}
                              <span className="relative z-10">{format(date, "d")}</span>
                              {available && isSameMonth(date, currentMonth) && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0069ff]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Schedule Summary */}
                    <div className="border-t border-[#f3f4f6] pt-3">
                      <h3 className="text-xs font-semibold text-[#374151] mb-2">Schedule Summary</h3>
                      <div className="space-y-1.5">
                        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, dIdx) => {
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
                                  className="h-full rounded-full bg-[#0069ff] transition-all duration-300"
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
                          <span className="text-sm font-semibold text-[#0069ff]">
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

        {/* Bottom bar with save */}
        <div className="px-6 py-3 border-t border-[#e8e8e8] bg-[#fafafa] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Clock className="h-4 w-4" />
            <span>
              {totalWeeklyHours > 0
                ? `${totalWeeklyHours.toFixed(1)} hours per week`
                : "No hours set"}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all",
              saved
                ? "bg-emerald-500 text-white"
                : "bg-[#0069ff] text-white hover:bg-[#0055cc] shadow-sm"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
