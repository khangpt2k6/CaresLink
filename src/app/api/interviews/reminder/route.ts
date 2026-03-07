import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/sendgrid";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (token.role !== "EMPLOYER") {
    return NextResponse.json({ error: "Only recruiters can send interview reminders." }, { status: 403 });
  }

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
