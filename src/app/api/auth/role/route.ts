import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";

// Role selection is owned by the Flutter signup flow, not this backend.
// Keeping the endpoint so the Flutter app can introspect it if needed.
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  return NextResponse.json(
    { error: "Role changes are managed by the Flutter app." },
    { status: 501 }
  );
}
