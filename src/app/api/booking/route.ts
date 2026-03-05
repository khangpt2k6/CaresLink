import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scheduleInterview } from "@/lib/scheduling";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/sendgrid";
import { generateICS } from "@/lib/ics";
import { format, addMinutes } from "date-fns";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

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
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          position,
          phone: phone || candidate.phone,
          name: name || candidate.name,
        },
      });

      // Auto-cancel any existing upcoming interviews for this candidate
      const existingInterviews = await prisma.interview.findMany({
        where: {
          candidateId: candidate.id,
          completed: false,
          noShow: false,
          cancelled: false,
          scheduledAt: { gt: new Date() },
        },
      });

      for (const old of existingInterviews) {
        if (old.calendarEventId) {
          await deleteCalendarEvent(old.calendarEventId).catch(() => {});
        }
        await prisma.interview.update({
          where: { id: old.id },
          data: { cancelled: true },
        });
        await prisma.event.create({
          data: {
            type: "interview_cancelled",
            candidateId: candidate.id,
            interviewId: old.id,
            metadata: JSON.stringify({ cancelledBy: "reschedule", newSlot: scheduledAt }),
          },
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

    const cancelUrl = `${APP_URL}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(email)}`;
    const confirmUrl = `${APP_URL}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(email)}`;

    // Send confirmation email with ICS calendar invite
    const startTime = new Date(interview.scheduledAt);
    const endTime = addMinutes(startTime, interview.duration);
    const dateStr = format(startTime, "EEEE, MMMM d, yyyy 'at' h:mm a");
    const meetPart = interview.meetLink
      ? `\n\nJoin your video call: ${interview.meetLink}`
      : "";
    const icsContent = generateICS({
      title: `Interview — ${position} at CaresLink`,
      description: `Your interview for the ${position} position.${interview.meetLink ? `\n\nJoin: ${interview.meetLink}` : ""}`,
      startTime,
      endTime,
      location: interview.meetLink || undefined,
      organizer: { name: "CaresLink Recruiting", email: FROM_EMAIL },
      attendee: { name, email },
    });

    await sendEmail(
      email,
      `Interview Confirmed — ${position}`,
      `Dear ${name},\n\nYour interview for the ${position} position has been confirmed.\n\n📅 ${dateStr} EST${meetPart}\n\n✅ Confirm attendance: ${confirmUrl}\n❌ Need to cancel? ${cancelUrl}\n\nThank you,\nCaresLink Recruiting`,
      undefined,
      icsContent
    ).catch(() => {}); // Don't fail the booking if email fails

    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        duration: interview.duration,
        meetLink: interview.meetLink,
        calendarLink: interview.calendarLink,
        cancelUrl,
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
