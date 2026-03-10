import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/sendgrid";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const { interviewId } = body;
    if (!interviewId) {
      return NextResponse.json({ error: "interviewId required" }, { status: 400 });
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { candidate: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }
    if (interview.reminderSent) {
      return NextResponse.json({ success: false, message: "Reminder already sent" });
    }

    const dateStr = format(new Date(interview.scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a");

    const subject = `Interview Reminder: ${interview.position} - ${dateStr}`;
    const text = `Hi ${interview.candidate.name},\n\nThis is a friendly reminder about your upcoming interview for the ${interview.position} position.\n\nDate & Time: ${dateStr}\nDuration: ${interview.duration} minutes\nLocation: ${interview.location}\n${interview.calendarLink ? `Calendar Link: ${interview.calendarLink}\n` : ""}\nPlease confirm you can attend by replying to this email.\n\nBest regards,\nCaresLink Team`;

    const result = await sendEmail(interview.candidate.email, subject, text);
    if (result.success) {
      await prisma.interview.update({
        where: { id: interviewId },
        data: { reminderSent: true },
      });
      await prisma.event.create({
        data: {
          type: "reminder_sent",
          candidateId: interview.candidateId,
          interviewId,
          channel: "email",
        },
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
