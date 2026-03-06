import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return NextResponse.json(settings || { id: "default", timezone: "America/New_York" });
  } catch {
    return NextResponse.json({ id: "default", timezone: "America/New_York" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json({ error: "timezone is required" }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: { timezone },
      create: { id: "default", timezone },
    });

    return NextResponse.json(settings);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
