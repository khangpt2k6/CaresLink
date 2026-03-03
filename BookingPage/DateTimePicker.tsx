import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimezoneSelector } from './TimezoneSelector';
import type { AvailabilitySlot } from './types';

interface DateTimePickerProps {
  slots: AvailabilitySlot[];
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onMonthChange?: (month: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Get yyyy-MM-dd for a Date in the given timezone */
function toDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Get the start of the week (Sunday) for the given date */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Generate all days to display in the calendar grid */
function getCalendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = startOfWeek(first);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const days: Date[] = [];
  const current = new Date(start);
  // Fill enough rows to cover the month (5 or 6 weeks)
  while (days.length < 35 || current <= lastDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  // Pad to complete the last week row
  while (days.length % 7 !== 0) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function DateTimePicker({
  slots,
  timezone,
  onTimezoneChange,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: DateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();
  const todayStr = toDateString(today, timezone);

  // Build set of available date strings in guest timezone
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      set.add(toDateString(new Date(slot.start_time), timezone));
    }
    return set;
  }, [slots, timezone]);

  const days = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  const canGoPrev = currentMonth > startOfMonth(today);

  const handlePrevMonth = () => {
    const newMonth = addMonths(currentMonth, -1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  return (
    <div className="flex flex-col gap-2 desktop:gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm desktop:text-base font-semibold text-foreground">{monthLabel}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className="rounded-md p-1 text-foreground-muted hover:text-foreground-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-md p-1 text-foreground-muted hover:text-foreground-secondary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-0.5 desktop:py-1 text-[11px] desktop:text-xs font-medium text-foreground-muted">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0 desktop:gap-y-1 text-center">
        {days.map((day, i) => {
          const dayStr = toDateString(day, timezone);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = dayStr === todayStr;
          const isAvailable = availableDates.has(dayStr);
          const isPast = dayStr < todayStr;
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

          return (
            <div key={i} className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isAvailable || isPast || !isCurrentMonth}
                onClick={() => onSelectDate(day)}
                className={cn(
                  'mx-auto flex h-7 w-7 desktop:h-9 desktop:w-9 items-center justify-center rounded-full text-xs desktop:text-sm transition-colors',
                  // Default state
                  !isCurrentMonth && 'text-foreground-muted opacity-30',
                  isCurrentMonth && !isAvailable && 'text-foreground-muted cursor-default',
                  isPast && isCurrentMonth && 'text-foreground-muted opacity-30 cursor-default',
                  // Available (accent text like Notion)
                  isAvailable && !isPast && !isSelected && 'font-medium text-accent hover:bg-accent-light cursor-pointer',
                  // Selected
                  isSelected && 'bg-accent text-foreground-inverse hover:bg-accent-hover font-medium cursor-pointer',
                )}
              >
                {day.getDate()}
              </button>
              {/* Today dot indicator */}
              {isToday && isCurrentMonth && (
                <div className={cn(
                  'h-1 w-1 rounded-full mt-0.5',
                  isSelected ? 'bg-foreground-inverse' : 'bg-accent',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Timezone selector */}
      <TimezoneSelector timezone={timezone} onChange={onTimezoneChange} />
    </div>
  );
}
