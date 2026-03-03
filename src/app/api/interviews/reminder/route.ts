import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/twilio";

export async function POST(request: NextRequest) {
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
    if (!interview.candidate.phone) {
      return NextResponse.json({ error: "Candidate has no phone number" }, { status: 400 });
    }

    const msg = `Reminder: Your ${interview.position} interview is scheduled. Please confirm you can attend.`;
    const result = await sendSms(interview.candidate.phone, msg);
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
          channel: "sms",
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
