'use no memo';
import { Check } from 'lucide-react';
import type { BookingConfirmationResponse } from './types';
import { downloadICS, buildGoogleCalendarUrl, buildOffice365Url, buildOutlookComUrl } from './icsUtils';

interface BookingConfirmationProps {
  confirmation: BookingConfirmationResponse;
  timezone: string;
  linkTitle?: string;
  hostName?: string;
  hostEmail?: string;
  onReschedule?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}

function formatDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatTimeRange(startIso: string, endIso: string, timezone: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6 py-2.5">
      <span className="w-28 shrink-0 text-[13px] text-foreground-secondary">{label}</span>
      <div className="flex-1 text-[13px] text-foreground">{children}</div>
    </div>
  );
}

// Monochrome calendar icons — cal.com style
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12.22C21 11.6 20.95 11 20.86 10.42H12V13.84H17.07C16.84 14.97 16.19 15.93 15.22 16.57V18.82H18.22C19.95 17.25 21 14.94 21 12.22Z" fill="currentColor" fillOpacity="0.9"/>
      <path d="M12 21C14.43 21 16.47 20.19 18.22 18.82L15.22 16.57C14.43 17.1 13.31 17.43 12 17.43C9.65 17.43 7.67 15.85 6.97 13.72H3.87V16.04C5.61 19.5 8.57 21 12 21Z" fill="currentColor" fillOpacity="0.7"/>
      <path d="M6.97 13.72C6.79 13.19 6.69 12.62 6.69 12C6.69 11.38 6.79 10.81 6.97 10.28V7.96H3.87C3.32 9.07 3 10.5 3 12C3 13.5 3.32 14.93 3.87 16.04L6.97 13.72Z" fill="currentColor" fillOpacity="0.6"/>
      <path d="M12 6.57C13.43 6.57 14.71 7.07 15.72 8.02L18.29 5.45C16.47 3.77 14.43 3 12 3C8.57 3 5.61 4.5 3.87 7.96L6.97 10.28C7.67 8.15 9.65 6.57 12 6.57Z" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4L4 6.5V17.5L14 20V4Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
      <ellipse cx="9" cy="12" rx="2.5" ry="3" fill="currentColor"/>
      <path d="M14 8H20V10H14V8ZM14 11H20V13H14V11ZM14 14H20V16H14V14Z" fill="currentColor" fillOpacity="0.7"/>
    </svg>
  );
}

function Office365Icon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 3L4 6.5V17.5L13 21L13 3Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M13 3L20 6V18L13 21V3Z" fill="currentColor" fillOpacity="0.6"/>
      <path d="M7 10H11V11H7V10ZM7 12H11V13H7V12ZM7 14H11V15H7V14Z" fill="currentColor"/>
    </svg>
  );
}

function ICalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 2V5M16 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 14L10.5 16.5L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookingConfirmation({
  confirmation,
  timezone,
  linkTitle,
  hostName,
  hostEmail,
  onReschedule,
  onCancel,
  isPending,
}: BookingConfirmationProps) {
  const { booking } = confirmation;
  const conferencingUrl = confirmation.conferencing_url || booking.conferencing_url;

  const dateStr = formatDate(booking.start_time, timezone);
  const timeRange = formatTimeRange(booking.start_time, booking.end_time, timezone);
  const tzLabel = booking.guest_timezone || timezone;

  const gcalUrl = buildGoogleCalendarUrl(confirmation, linkTitle);
  const office365Url = buildOffice365Url(confirmation, linkTitle);
  const outlookComUrl = buildOutlookComUrl(confirmation, linkTitle);

  return (
    <div className="flex flex-col w-full">
      {/* Top section with padding */}
      <div className="flex flex-col items-center gap-4 text-center px-6 pt-6 pb-4 desktop:px-8 desktop:pt-8">
        {/* Success icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
          <Check className="h-6 w-6 text-success" strokeWidth={2.5} />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">
            {isPending ? 'Confirming...' : 'This meeting is scheduled'}
          </h2>
          <p className="text-[13px] text-foreground-muted">
            We sent an email with a calendar invitation with the details to everyone.
          </p>
        </div>
      </div>

      {/* Detail rows — border-t goes edge-to-edge */}
      <div className="border-t border-border px-6 desktop:px-8 pt-1 pb-2">
        {linkTitle && (
          <DetailRow label="What">{linkTitle}</DetailRow>
        )}

        <DetailRow label="When">
          <span>{dateStr}</span>
          <br />
          <span className="text-foreground-secondary">{timeRange} ({tzLabel})</span>
        </DetailRow>

        <DetailRow label="Who">
          <div className="flex flex-col gap-2">
            {(hostName || hostEmail) && (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{hostName ?? hostEmail}</span>
                {hostEmail && hostName && <span className="text-foreground-secondary text-[12px]">{hostEmail}</span>}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{booking.guest_name}</span>
              <span className="text-foreground-secondary text-[12px]">{booking.guest_email}</span>
            </div>
          </div>
        </DetailRow>

        {conferencingUrl && (
          <DetailRow label="Where">
            <a
              href={conferencingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-2 inline-flex items-center gap-1"
            >
              {conferencingUrl.includes('meet.google') ? 'Google Meet' :
               conferencingUrl.includes('zoom.us') ? 'Zoom' : 'Video call'}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </DetailRow>
        )}
      </div>

      {/* Need to make a change */}
      {(onReschedule || onCancel) && (
        <div className="px-6 desktop:px-8 py-3 text-center">
          <span className="text-[13px] text-foreground-secondary">Need to make a change?{' '}</span>
          {onReschedule && (
            <button
              type="button"
              onClick={onReschedule}
              disabled={isPending}
              className="text-[13px] text-foreground-secondary underline underline-offset-2 hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Reschedule
            </button>
          )}
          {onReschedule && onCancel && (
            <span className="text-[13px] text-foreground-muted mx-2">or</span>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="text-[13px] text-foreground-secondary underline underline-offset-2 hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Add to calendar */}
      <div className="mx-6 desktop:mx-8 border-t border-border pt-4 pb-4 flex items-center justify-center gap-3">
        <span className="text-[13px] text-foreground-secondary shrink-0">Add to calendar</span>
        <div className="flex items-center gap-1.5">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Google Calendar"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            <GoogleIcon />
          </a>
          <a
            href={office365Url}
            target="_blank"
            rel="noopener noreferrer"
            title="Office 365"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            <Office365Icon />
          </a>
          <a
            href={outlookComUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Outlook.com"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            <OutlookIcon />
          </a>
          <button
            type="button"
            title="Download .ics"
            onClick={() => downloadICS(confirmation, linkTitle)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            <ICalIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
