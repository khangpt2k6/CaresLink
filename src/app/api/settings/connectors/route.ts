import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string; // path to icon in /public
  category: "calendar" | "video" | "ai" | "communication" | "infrastructure";
  status: "connected" | "not_connected" | "manual";
  detail?: string; // e.g. connected email, model name
  actionUrl?: string; // OAuth connect URL
  actionLabel?: string;
}

export async function GET() {
  try {
    // Check Google Calendar
    let googleCalConnected = false;
    let googleCalEmail: string | null = null;
    try {
      const token = await prisma.googleCalendarToken.findUnique({ where: { id: "default" } });
      if (token) {
        googleCalConnected = true;
        googleCalEmail = token.email;
      }
    } catch { /* table may not exist */ }
    // Also check service account
    const hasGoogleServiceAccount = !!process.env.GOOGLE_CALENDAR_CREDENTIALS;
    const googleCalStatus = googleCalConnected || hasGoogleServiceAccount;

    // Check Microsoft Calendar
    let msCalConnected = false;
    let msCalEmail: string | null = null;
    try {
      const token = await prisma.microsoftCalendarToken.findUnique({ where: { id: "default" } });
      if (token) {
        msCalConnected = true;
        msCalEmail = token.email;
      }
    } catch { /* table may not exist */ }
    const hasMsCredentials = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

    // Check Settings for video platform
    const settings = await prisma.settings.findUnique({ where: { id: "default" } }).catch(() => null);
    const videoPlatform = (settings as Record<string, unknown>)?.videoPlatform || "jitsi";
    const videoLink = (settings as Record<string, unknown>)?.videoLink as string | null;
    const aiProvider = (settings as Record<string, unknown>)?.aiProvider || "anthropic";

    // Check API keys
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasDeepgramKey = !!process.env.DEEPGRAM_API_KEY;
    const hasResendKey = !!process.env.RESEND_API_KEY;
    const hasCapsolverKey = !!process.env.CAPSOLVER_API_KEY;
    const hasTwilioKey = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
    const hasRedisUrl = !!process.env.REDIS_URL;

    const connectors: Connector[] = [
      // Calendar
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "Sync interviews with Google Calendar",
        icon: "/google-calendar.svg",
        category: "calendar",
        status: googleCalStatus ? "connected" : "not_connected",
        detail: googleCalEmail || (hasGoogleServiceAccount ? "Service account" : undefined),
        actionUrl: "/api/google-calendar",
        actionLabel: "Connect",
      },
      {
        id: "outlook-calendar",
        name: "Outlook Calendar",
        description: "Sync interviews with Microsoft 365",
        icon: "/outlook.svg",
        category: "calendar",
        status: msCalConnected ? "connected" : "not_connected",
        detail: msCalEmail || (hasMsCredentials ? "Credentials configured" : "Not configured"),
        actionUrl: "/api/microsoft-calendar",
        actionLabel: "Connect",
      },

      // Video
      {
        id: "jitsi",
        name: "Jitsi Meet",
        description: "Free video conferencing (default)",
        icon: "/jitsi.png",
        category: "video",
        status: "connected",
        detail: videoPlatform === "jitsi" ? "Active platform" : "Available",
      },
      {
        id: "google-meet",
        name: "Google Meet",
        description: "Video calls via Google Calendar",
        icon: "/google-meet.webp",
        category: "video",
        status: googleCalStatus ? "connected" : "not_connected",
        detail: videoPlatform === "google_meet" ? "Active platform" : googleCalStatus ? "Available" : "Requires Google Calendar",
      },
      {
        id: "zoom",
        name: "Zoom",
        description: "Zoom video meetings",
        icon: "/zoom.webp",
        category: "video",
        status: videoLink && videoPlatform === "zoom" ? "manual" : "not_connected",
        detail: videoPlatform === "zoom" ? "Manual link configured" : "Paste meeting link in General settings",
      },
      {
        id: "ms-teams",
        name: "Microsoft Teams",
        description: "Teams meetings via Outlook Calendar",
        icon: "/teams.webp",
        category: "video",
        status: msCalConnected ? "connected" : "not_connected",
        detail: videoPlatform === "ms_teams" ? "Active platform" : msCalConnected ? "Available" : "Requires Outlook Calendar",
      },

      // AI
      {
        id: "anthropic",
        name: "Anthropic (Claude)",
        description: "Claude Sonnet & Haiku for AI tasks",
        icon: "/Claude_AI_symbol.svg",
        category: "ai",
        status: hasAnthropicKey ? "connected" : "not_connected",
        detail: aiProvider === "anthropic" ? "Active provider" : "Available",
      },
      {
        id: "groq",
        name: "Groq",
        description: "Llama & Mixtral inference",
        icon: "/groq.jpg",
        category: "ai",
        status: hasGroqKey ? "connected" : "not_connected",
        detail: aiProvider === "groq" ? "Active provider" : hasGroqKey ? "Available" : "Add GROQ_API_KEY to .env",
      },
      {
        id: "deepgram",
        name: "Deepgram",
        description: "Real-time speech-to-text for interviews",
        icon: "/deepgram.png",
        category: "ai",
        status: hasDeepgramKey ? "connected" : "not_connected",
        detail: hasDeepgramKey ? "Nova-2 model" : "Add DEEPGRAM_API_KEY to .env",
      },

      // Communication
      {
        id: "resend",
        name: "Resend (Email)",
        description: "Transactional email delivery",
        icon: "/resend.jpg",
        category: "communication",
        status: hasResendKey ? "connected" : "not_connected",
        detail: hasResendKey ? process.env.RESEND_FROM_EMAIL || "Connected" : "Add RESEND_API_KEY to .env",
      },
      {
        id: "slack",
        name: "Slack",
        description: "Get notified on new applicants",
        icon: "/slack.png",
        category: "communication",
        status: "not_connected",
        detail: "Coming soon",
      },
      {
        id: "twilio",
        name: "Twilio (SMS)",
        description: "SMS notifications to candidates",
        icon: "/twilio.jpg",
        category: "communication",
        status: hasTwilioKey ? "connected" : "not_connected",
        detail: hasTwilioKey ? "Credentials configured" : "Add Twilio credentials to .env",
      },

      // Infrastructure
      {
        id: "capsolver",
        name: "CapSolver",
        description: "Auto-solve CAPTCHAs for credential verification",
        icon: "/capsolver.png",
        category: "infrastructure",
        status: hasCapsolverKey ? "connected" : "not_connected",
        detail: hasCapsolverKey ? "Active" : "Add CAPSOLVER_API_KEY to .env",
      },
      {
        id: "redis",
        name: "Upstash Redis",
        description: "Job queue for async tasks & cron",
        icon: "/redis.svg",
        category: "infrastructure",
        status: hasRedisUrl ? "connected" : "not_connected",
        detail: hasRedisUrl ? "BullMQ active" : "Add REDIS_URL to .env",
      },
    ];

    const summary = {
      total: connectors.length,
      connected: connectors.filter((c) => c.status === "connected").length,
      notConnected: connectors.filter((c) => c.status === "not_connected").length,
    };

    return NextResponse.json({ connectors, summary });
  } catch (e) {
    console.error("Failed to fetch connectors:", e);
    return NextResponse.json({ error: "Failed to fetch connectors" }, { status: 500 });
  }
}
