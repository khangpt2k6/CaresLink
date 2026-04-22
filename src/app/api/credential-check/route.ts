import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/credential-check — list current employer's credential checks.
// Optional ?limit=50.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    200
  );

  const rows = await prisma.credential_checks.findMany({
    where: { created_by_user_id: auth.user.id },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return NextResponse.json({ checks: rows });
}
