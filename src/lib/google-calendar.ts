import { google, calendar_v3 } from "googleapis";
import { prisma } from "./db";
import { getTimezone } from "./timezone";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Service account credentials from env (legacy)
const saCredentials = process.env.GOOGLE_CALENDAR_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS)
  : null;

const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

// OAuth client credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/google-calendar/callback`;

function getOAuthClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

export function getOAuthUrl(): string | null {
  const client = getOAuthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  if (!client) throw new Error("OAuth not configured");

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to get tokens from Google");
  }

  // Get the connected account email
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  await prisma.googleCalendarToken.upsert({
    where: { id: "default" },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
      email: data.email || null,
    },
    create: {
      id: "default",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
      email: data.email || null,
    },
  });

  return { email: data.email };
}

export async function disconnectCalendar() {
  try {
    await prisma.googleCalendarToken.delete({ where: { id: "default" } });
  } catch {
    // Already disconnected
  }
}

export async function getConnectionStatus(): Promise<{ connected: boolean; email?: string; method?: string }> {
  try {
    const token = await prisma.googleCalendarToken.findUnique({ where: { id: "default" } });
    if (token) return { connected: true, email: token.email || undefined, method: "oauth" };
  } catch {
    // Table might not exist yet
  }
  if (saCredentials) return { connected: true, email: saCredentials.client_email, method: "service_account" };
  return { connected: false };
}

async function getOAuthCalendar(): Promise<calendar_v3.Calendar | null> {
  const client = getOAuthClient();
  if (!client) return null;

  let token;
  try {
    token = await prisma.googleCalendarToken.findUnique({ where: { id: "default" } });
  } catch {
    return null;
  }
  if (!token) return null;

  client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (token.expiresAt.getTime() < Date.now()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await prisma.googleCalendarToken.update({
        where: { id: "default" },
        data: {
          accessToken: credentials.access_token || token.accessToken,
          expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
        },
      });
      client.setCredentials(credentials);
    } catch (err) {
      console.error("Failed to refresh Google token:", err);
      return null;
    }
  }

  return google.calendar({ version: "v3", auth: client });
}

function getServiceAccountCalendar(): calendar_v3.Calendar | null {
  if (!saCredentials) return null;
  const auth = new google.auth.JWT({
    email: saCredentials.client_email,
    key: saCredentials.private_key,
    scopes: SCOPES,
    subject: process.env.GOOGLE_CALENDAR_SUBJECT || undefined,
  });
  return google.calendar({ version: "v3", auth });
}

async function getCalendar(): Promise<calendar_v3.Calendar | null> {
  return (await getOAuthCalendar()) || getServiceAccountCalendar();
}

export async function isCalendarConfigured(): Promise<boolean> {
  const status = await getConnectionStatus();
  return status.connected;
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
}): Promise<{ eventId: string; calendarLink: string; meetLink: string | null } | null> {
  const cal = await getCalendar();
  if (!cal) return null;

  const endTime = new Date(
    params.startTime.getTime() + params.durationMinutes * 60 * 1000
  );

  const meetId = `careslink-${Date.now().toString(36)}`;
  const meetLink = `https://meet.jit.si/${meetId}`;

  try {
    const tz = await getTimezone();
    const event = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: params.summary,
        description: `${params.description}\n\nCandidate: ${params.attendeeEmail}\n\nJoin video call: ${meetLink}`,
        location: meetLink,
        start: {
          dateTime: params.startTime.toISOString(),
          timeZone: tz,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: tz,
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
      meetLink,
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
  const cal = await getCalendar();
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
  const cal = await getCalendar();
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
