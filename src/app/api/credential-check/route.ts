import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";

// Flutter's production Supabase does not have a CredentialCheck table.
// Endpoint is stubbed until a backing schema is agreed (either a new
// Supabase migration or storing results in ai_usage_log).

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return NextResponse.json(
    { error: "credential-check is not wired to Flutter production DB yet." },
    { status: 501 }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return NextResponse.json({ checks: [] });
}
