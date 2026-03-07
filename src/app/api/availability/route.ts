import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — fetch weekly availability
export async function GET() {
  try {
    const availability = await prisma.availability.findMany({
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(availability);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}

// PUT — update weekly availability (bulk)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { schedule } = body as {
      schedule: { dayOfWeek: number; startHour: number; endHour: number; enabled: boolean }[];
    };

    if (!schedule || !Array.isArray(schedule)) {
      return NextResponse.json({ error: "schedule array required" }, { status: 400 });
    }

    for (const day of schedule) {
      if (day.enabled && day.startHour >= day.endHour) {
        return NextResponse.json(
          { error: `Invalid hours for day ${day.dayOfWeek}: start must be before end` },
          { status: 400 }
        );
      }
      await prisma.availability.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: {
          startHour: day.startHour,
          endHour: day.endHour,
          enabled: day.enabled,
        },
        create: {
          dayOfWeek: day.dayOfWeek,
          startHour: day.startHour,
          endHour: day.endHour,
          enabled: day.enabled,
        },
      });
    }

    const updated = await prisma.availability.findMany({ orderBy: { dayOfWeek: "asc" } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
