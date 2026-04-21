import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";

export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null;
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name,
    firstName: user.first_name,
    lastName: user.last_name,
    userType: user.user_type,
    role: user.role,
  });
}
