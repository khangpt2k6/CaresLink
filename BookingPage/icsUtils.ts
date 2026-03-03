import type { BookingConfirmationResponse } from './types';

export function buildGoogleCalendarUrl(
  confirmation: BookingConfirmationResponse,
  linkTitle?: string,
): string {
  const { booking } = confirmation;
  const conferencingUrl = confirmation.conferencing_url || booking.conferencing_url;
  const title = linkTitle || 'Meeting';

  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(booking.start_time)}/${fmt(booking.end_time)}`,
    add: booking.guest_email,
  });

  if (conferencingUrl) {
    params.set('location', conferencingUrl);
    params.set('details', `Join video call: ${conferencingUrl}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOffice365Url(
  confirmation: BookingConfirmationResponse,
  linkTitle?: string,
): string {
  const { booking } = confirmation;
  const conferencingUrl = confirmation.conferencing_url || booking.conferencing_url;
  const title = linkTitle || 'Meeting';

  const params = new URLSearchParams({
    subject: title,
    startdt: new Date(booking.start_time).toISOString(),
    enddt: new Date(booking.end_time).toISOString(),
    ...(conferencingUrl ? { location: conferencingUrl, body: `Join video call: ${conferencingUrl}` } : {}),
  });

  return `https://outlook.office.com/calendar/deeplink/compose?${params.toString()}`;
}

export function buildOutlookComUrl(
  confirmation: BookingConfirmationResponse,
  linkTitle?: string,
): string {
  const { booking } = confirmation;
  const conferencingUrl = confirmation.conferencing_url || booking.conferencing_url;
  const title = linkTitle || 'Meeting';

  const params = new URLSearchParams({
    subject: title,
    startdt: new Date(booking.start_time).toISOString(),
    enddt: new Date(booking.end_time).toISOString(),
    ...(conferencingUrl ? { location: conferencingUrl, body: `Join video call: ${conferencingUrl}` } : {}),
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function fmtISOForICS(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function generateICSContent(
  confirmation: BookingConfirmationResponse,
  linkTitle?: string,
): string {
  const { booking } = confirmation;
  const conferencingUrl = confirmation.conferencing_url || booking.conferencing_url;
  const title = linkTitle || 'Meeting';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slashy//Slashy//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${booking.id}@slashy.com`,
    `DTSTAMP:${fmtISOForICS(new Date().toISOString())}`,
    `DTSTART:${fmtISOForICS(booking.start_time)}`,
    `DTEND:${fmtISOForICS(booking.end_time)}`,
    `SUMMARY:${title}`,
    `ATTENDEE;CN=${booking.guest_name};RSVP=TRUE:mailto:${booking.guest_email}`,
  ];

  if (conferencingUrl) {
    lines.push(`LOCATION:${conferencingUrl}`);
    lines.push(`DESCRIPTION:Join video call: ${conferencingUrl}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Downloads an ICS file for the booking.
 * Uses the server-provided URL if available (preferred),
 * otherwise generates the ICS content client-side as a fallback.
 */
export function downloadICS(
  confirmation: BookingConfirmationResponse,
  linkTitle?: string,
): void {
  // Prefer server-generated ICS when backend provides it
  if (confirmation.ics_url) {
    const a = document.createElement('a');
    a.href = confirmation.ics_url;
    a.download = 'meeting.ics';
    a.click();
    return;
  }

  // Client-side fallback
  const content = generateICSContent(confirmation, linkTitle);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meeting.ics';
  a.click();
  URL.revokeObjectURL(url);
}
