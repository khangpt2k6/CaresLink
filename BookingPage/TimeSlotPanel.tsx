import { cn } from '@/lib/utils';
import type { AvailabilitySlot } from './types';

interface TimeSlotPanelProps {
  selectedDate: Date;
  slots: AvailabilitySlot[];
  timezone: string;
  onSelect: (slot: AvailabilitySlot) => void;
}

function formatTime(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatDateHeading(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** Get yyyy-MM-dd for a Date in the given timezone */
function toDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}

export function TimeSlotPanel({ selectedDate, slots, timezone, onSelect }: TimeSlotPanelProps) {
  const selectedDateStr = toDateString(selectedDate, timezone);

  // Filter slots that fall on the selected date in the guest timezone
  const daySlots = slots.filter((slot) => {
    const slotDateStr = toDateString(new Date(slot.start_time), timezone);
    return slotDateStr === selectedDateStr;
  });

  return (
    <div className="flex flex-col gap-2 desktop:gap-3 desktop:min-h-0">
      <h2 className="text-sm font-semibold text-foreground">
        {formatDateHeading(selectedDate, timezone)}
      </h2>

      <div className="flex flex-row flex-wrap gap-1.5 desktop:gap-2 desktop:flex-col desktop:flex-nowrap desktop:flex-1 desktop:overflow-y-auto desktop:pr-1">
        {daySlots.length === 0 ? (
          <p className="text-sm text-foreground-muted">No available times</p>
        ) : (
          daySlots.map((slot) => (
            <button
              key={slot.start_time}
              type="button"
              onClick={() => onSelect(slot)}
              className={cn(
                'rounded-lg border border-accent/30 px-3 py-2 desktop:px-4 desktop:py-2.5 text-sm font-medium text-accent',
                'hover:bg-foreground/5 hover:border-accent/60',
                'transition-colors text-center',
              )}
            >
              {formatTime(slot.start_time, timezone)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
