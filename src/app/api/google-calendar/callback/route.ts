import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${APP_URL}/calendar?gcal=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/calendar?gcal=error&reason=no_code`);
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(`${APP_URL}/calendar?gcal=connected`);
  } catch (err) {
    console.error("Google Calendar OAuth callback error:", err);
    return NextResponse.redirect(`${APP_URL}/calendar?gcal=error&reason=token_exchange_failed`);
  }
}
