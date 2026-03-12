/**
 * Test: Create Google Meet link + send email via Resend
 *
 * IMPORTANT: Make sure localhost:3000 is NOT running (stop your Next.js dev server first).
 * Run: npx tsx scripts/test-meet-and-email.ts
 */

import { google } from "googleapis";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { execSync } from "child_process";

// Load .env manually
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
// Use the same redirect URI already registered in Google Cloud Console
const REDIRECT_URI = "http://localhost:3000/api/google-calendar/callback";
const TOKEN_FILE = path.resolve(__dirname, ".oauth-token.json");

function saveToken(tokens: any) { fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2)); }
function loadToken(): any | null { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")); } catch { return null; } }

function waitForCode(oauth2: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:3000`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Error: ${error}</h1><p>Close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <div style="font-family:Arial;text-align:center;padding:60px">
            <h1 style="color:#22c55e;font-size:48px">&#10003;</h1>
            <h2>Authorized Successfully!</h2>
            <p style="color:#6b7280">You can close this tab. Check your terminal for results.</p>
          </div>
        `);
        server.close();
        resolve(code);
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<p>Waiting for OAuth callback...</p>");
    });

    server.listen(3000, () => {
      const authUrl = oauth2.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/calendar"],
      });
      console.log("🔗 Opening browser for Google authorization...\n");
      console.log(`   If browser doesn't open, visit:\n   ${authUrl}\n`);
      try {
        execSync(`start "" "${authUrl}"`, { stdio: "ignore" });
      } catch {
        // Couldn't auto-open
      }
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error("Port 3000 is in use! Stop your Next.js dev server first, then re-run."));
      } else {
        reject(err);
      }
    });

    setTimeout(() => { server.close(); reject(new Error("OAuth timeout (60s)")); }, 60000);
  });
}

async function getAuth() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const saved = loadToken();
  if (saved) {
    oauth2.setCredentials(saved);
    if (saved.expiry_date && saved.expiry_date < Date.now()) {
      console.log("🔄 Refreshing token...");
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      saveToken(credentials);
    }
    console.log("✅ Using saved OAuth token\n");
    return oauth2;
  }

  const code = await waitForCode(oauth2);
  console.log("🔑 Exchanging code for token...");
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  saveToken(tokens);
  console.log("✅ Token saved!\n");
  return oauth2;
}

async function createMeetEvent(auth: any) {
  console.log("📅 Creating Calendar event with Google Meet...\n");
  const cal = google.calendar({ version: "v3", auth });

  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const requestId = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const event = await cal.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,
    requestBody: {
      summary: "Test Interview - Software Engineer",
      description: "Test interview booking by CaresLink.\nCandidate: 2006tuankhang@gmail.com",
      start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
      end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      attendees: [{ email: "2006tuankhang@gmail.com" }],
      conferenceData: {
        createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
    },
  });

  let meetLink =
    event.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri
    || event.data.hangoutLink || null;

  if (!meetLink && event.data.id) {
    console.log("⏳ Meet link pending, retrying...");
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await cal.events.get({ calendarId: CALENDAR_ID, eventId: event.data.id });
    meetLink =
      updated.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri
      || updated.data.hangoutLink || null;
  }

  console.log("✅ Event created!");
  console.log(`   Event ID:      ${event.data.id}`);
  console.log(`   Calendar link: ${event.data.htmlLink}`);
  console.log(`   Meet link:     ${meetLink || "❌ NOT GENERATED"}`);
  console.log(`   Start:         ${start.toLocaleString()}`);
  console.log(`   End:           ${end.toLocaleString()}\n`);

  return { meetLink, start, end };
}

async function sendEmail(meetLink: string | null, start: Date, end: Date) {
  if (!RESEND_API_KEY) { console.log("⚠️  No RESEND_API_KEY — skipping email"); return; }

  const resend = new Resend(RESEND_API_KEY);
  const to = "2006tuankhang@gmail.com";
  const formattedDate = start.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">Interview Confirmed!</h1>
  </div>
  <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="color:#374151;font-size:16px;line-height:1.6">Hi! Your interview has been scheduled.</p>
    <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#6b7280">Position</td><td style="padding:8px 0;color:#111827;font-weight:600">Software Engineer</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827;font-weight:600">${formattedDate}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;color:#111827;font-weight:600">${formattedTime} (30 min)</td></tr>
        ${meetLink ? `<tr><td style="padding:8px 0;color:#6b7280">Video</td><td style="padding:8px 0"><a href="${meetLink}" style="color:#4f46e5;font-weight:600">${meetLink}</a></td></tr>` : ""}
      </table>
    </div>
    ${meetLink ? `<div style="text-align:center;margin:25px 0"><a href="${meetLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Join Google Meet</a></div>` : ""}
    <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:20px">Sent by CaresLink</p>
  </div>
</div>`;

  console.log(`📧 Sending email to ${to}...`);
  const { data, error } = await resend.emails.send({
    from: RESEND_FROM, to,
    subject: `Interview Confirmed - Software Engineer - ${formattedDate}`,
    html,
    text: `Interview Confirmed!\nPosition: Software Engineer\nDate: ${formattedDate}\nTime: ${formattedTime}\n${meetLink ? `Meet: ${meetLink}` : ""}\n- CaresLink`,
  });

  if (error) console.log(`❌ Email failed: ${error.message}`);
  else console.log(`✅ Email sent! ID: ${data?.id}`);
}

async function main() {
  console.log("==================================================");
  console.log("  CaresLink — Test Meet Link + Email");
  console.log("==================================================\n");

  const auth = await getAuth();
  const { meetLink, start, end } = await createMeetEvent(auth);
  await sendEmail(meetLink, start, end);

  console.log("\n==================================================");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  if (err.errors) console.error("   Details:", JSON.stringify(err.errors, null, 2));
});
