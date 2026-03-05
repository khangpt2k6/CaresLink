"use client";

import { format } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSlotsProps {
  slots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}

export function TimeSlots({ slots, selectedSlot, onSelectSlot }: TimeSlotsProps) {
  if (slots.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[#9b9a97]">
        No available times for this date
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => {
        const d = new Date(slot);
        const isSelected = selectedSlot === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelectSlot(slot)}
            className={cn(
              "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-all text-left",
              isSelected
                ? "border-[#00BFFF] bg-[#e6faff] text-[#37352f] font-medium"
                : "border-[#e8e8e5] text-[#73726e] hover:border-[#d4d4d0] hover:bg-[#f7f7f5]"
            )}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#9b9a97]" />
            {format(d, "h:mm a")}
          </button>
        );
      })}
    </div>
  );
}
