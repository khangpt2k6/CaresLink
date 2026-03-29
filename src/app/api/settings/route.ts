import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isProviderAvailable, getGroqModels, type AIProvider } from "@/lib/ai-provider";

const DEFAULTS = { id: "default", timezone: "America/New_York", defaultDuration: 60, videoPlatform: "jitsi", videoLink: null, aiProvider: "anthropic", groqModel: null };
const VALID_DURATIONS = [30, 45, 60, 90];
const VALID_PLATFORMS = ["jitsi", "zoom", "google_meet", "ms_teams"];
const VALID_AI_PROVIDERS = ["anthropic", "groq"];

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return NextResponse.json(settings || DEFAULTS);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { timezone, defaultDuration, videoPlatform, videoLink } = body;

    const update: Record<string, unknown> = {};
    if (timezone) update.timezone = timezone;
    if (defaultDuration !== undefined) {
      if (!VALID_DURATIONS.includes(defaultDuration)) {
        return NextResponse.json({ error: "Duration must be 30, 45, 60, or 90 minutes" }, { status: 400 });
      }
      update.defaultDuration = defaultDuration;
    }
    if (videoPlatform !== undefined) {
      if (!VALID_PLATFORMS.includes(videoPlatform)) {
        return NextResponse.json({ error: "Invalid video platform" }, { status: 400 });
      }
      update.videoPlatform = videoPlatform;
    }
    if (videoLink !== undefined) {
      update.videoLink = videoLink || null;
    }
    if (body.aiProvider !== undefined) {
      if (!VALID_AI_PROVIDERS.includes(body.aiProvider)) {
        return NextResponse.json({ error: "AI provider must be 'anthropic' or 'groq'" }, { status: 400 });
      }
      if (!isProviderAvailable(body.aiProvider as AIProvider)) {
        const keyName = body.aiProvider === "groq" ? "GROQ_API_KEY" : "ANTHROPIC_API_KEY";
        return NextResponse.json({ error: `${keyName} is not configured. Add it to your .env file.` }, { status: 400 });
      }
      update.aiProvider = body.aiProvider;
    }
    if (body.groqModel !== undefined) {
      const validModels = getGroqModels().map((m) => m.id);
      if (body.groqModel && !validModels.includes(body.groqModel)) {
        return NextResponse.json({ error: `Invalid Groq model. Valid: ${validModels.join(", ")}` }, { status: 400 });
      }
      update.groqModel = body.groqModel || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update,
      create: { id: "default", timezone: timezone || "America/New_York", defaultDuration: defaultDuration || 60, videoPlatform: videoPlatform || "jitsi", videoLink: videoLink || null, aiProvider: body.aiProvider || "anthropic", groqModel: body.groqModel || null },
    });

    return NextResponse.json(settings);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
