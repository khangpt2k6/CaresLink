import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";

// Stubbed — see ../route.ts for rationale.
export async function GET(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return NextResponse.json(
    { error: "credential-check is not wired to Flutter production DB yet." },
    { status: 501 }
  );
}
