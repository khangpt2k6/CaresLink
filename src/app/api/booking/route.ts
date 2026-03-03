import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scheduleInterview } from "@/lib/scheduling";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, position, scheduledAt, duration = 60 } = body;

    if (!name || !email || !position || !scheduledAt) {
      return NextResponse.json(
        { error: "name, email, position, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Interview must be scheduled in the future" },
        { status: 400 }
      );
    }

    // Find existing candidate by email or create new
    let candidate = await prisma.candidate.findFirst({ where: { email } });

    if (candidate) {
      if (candidate.position !== position) {
        candidate = await prisma.candidate.update({
          where: { id: candidate.id },
          data: { position, phone: phone || candidate.phone },
        });
      }
    } else {
      candidate = await prisma.candidate.create({
        data: { name, email, phone: phone || null, position },
      });
    }

    const interview = await scheduleInterview(
      candidate.id,
      scheduledDate,
      duration,
      "Video Call"
    );

    await prisma.event.create({
      data: {
        type: "self_booked",
        candidateId: candidate.id,
        interviewId: interview.id,
        metadata: JSON.stringify({
          source: "public_booking_page",
          scheduledAt: scheduledDate.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        duration: interview.duration,
        meetLink: interview.meetLink,
        calendarLink: interview.calendarLink,
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to book interview" },
      { status: 500 }
    );
  }
}
