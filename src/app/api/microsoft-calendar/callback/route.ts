import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/microsoft-calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/calendar?mscal=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${APP_URL}/calendar?mscal=error&reason=no_code`
    );
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(`${APP_URL}/calendar?mscal=connected`);
  } catch (err) {
    console.error("Microsoft Calendar OAuth callback error:", err);
    return NextResponse.redirect(
      `${APP_URL}/calendar?mscal=error&reason=token_exchange_failed`
    );
  }
}
