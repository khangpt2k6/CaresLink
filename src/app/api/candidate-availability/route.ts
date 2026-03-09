import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET — fetch candidate's weekly availability
export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  try {
    const availability = await prisma.candidateAvailability.findMany({
      where: { userId: user.id },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(availability);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}

// PUT — update candidate's weekly availability (bulk)
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  try {
    const body = await req.json();
    const { schedule } = body as {
      schedule: { dayOfWeek: number; startHour: number; endHour: number; enabled: boolean }[];
    };

    if (!schedule || !Array.isArray(schedule)) {
      return NextResponse.json({ error: "schedule array required" }, { status: 400 });
    }

    for (const day of schedule) {
      const startHour = Math.round(day.startHour * 2) / 2;
      const endHour = Math.round(day.endHour * 2) / 2;

      if (day.enabled && startHour >= endHour) {
        return NextResponse.json(
          { error: `Invalid hours for day ${day.dayOfWeek}: start must be before end` },
          { status: 400 }
        );
      }

      await prisma.candidateAvailability.upsert({
        where: { userId_dayOfWeek: { userId: user.id, dayOfWeek: day.dayOfWeek } },
        update: { startHour, endHour, enabled: day.enabled },
        create: { userId: user.id, dayOfWeek: day.dayOfWeek, startHour, endHour, enabled: day.enabled },
      });
    }

    const updated = await prisma.candidateAvailability.findMany({
      where: { userId: user.id },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
