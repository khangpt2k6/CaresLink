import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/credential-check/[id] — detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.credential_checks.findUnique({ where: { id } });
  if (!row || row.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

// DELETE /api/credential-check/[id] — remove from history
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.credential_checks.findUnique({ where: { id } });
  if (!row || row.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.credential_checks.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
