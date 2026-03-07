import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "./db";
import { getTimezone } from "./timezone";

const SCOPES = ["Calendars.ReadWrite", "User.Read", "OnlineMeetings.ReadWrite"];

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MS_TENANT_ID = process.env.MICROSOFT_TENANT_ID || "common"; // "common" supports personal + work accounts
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/microsoft-calendar/callback`;

function getMsalClient(): ConfidentialClientApplication | null {
  if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) return null;
  return new ConfidentialClientApplication({
    auth: {
      clientId: MS_CLIENT_ID,
      clientSecret: MS_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${MS_TENANT_ID}`,
    },
  });
}

export function getOAuthUrl(): string | null {
  const client = getMsalClient();
  if (!client) return null;
  // Build the auth URL manually since MSAL node needs async for getAuthCodeUrl
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    response_mode: "query",
    prompt: "consent",
  });
  return `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const client = getMsalClient();
  if (!client) throw new Error("Microsoft OAuth not configured");

  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  if (!result || !result.accessToken) {
    throw new Error("Failed to get tokens from Microsoft");
  }

  // Get user email from the token claims or Graph API
  const graphClient = Client.init({
    authProvider: (done) => done(null, result.accessToken),
  });
  const me = await graphClient.api("/me").select("mail,userPrincipalName").get();
  const email = me.mail || me.userPrincipalName || null;

  // We need to store the refresh token - get it from the cache
  const tokenCache = client.getTokenCache().serialize();
  const cacheData = JSON.parse(tokenCache);
  const refreshTokens = cacheData.RefreshToken || {};
  const refreshToken = Object.values(refreshTokens)[0] as { secret?: string } | undefined;

  await prisma.microsoftCalendarToken.upsert({
    where: { id: "default" },
    update: {
      accessToken: result.accessToken,
      refreshToken: refreshToken?.secret || "",
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      email,
    },
    create: {
      id: "default",
      accessToken: result.accessToken,
      refreshToken: refreshToken?.secret || "",
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      email,
    },
  });

  return { email };
}

export async function disconnectCalendar() {
  try {
    await prisma.microsoftCalendarToken.delete({ where: { id: "default" } });
  } catch {
    // Already disconnected
  }
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  email?: string;
}> {
  try {
    const token = await prisma.microsoftCalendarToken.findUnique({
      where: { id: "default" },
    });
    if (token) return { connected: true, email: token.email || undefined };
  } catch {
    // Table might not exist yet
  }
  return { connected: false };
}

async function getGraphClient(): Promise<Client | null> {
  let token;
  try {
    token = await prisma.microsoftCalendarToken.findUnique({
      where: { id: "default" },
    });
  } catch {
    return null;
  }
  if (!token) return null;

  let accessToken = token.accessToken;

  // Auto-refresh if expired
  if (token.expiresAt.getTime() < Date.now()) {
    const msalClient = getMsalClient();
    if (!msalClient || !token.refreshToken) return null;

    try {
      const result = await msalClient.acquireTokenByRefreshToken({
        refreshToken: token.refreshToken,
        scopes: SCOPES,
      });

      if (result) {
        accessToken = result.accessToken;

        // Update stored tokens
        const tokenCache = msalClient.getTokenCache().serialize();
        const cacheData = JSON.parse(tokenCache);
        const refreshTokens = cacheData.RefreshToken || {};
        const newRefreshToken = Object.values(refreshTokens)[0] as { secret?: string } | undefined;

        await prisma.microsoftCalendarToken.update({
          where: { id: "default" },
          data: {
            accessToken: result.accessToken,
            refreshToken: newRefreshToken?.secret || token.refreshToken,
            expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
          },
        });
      }
    } catch (err) {
      console.error("Failed to refresh Microsoft token:", err);
      return null;
    }
  }

  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function isCalendarConfigured(): Promise<boolean> {
  const status = await getConnectionStatus();
  return status.connected;
}

/**
 * Create a Microsoft Outlook/365 Calendar event
 */
export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startTime: Date;
  durationMinutes: number;
  attendeeEmail: string;
  location?: string;
}): Promise<{
  eventId: string;
  calendarLink: string;
  meetLink: string | null;
} | null> {
  const client = await getGraphClient();
  if (!client) return null;

  const endTime = new Date(
    params.startTime.getTime() + params.durationMinutes * 60 * 1000
  );

  try {
    const tz = await getTimezone();

    const event = await client.api("/me/events").post({
      subject: params.summary,
      body: {
        contentType: "HTML",
        content: params.description.replace(/\n/g, "<br/>"),
      },
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: tz,
      },
      location: {
        displayName: params.location || "Video Call",
      },
      attendees: [
        {
          emailAddress: { address: params.attendeeEmail },
          type: "required",
        },
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      allowNewTimeProposals: true,
    });

    const meetLink = event.onlineMeeting?.joinUrl || null;

    return {
      eventId: event.id || "",
      calendarLink: event.webLink || "",
      meetLink,
    };
  } catch (err) {
    console.error("Microsoft Calendar error:", err);
    return null;
  }
}

/**
 * Delete a Microsoft calendar event
 */
export async function deleteCalendarEvent(
  eventId: string
): Promise<boolean> {
  const client = await getGraphClient();
  if (!client) return false;
  try {
    await client.api(`/me/events/${eventId}`).delete();
    return true;
  } catch (err) {
    console.error("Microsoft Calendar delete error:", err);
    return false;
  }
}

/**
 * Get free/busy slots from Microsoft Calendar
 */
export async function getFreeBusySlots(
  timeMin: Date,
  timeMax: Date
): Promise<{ start: string; end: string }[]> {
  const client = await getGraphClient();
  if (!client) return [];

  try {
    const tz = await getTimezone();

    // Use calendarView to get events in the range
    const events = await client
      .api("/me/calendarView")
      .query({
        startDateTime: timeMin.toISOString(),
        endDateTime: timeMax.toISOString(),
        $select: "start,end,showAs",
        $top: 500,
      })
      .header("Prefer", `outlook.timezone="${tz}"`)
      .get();

    const busy: { start: string; end: string }[] = [];
    for (const event of events.value || []) {
      // Only include events that show as busy/tentative
      if (event.showAs === "free") continue;
      busy.push({
        start: event.start?.dateTime || "",
        end: event.end?.dateTime || "",
      });
    }

    return busy;
  } catch (err) {
    console.error("Microsoft Calendar free/busy error:", err);
    return [];
  }
}
