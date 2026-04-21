import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  const { role } = await req.json();

  if (role !== "EMPLOYER" && role !== "CANDIDATE") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  return NextResponse.json({ success: true });
}
