import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";

export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}
