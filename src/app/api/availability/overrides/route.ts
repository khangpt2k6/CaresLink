import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — fetch date overrides for a month
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // e.g. "2026-03"

  try {
    const where = month
      ? {
          date: {
            gte: new Date(`${month}-01`),
            lt: new Date(
              new Date(`${month}-01`).getFullYear(),
              new Date(`${month}-01`).getMonth() + 1,
              1
            ),
          },
        }
      : {};

    const overrides = await prisma.dateOverride.findMany({
      where,
      orderBy: { date: "asc" },
    });
    return NextResponse.json(overrides);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 });
  }
}

// POST — create or update a date override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, available, startHour, endHour, reason } = body;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const override = await prisma.dateOverride.upsert({
      where: { date: dateObj },
      update: { available, startHour, endHour, reason },
      create: { date: dateObj, available, startHour, endHour, reason },
    });

    return NextResponse.json(override);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }
}

// DELETE — remove a date override
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.dateOverride.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete override" }, { status: 500 });
  }
}
