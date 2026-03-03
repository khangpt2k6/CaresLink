"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  addDays,
  format,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DatePickerProps {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  availableDates: string[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function DatePicker({
  currentMonth,
  onMonthChange,
  availableDates,
  selectedDate,
  onSelectDate,
}: DatePickerProps) {
  const today = startOfDay(new Date());
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = addDays(monthStart, -getDay(monthStart));

  const days = useMemo(() => {
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const prefixDays = eachDayOfInterval({
      start: calendarStart,
      end: addDays(monthStart, -1),
    });
    const totalCells = prefixDays.length + allDays.length;
    const suffixCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const suffixDays =
      suffixCount > 0
        ? eachDayOfInterval({
            start: addDays(monthEnd, 1),
            end: addDays(monthEnd, suffixCount),
          })
        : [];
    return [...prefixDays, ...allDays, ...suffixDays];
  }, [currentMonth, monthStart, monthEnd, calendarStart]);

  const canGoPrev = !isBefore(startOfMonth(currentMonth), startOfMonth(new Date()));

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#37352f]">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
            className="rounded-md p-1 text-[#9b9a97] hover:text-[#37352f] disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="rounded-md p-1 text-[#9b9a97] hover:text-[#37352f]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-[11px] font-medium text-[#9b9a97]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const isAvailable = availableSet.has(dateStr);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const todayMark = isToday(day);

          return (
            <div key={i} className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isAvailable || isPast || !inMonth}
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                  !inMonth && "text-[#d4d4d0]",
                  inMonth && !isAvailable && "text-[#d4d4d0] cursor-default",
                  isPast && inMonth && "text-[#d4d4d0] cursor-default",
                  isAvailable &&
                    !isPast &&
                    !isSelected &&
                    "font-medium text-[#2383e2] hover:bg-[#f0f7ff] cursor-pointer",
                  isSelected &&
                    "bg-[#2383e2] text-white font-medium cursor-pointer hover:bg-[#1b6ec2]"
                )}
              >
                {day.getDate()}
              </button>
              {todayMark && inMonth && (
                <div
                  className={cn(
                    "h-1 w-1 rounded-full mt-0.5",
                    isSelected ? "bg-white" : "bg-[#2383e2]"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
