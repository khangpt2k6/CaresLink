import { NextResponse } from "next/server";
import { getConnectionStatus, getOAuthUrl, disconnectCalendar } from "@/lib/google-calendar";

// GET - check connection status
export async function GET() {
  const status = await getConnectionStatus();
  const oauthUrl = getOAuthUrl();
  return NextResponse.json({ ...status, oauthAvailable: !!oauthUrl });
}

// POST - get OAuth URL to start connection
export async function POST() {
  const url = getOAuthUrl();
  if (!url) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 400 }
    );
  }
  return NextResponse.json({ url });
}

// DELETE - disconnect calendar
export async function DELETE() {
  await disconnectCalendar();
  return NextResponse.json({ success: true });
}
