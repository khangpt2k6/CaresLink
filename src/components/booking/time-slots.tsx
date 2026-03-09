"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
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
      <p className="py-4 text-center text-sm text-[#8a95a3]">
        No available times for this date
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot, i) => {
        const d = new Date(slot);
        const isSelected = selectedSlot === slot;
        return (
          <motion.button
            key={slot}
            type="button"
            onClick={() => onSelectSlot(slot)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-all text-left",
              isSelected
                ? "border-[#0090d9] bg-[#e8f4fd] text-[#1a2b3c] font-semibold shadow-sm shadow-[#0090d9]/10"
                : "border-[#e2e8f0] text-[#5a6b7c] hover:border-[#0090d9]/40 hover:bg-[#e8f4fd]/50"
            )}
            whileHover={{ scale: 1.02, x: 2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Clock className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-[#0090d9]" : "text-[#8a95a3]")} />
            {format(d, "h:mm a")}
          </motion.button>
        );
      })}
    </div>
  );
}
