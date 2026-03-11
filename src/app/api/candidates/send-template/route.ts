import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/sendgrid";

export type FitStatus = "not_a_fit" | "good_fit" | "waitlist";

const DEFAULT_TEMPLATES: Record<
  FitStatus,
  { subject: string; body: string }
> = {
  not_a_fit: {
    subject: "Update on your application — {{position}}",
    body: `Hi {{name}},

Thank you for your interest in the {{position}} position at CaresLink. After careful review, we've decided to move forward with other candidates whose experience more closely matches our current needs.

We'll keep your application on file and reach out if something better suited opens up.

Best regards,
CaresLink Recruiting Team`,
  },
  good_fit: {
    subject: "You're a great fit — next steps for {{position}}",
    body: `Hi {{name}},

We're excited to share that your background looks like a strong fit for our {{position}} role. We'd love to chat and learn more about you.

Please book a time that works for you: {{booking_url}}

We look forward to speaking with you soon.

Best regards,
CaresLink Recruiting Team`,
  },
  waitlist: {
    subject: "Update on your application — {{position}}",
    body: `Hi {{name}},

Thank you for applying to the {{position}} role. We've received strong applications and are currently reviewing candidates. We've added you to our waitlist and will be in touch if we'd like to move forward.

Best regards,
CaresLink Recruiting Team`,
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), val);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { candidateId, fitStatus } = body;
    if (!candidateId || !fitStatus) {
      return NextResponse.json(
        { error: "candidateId and fitStatus required" },
        { status: 400 }
      );
    }
    const valid: FitStatus[] = ["not_a_fit", "good_fit", "waitlist"];
    if (!valid.includes(fitStatus)) {
      return NextResponse.json(
        { error: "fitStatus must be: not_a_fit, good_fit, waitlist" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });
    const custom = settings?.emailTemplates as Record<string, { subject?: string; body?: string }> | null;
    const customTmpl = custom?.[fitStatus];
    const defaultTmpl = DEFAULT_TEMPLATES[fitStatus as FitStatus];
    const tmpl = customTmpl
      ? { subject: customTmpl.subject ?? defaultTmpl.subject, body: customTmpl.body ?? defaultTmpl.body }
      : defaultTmpl;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const bookingUrl = `${appUrl}/book?email=${encodeURIComponent(candidate.email)}`;

    const emailSubject = interpolate(tmpl.subject, {
      name: candidate.name,
      position: candidate.position,
    });
    const emailBody = interpolate(tmpl.body, {
      name: candidate.name,
      position: candidate.position,
      booking_url: bookingUrl,
    });

    const result = await sendEmail(candidate.email, emailSubject, emailBody);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }

    await prisma.event.create({
      data: {
        type: "template_email_sent",
        candidateId: candidate.id,
        channel: "email",
        metadata: fitStatus,
        cost: 0.02,
      },
    });
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { fitStatus, status: candidate.status === "applied" ? "contacted" : candidate.status },
    });

    return NextResponse.json({ success: true, message: "Template email sent" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to send template email" }, { status: 500 });
  }
}
