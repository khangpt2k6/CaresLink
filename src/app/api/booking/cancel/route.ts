import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/sendgrid";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interviewId, email } = body;

    if (!interviewId || !email) {
      return NextResponse.json(
        { error: "interviewId and email are required" },
        { status: 400 }
      );
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { candidate: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Verify email matches candidate
    if (interview.candidate.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match" }, { status: 403 });
    }

    if (interview.cancelled) {
      return NextResponse.json({ error: "Interview already cancelled" }, { status: 400 });
    }

    // Delete from Google Calendar
    if (interview.calendarEventId) {
      await deleteCalendarEvent(interview.calendarEventId).catch(() => {});
    }

    // Mark as cancelled
    await prisma.interview.update({
      where: { id: interviewId },
      data: { cancelled: true },
    });

    // Reset candidate status
    const otherActive = await prisma.interview.count({
      where: {
        candidateId: interview.candidateId,
        id: { not: interviewId },
        completed: false,
        noShow: false,
        cancelled: false,
      },
    });
    if (otherActive === 0) {
      await prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: "contacted" },
      });
    }

    // Log cancellation event
    await prisma.event.create({
      data: {
        type: "interview_cancelled",
        candidateId: interview.candidateId,
        interviewId: interview.id,
        metadata: JSON.stringify({ cancelledBy: "candidate", email }),
      },
    });

    // Notify recruiter
    const recruiterEmail = process.env.RESEND_FROM_EMAIL;
    if (recruiterEmail) {
      const dateStr = format(new Date(interview.scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a");
      await sendEmail(
        recruiterEmail,
        `Interview Cancelled — ${interview.candidate.name}`,
        `${interview.candidate.name} (${interview.candidate.email}) has cancelled their interview for the ${interview.position} position.\n\nOriginal time: ${dateStr} EST\n\nYou may want to follow up or reschedule.`
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to cancel interview" }, { status: 500 });
  }
}
