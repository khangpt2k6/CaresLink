import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Lightweight endpoint — returns just the schedule version number
export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return NextResponse.json({ version: (settings as any)?.scheduleVersion ?? 0 });
  } catch {
    return NextResponse.json({ version: 0 });
  }
}
