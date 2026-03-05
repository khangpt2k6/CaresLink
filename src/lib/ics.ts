export function generateICS(params: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  organizer?: { name: string; email: string };
  attendee?: { name: string; email: string };
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const method = params.organizer && params.attendee ? "REQUEST" : "PUBLISH";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CaresLink//Interview//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `DTSTART:${fmt(params.startTime)}`,
    `DTEND:${fmt(params.endTime)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`,
    params.location ? `LOCATION:${params.location}` : "",
    `UID:${Date.now()}@careslink`,
    `DTSTAMP:${fmt(new Date())}`,
    "SEQUENCE:0",
    "STATUS:CONFIRMED",
    params.organizer
      ? `ORGANIZER;CN=${params.organizer.name}:MAILTO:${params.organizer.email}`
      : "",
    params.attendee
      ? `ATTENDEE;RSVP=TRUE;CN=${params.attendee.name}:MAILTO:${params.attendee.email}`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.title);
  url.searchParams.set("details", params.description);
  url.searchParams.set(
    "dates",
    `${fmt(params.startTime)}/${fmt(params.endTime)}`
  );
  if (params.location) url.searchParams.set("location", params.location);
  return url.toString();
}

export function buildOutlookUrl(params: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}): string {
  const url = new URL(
    "https://outlook.live.com/calendar/0/deeplink/compose"
  );
  url.searchParams.set("subject", params.title);
  url.searchParams.set("body", params.description);
  url.searchParams.set("startdt", params.startTime.toISOString());
  url.searchParams.set("enddt", params.endTime.toISOString());
  if (params.location) url.searchParams.set("location", params.location);
  url.searchParams.set("path", "/calendar/action/compose");
  return url.toString();
}
