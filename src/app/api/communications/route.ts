import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/sendgrid";
import { sendSms } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, candidateId, subject, body: emailBody, message } = body;

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId required" }, { status: 400 });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    if (action === "email") {
      if (!subject || !emailBody) {
        return NextResponse.json({ error: "subject and body required for email" }, { status: 400 });
      }
      const result = await sendEmail(candidate.email, subject, emailBody);
      if (result.success) {
        await prisma.event.create({
          data: { type: "email_sent", candidateId, channel: "email", cost: 0.02 },
        });
        await prisma.candidate.update({
          where: { id: candidateId },
          data: { status: candidate.status === "applied" ? "contacted" : candidate.status },
        });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    if (action === "sms") {
      if (!message) {
        return NextResponse.json({ error: "message required for SMS" }, { status: 400 });
      }
      if (!candidate.phone) {
        return NextResponse.json({ error: "Candidate has no phone number" }, { status: 400 });
      }
      const result = await sendSms(candidate.phone, message);
      if (result.success) {
        await prisma.event.create({
          data: { type: "sms_sent", candidateId, channel: "sms", cost: 0.05 },
        });
        await prisma.candidate.update({
          where: { id: candidateId },
          data: { status: candidate.status === "applied" ? "contacted" : candidate.status },
        });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ error: "action must be 'email' or 'sms'" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Communication failed" }, { status: 500 });
  }
}
