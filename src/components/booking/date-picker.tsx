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
import { motion } from "framer-motion";
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

  const days = useMemo(() => {
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const prefixCount = getDay(monthStart); // 0 (Sun) to 6 (Sat)
    const prefixDays =
      prefixCount > 0
        ? eachDayOfInterval({
            start: addDays(monthStart, -prefixCount),
            end: addDays(monthStart, -1),
          })
        : [];
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
  }, [currentMonth, monthStart, monthEnd]);

  const canGoPrev = !isBefore(startOfMonth(currentMonth), startOfMonth(new Date()));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="truncate text-sm font-semibold text-[#1a2b3c] sm:text-base">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex shrink-0 gap-0.5 sm:gap-1">
          <motion.button
            type="button"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
            className="rounded-lg p-1.5 text-[#5a6b7c] transition-colors hover:bg-[#e8f4fd] hover:text-[#0090d9] disabled:opacity-30"
            whileHover={canGoPrev ? { scale: 1.05 } : {}}
            whileTap={canGoPrev ? { scale: 0.95 } : {}}
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="rounded-lg p-1.5 text-[#5a6b7c] transition-colors hover:bg-[#e8f4fd] hover:text-[#0090d9]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-x-0 text-center">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-[10px] font-medium text-[#5a6b7c] sm:text-[11px]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid - responsive cell sizes */}
      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0 text-center sm:gap-y-1">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const isAvailable = availableSet.has(dateStr);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const todayMark = isToday(day);

          return (
            <div key={i} className="flex flex-col items-center">
              <motion.button
                type="button"
                disabled={!isAvailable || isPast || !inMonth}
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors sm:h-9 sm:w-9 sm:text-sm",
                  !inMonth && "text-[#c4cdd8]",
                  inMonth && !isAvailable && "text-[#c4cdd8] cursor-default",
                  isPast && inMonth && "text-[#c4cdd8] cursor-default",
                  isAvailable &&
                    !isPast &&
                    !isSelected &&
                    "font-medium text-[#0090d9] hover:bg-[#e8f4fd] cursor-pointer",
                  isSelected &&
                    "bg-[#0090d9] text-white font-medium cursor-pointer hover:bg-[#0077b6] shadow-md shadow-[#0090d9]/25"
                )}
                whileHover={isAvailable && !isPast ? { scale: 1.1 } : {}}
                whileTap={isAvailable && !isPast ? { scale: 0.95 } : {}}
              >
                {day.getDate()}
              </motion.button>
              {todayMark && inMonth && (
                <div
                  className={cn(
                    "h-1 w-1 rounded-full mt-0.5",
                    isSelected ? "bg-white" : "bg-[#0090d9]"
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
