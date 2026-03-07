import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

// GET — fetch candidate's weekly availability
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const availability = await prisma.candidateAvailability.findMany({
      where: { userId: token.sub },
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
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        where: { userId_dayOfWeek: { userId: token.sub, dayOfWeek: day.dayOfWeek } },
        update: { startHour, endHour, enabled: day.enabled },
        create: { userId: token.sub, dayOfWeek: day.dayOfWeek, startHour, endHour, enabled: day.enabled },
      });
    }

    const updated = await prisma.candidateAvailability.findMany({
      where: { userId: token.sub },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
