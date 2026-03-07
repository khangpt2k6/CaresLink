import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Sanitize hour values — detect corrupted denormalized floats and clamp to valid range
function sanitizeHour(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 24) return fallback;
  // Detect denormalized floats from Int/Float column mismatch (e.g. 3.5e-323)
  if (value > 0 && value < 0.01) return fallback;
  return Math.round(value * 2) / 2; // Round to nearest 0.5
}

// GET — fetch weekly availability (auto-heals corrupted data)
export async function GET() {
  try {
    const availability = await prisma.availability.findMany({
      orderBy: { dayOfWeek: "asc" },
    });

    // Auto-heal corrupted rows
    let healed = false;
    for (const day of availability) {
      const cleanStart = sanitizeHour(day.startHour, day.enabled ? 9 : 0);
      const cleanEnd = sanitizeHour(day.endHour, day.enabled ? 17 : 0);
      if (cleanStart !== day.startHour || cleanEnd !== day.endHour) {
        await prisma.availability.update({
          where: { dayOfWeek: day.dayOfWeek },
          data: { startHour: cleanStart, endHour: cleanEnd },
        });
        day.startHour = cleanStart;
        day.endHour = cleanEnd;
        healed = true;
      }
    }
    if (healed) console.log("Auto-healed corrupted availability data");

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
      // Sanitize incoming values
      const startHour = sanitizeHour(day.startHour, day.enabled ? 9 : 0);
      const endHour = sanitizeHour(day.endHour, day.enabled ? 17 : 0);

      if (day.enabled && startHour >= endHour) {
        return NextResponse.json(
          { error: `Invalid hours for day ${day.dayOfWeek}: start must be before end` },
          { status: 400 }
        );
      }
      await prisma.availability.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: { startHour, endHour, enabled: day.enabled },
        create: { dayOfWeek: day.dayOfWeek, startHour, endHour, enabled: day.enabled },
      });
    }

    const updated = await prisma.availability.findMany({ orderBy: { dayOfWeek: "asc" } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
