import { NextResponse } from "next/server";
import {
  getConnectionStatus,
  getOAuthUrl,
  disconnectCalendar,
} from "@/lib/microsoft-calendar";

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
      {
        error:
          "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
      },
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
