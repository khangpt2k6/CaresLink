/**
 * Test script: Create a Google Meet link using saved OAuth token + send via Resend
 * Run: npx tsx scripts/test-meet-and-email.ts
 */

import { google } from "googleapis";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/google-calendar/callback`;

async function getAuthenticatedClient() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // Load token from database (saved by your app's OAuth callback)
  const token = await prisma.googleCalendarToken.findUnique({ where: { id: "default" } });
  if (!token) {
    throw new Error("No OAuth token found in DB. Connect Google Calendar in your app first.");
  }

  oauth2.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // Refresh if expired
  if (token.expiresAt.getTime() < Date.now()) {
    console.log("🔄 Refreshing expired token...");
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
    await prisma.googleCalendarToken.update({
      where: { id: "default" },
      data: {
        accessToken: credentials.access_token || token.accessToken,
        expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
      },
    });
  }

  console.log(`✅ Authenticated as: ${token.email || "unknown"}\n`);
  return oauth2;
}

async function createMeetEvent(auth: any) {
  console.log("📅 Creating Google Calendar event with Google Meet link...\n");

  const cal = google.calendar({ version: "v3", auth });

  const start = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min

  const requestId = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const event = await cal.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,
    requestBody: {
      summary: "Test Interview - Software Engineer",
      description: "This is a test interview booking created by CaresLink.\n\nCandidate: 2006tuankhang@gmail.com",
      start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
      end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      attendees: [{ email: "2006tuankhang@gmail.com" }],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 15 }],
      },
    },
  });

  // Extract Meet link
  let meetLink =
    event.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri || event.data.hangoutLink || null;

  // Retry if pending
  if (!meetLink && event.data.id) {
    console.log("⏳ Meet link pending, retrying in 2s...");
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await cal.events.get({ calendarId: CALENDAR_ID, eventId: event.data.id });
    meetLink =
      updated.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video"
      )?.uri || updated.data.hangoutLink || null;
  }

  console.log("✅ Event created!");
  console.log(`   Event ID:      ${event.data.id}`);
  console.log(`   Calendar link: ${event.data.htmlLink}`);
  console.log(`   Meet link:     ${meetLink || "❌ NOT GENERATED"}`);
  console.log(`   Start:         ${start.toLocaleString()}`);
  console.log(`   End:           ${end.toLocaleString()}`);
  console.log();

  return { meetLink, start, end };
}

async function sendEmailWithMeetLink(meetLink: string | null, start: Date, end: Date) {
  if (!RESEND_API_KEY) {
    console.log("⚠️  RESEND_API_KEY not set — skipping email");
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const to = "2006tuankhang@gmail.com";

  const formattedDate = start.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = start.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Interview Confirmed!</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Hi there! Your interview has been scheduled.
        </p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Position</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">Software Engineer</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedTime} (30 min)</td>
            </tr>
            ${meetLink ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Video Call</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="${meetLink}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${meetLink}</a>
              </td>
            </tr>` : ""}
          </table>
        </div>
        ${meetLink ? `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${meetLink}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Join Google Meet
          </a>
        </div>` : `
        <div style="text-align: center; margin: 25px 0; padding: 15px; background: #fef3c7; border-radius: 8px;">
          <p style="color: #92400e; margin: 0;">Google Meet link could not be auto-generated. The interviewer will share the link separately.</p>
        </div>`}
        <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 20px;">
          Sent by CaresLink
        </p>
      </div>
    </div>
  `;

  console.log(`📧 Sending interview email to ${to}...`);

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: `Interview Confirmed - Software Engineer - ${formattedDate}`,
    html,
    text: `Interview Confirmed!\n\nPosition: Software Engineer\nDate: ${formattedDate}\nTime: ${formattedTime}\n${meetLink ? `Meet Link: ${meetLink}` : "Meet link will be shared separately."}\n\n- CaresLink`,
  });

  if (error) {
    console.log(`❌ Email failed: ${error.message}`);
  } else {
    console.log(`✅ Email sent! ID: ${data?.id}`);
  }
}

async function main() {
  console.log("=".repeat(50));
  console.log("  CaresLink — Test Meet Link + Email");
  console.log("=".repeat(50));
  console.log();

  try {
    const auth = await getAuthenticatedClient();
    const { meetLink, start, end } = await createMeetEvent(auth);
    await sendEmailWithMeetLink(meetLink, start, end);
  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    if (err.errors) console.error("   Details:", JSON.stringify(err.errors, null, 2));
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(50));
}

main();
