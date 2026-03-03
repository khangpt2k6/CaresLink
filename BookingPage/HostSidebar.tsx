import { ArrowLeft, Calendar, Clock, Globe, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AvailabilitySlot, BookingLinkInfo } from './types';

interface HostSidebarProps {
  linkInfo: BookingLinkInfo;
  onBack?: () => void;
  selectedSlot?: AvailabilitySlot;
  timezone?: string;
  /** Original booking time shown with strikethrough during reschedule */
  formerTime?: { start_time: string; timezone: string };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getConferencingLabel(conferencing?: string): string | null {
  if (!conferencing || conferencing === 'none') return null;
  if (conferencing === 'gmeet') return 'Google Meet';
  if (conferencing === 'zoom' || conferencing === 'zoom-pending') return 'Zoom';
  return conferencing;
}

function formatSlotDateTime(slot: AvailabilitySlot, tz: string): string {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `${timeFmt.format(start)} - ${timeFmt.format(end)}, ${dateFmt.format(start)}`;
}

function getTimezoneLabel(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'long',
  }).formatToParts(new Date());
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

export function HostSidebar({ linkInfo, onBack, selectedSlot, timezone, formerTime }: HostSidebarProps) {
  const { title, description, duration_minutes, host_name, conferencing, location } = linkInfo;
  const conferencingLabel = getConferencingLabel(conferencing);

  return (
    <div className="flex flex-col desktop:gap-4 border-b border-border pb-3 desktop:border-b-0 desktop:border-r desktop:border-border desktop:pr-6 desktop:-mt-8 desktop:pt-8 desktop:-mb-6 desktop:pb-6">
      {/* Mobile layout */}
      <div className="flex flex-col gap-2 desktop:hidden">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <div className="flex items-center gap-3">
          {host_name && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-medium text-foreground-secondary shrink-0">
              {getInitials(host_name)}
            </div>
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
            <div className="flex items-center gap-3 text-xs text-foreground-secondary">
              {host_name && <span>{host_name}</span>}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {duration_minutes} min
              </span>
              {conferencingLabel && (
                <span className="flex items-center gap-1">
                  <img src={conferencing === 'zoom' || conferencing === 'zoom-pending' ? '/zoom-icon.png' : '/Google_Meet-Logo.wine.png'} alt={conferencingLabel} className="h-3 w-3 object-contain shrink-0" />
                  {conferencingLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        {selectedSlot && timezone && (
          <p className="text-xs text-foreground-secondary">
            {formatSlotDateTime(selectedSlot, timezone)}
          </p>
        )}
      </div>

      {/* Desktop: full vertical layout */}
      <div className="hidden desktop:flex desktop:flex-col desktop:gap-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover w-fit transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {host_name && (
          <span className="text-sm text-foreground-secondary">{host_name}</span>
        )}

        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>

        <div className="flex flex-col gap-3">
          {formerTime && (
            <div className="flex items-start gap-2.5 text-sm text-foreground-secondary">
              <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-foreground-muted" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px]">Former time</span>
                <span className="line-through text-foreground-muted">
                  {new Intl.DateTimeFormat('en-US', { timeZone: formerTime.timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(formerTime.start_time))}
                </span>
                <span className="line-through text-foreground-muted">
                  {new Intl.DateTimeFormat('en-US', { timeZone: formerTime.timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(formerTime.start_time)).toLowerCase()}
                </span>
              </div>
            </div>
          )}

          {formerTime && selectedSlot && timezone && (
            <div className="flex items-start gap-2.5 text-sm text-foreground-secondary">
              <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-foreground-muted" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px]">New time</span>
                <span>{formatSlotDateTime(selectedSlot, timezone)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 text-sm text-foreground-secondary">
            <Clock className="h-4 w-4 shrink-0 text-foreground-muted" />
            <span>{duration_minutes} min</span>
          </div>

          {conferencingLabel && (
            <div className="flex items-center gap-2.5 text-sm text-foreground-secondary">
              <img src={conferencing === 'zoom' || conferencing === 'zoom-pending' ? '/zoom-icon.png' : '/Google_Meet-Logo.wine.png'} alt={conferencingLabel} className="h-4 w-4 object-contain shrink-0" />
              <span>{conferencingLabel}</span>
            </div>
          )}

          {location && (
            <div className="flex items-center gap-2.5 text-sm text-foreground-secondary">
              <MapPin className="h-4 w-4 shrink-0 text-foreground-muted" />
              <span>{location}</span>
            </div>
          )}

          {!formerTime && selectedSlot && timezone && (
            <div className="flex items-start gap-2.5 text-sm text-foreground-secondary">
              <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-foreground-muted" />
              <span>{formatSlotDateTime(selectedSlot, timezone)}</span>
            </div>
          )}

          {selectedSlot && timezone && (
            <div className="flex items-center gap-2.5 text-sm text-foreground-secondary">
              <Globe className="h-4 w-4 shrink-0 text-foreground-muted" />
              <span>{getTimezoneLabel(timezone)}</span>
            </div>
          )}
        </div>

        {description && (
          <p className={cn('text-sm text-foreground-secondary whitespace-pre-wrap', !conferencingLabel && !location && 'mt-0')}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
