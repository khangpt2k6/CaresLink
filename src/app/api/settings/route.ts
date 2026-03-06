import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULTS = { id: "default", timezone: "America/New_York", defaultDuration: 60, videoPlatform: "jitsi", videoLink: null };
const VALID_DURATIONS = [30, 45, 60, 90];
const VALID_PLATFORMS = ["jitsi", "zoom", "google_meet", "ms_teams"];

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

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const settings = await (prisma.settings as any).upsert({
      where: { id: "default" },
      update,
      create: { id: "default", timezone: timezone || "America/New_York", defaultDuration: defaultDuration || 60, videoPlatform: videoPlatform || "jitsi", videoLink: videoLink || null },
    });

    return NextResponse.json(settings);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
