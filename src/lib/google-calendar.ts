import { google, calendar_v3 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Service account credentials from env
const credentials = process.env.GOOGLE_CALENDAR_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS)
  : null;

const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

function getAuth() {
  if (!credentials) return null;
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
    subject: process.env.GOOGLE_CALENDAR_SUBJECT || undefined,
  });
}

function getCalendar(): calendar_v3.Calendar | null {
  const auth = getAuth();
  if (!auth) return null;
  return google.calendar({ version: "v3", auth });
}

export function isCalendarConfigured(): boolean {
  return !!credentials;
}

/**
 * Create a Google Calendar event for an interview
 */
export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startTime: Date;
  durationMinutes: number;
  attendeeEmail: string;
  location?: string;
}): Promise<{ eventId: string; calendarLink: string } | null> {
  const cal = getCalendar();
  if (!cal) return null;

  const endTime = new Date(
    params.startTime.getTime() + params.durationMinutes * 60 * 1000
  );

  try {
    const event = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: params.summary,
        description: `${params.description}\n\nCandidate: ${params.attendeeEmail}`,
        location: params.location || "Video Call",
        start: {
          dateTime: params.startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 15 },
          ],
        },
      },
    });

    return {
      eventId: event.data.id || "",
      calendarLink: event.data.htmlLink || "",
    };
  } catch (err) {
    console.error("Google Calendar error:", err);
    return null;
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string
): Promise<boolean> {
  const cal = getCalendar();
  if (!cal) return false;
  try {
    await cal.events.delete({ calendarId, eventId, sendUpdates: "all" });
    return true;
  } catch (err) {
    console.error("Google Calendar delete error:", err);
    return false;
  }
}

/**
 * Check free/busy for available slots
 */
export async function getFreeBusySlots(
  timeMin: Date,
  timeMax: Date
): Promise<{ start: string; end: string }[]> {
  const cal = getCalendar();
  if (!cal) return [];

  try {
    const resp = await cal.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busy = resp.data.calendars?.[calendarId]?.busy || [];
    return busy.map((b) => ({
      start: b.start || "",
      end: b.end || "",
    }));
  } catch (err) {
    console.error("Google Calendar free/busy error:", err);
    return [];
  }
}
