import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  type FunctionDeclaration,
  type FunctionDeclarationsTool,
  SchemaType,
} from "@google/generative-ai";
import { prisma } from "./db";
import { sendEmail } from "./sendgrid";
import { sendSms } from "./twilio";
import { sendReminder } from "./scheduling";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GOOGLE_GEMINI_API_KEY not set - AI agent disabled");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "get_candidate_info",
    description: "Get details about a candidate by ID",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "list_candidates",
    description: "List all candidates, optionally filtered by position or status",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        position: { type: SchemaType.STRING, description: "Filter by position" },
        status: { type: SchemaType.STRING, description: "Filter by status (applied, contacted, scheduled, etc)" },
      },
      required: [],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a candidate",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
        subject: { type: SchemaType.STRING, description: "Email subject" },
        body: { type: SchemaType.STRING, description: "Email body" },
      },
      required: ["candidate_id", "subject", "body"],
    },
  },
  {
    name: "send_sms",
    description: "Send an SMS to a candidate (candidate must have phone number)",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
        message: { type: SchemaType.STRING, description: "SMS message (max 160 chars recommended)" },
      },
      required: ["candidate_id", "message"],
    },
  },
  {
    name: "send_booking_link",
    description: "Send the self-service booking link to a candidate so they can choose their own interview time. This is the preferred way to schedule interviews — let candidates pick a time that works for them.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
        message: { type: SchemaType.STRING, description: "Optional custom message to include in the email (e.g. greeting, context about the role)", nullable: true },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "send_reminder",
    description: "Send an interview reminder via SMS to the candidate",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        interview_id: { type: SchemaType.STRING, description: "The interview ID" },
      },
      required: ["interview_id"],
    },
  },
];

async function executeFunction(name: string, args: Record<string, unknown>): Promise<object> {
  switch (name) {
    case "get_candidate_info": {
      const c = await prisma.candidate.findUnique({
        where: { id: String(args.candidate_id) },
        include: { interviews: { where: { completed: false, noShow: false } } },
      });
      if (!c) return { error: "Candidate not found" };
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        position: c.position,
        status: c.status,
        upcomingInterviews: c.interviews.length,
      };
    }
    case "list_candidates": {
      const candidates = await prisma.candidate.findMany({
        where: {
          ...(args.position ? { position: String(args.position) } : {}),
          ...(args.status ? { status: String(args.status) } : {}),
        },
        select: { id: true, name: true, email: true, position: true, status: true },
      });
      return { candidates, count: candidates.length };
    }
    case "send_email": {
      const c = await prisma.candidate.findUnique({ where: { id: String(args.candidate_id) } });
      if (!c) return { error: "Candidate not found" };
      const result = await sendEmail(c.email, String(args.subject), String(args.body));
      if (result.success) {
        await prisma.event.create({
          data: { type: "email_sent", candidateId: c.id, channel: "email", cost: 0.02 },
        });
        await prisma.candidate.update({
          where: { id: c.id },
          data: { status: c.status === "applied" ? "contacted" : c.status },
        });
        return { success: true, message: "Email sent" };
      }
      return { success: false, error: result.error };
    }
    case "send_sms": {
      const c = await prisma.candidate.findUnique({ where: { id: String(args.candidate_id) } });
      if (!c) return { error: "Candidate not found" };
      if (!c.phone) return { error: "Candidate has no phone number" };
      const result = await sendSms(c.phone, String(args.message));
      if (result.success) {
        await prisma.event.create({
          data: { type: "sms_sent", candidateId: c.id, channel: "sms", cost: 0.05 },
        });
        await prisma.candidate.update({
          where: { id: c.id },
          data: { status: c.status === "applied" ? "contacted" : c.status },
        });
        return { success: true, message: "SMS sent" };
      }
      return { success: false, error: result.error };
    }
    case "send_booking_link": {
      try {
        const c = await prisma.candidate.findUnique({ where: { id: String(args.candidate_id) } });
        if (!c) return { error: "Candidate not found" };

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const bookingUrl = `${appUrl}/book`;
        const customMessage = args.message ? String(args.message) : "";
        const greeting = customMessage || `Your job application for the ${c.position} position at CaresLink has been shortlisted by our recruiting team.`;

        const result = await sendEmail(
          c.email,
          `You've Been Shortlisted — ${c.position} at CaresLink`,
          `Hello ${c.name},\n\n${greeting}\n\nTo move forward, please book your interview at a time that works best for you:\n${bookingUrl}\n\nWe're excited to learn more about you and look forward to connecting soon.\n\nBest regards,\nCaresLink Recruiting Team`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b3c;">
            <div style="background: #0090d9; padding: 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #fff; font-size: 18px;">You've Been Shortlisted!</h2>
            </div>
            <div style="padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 16px;">Hello ${c.name},</p>
              <p style="margin: 0 0 16px;">${greeting}</p>
              <p style="margin: 0 0 16px;">To move forward, please book your interview at a time that works best for you:</p>
              <div style="text-align: center; margin: 0 0 24px;">
                <a href="${bookingUrl}" style="display: inline-block; background: #0090d9; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Book Your Interview</a>
              </div>
              <p style="margin: 0 0 4px;">We're excited to learn more about you and look forward to connecting soon.</p>
              <p style="margin: 24px 0 0; color: #5a6b7c;">Best regards,<br/>CaresLink Recruiting Team</p>
            </div>
          </div>`
        );

        if (result.success) {
          await prisma.event.create({
            data: { type: "booking_link_sent", candidateId: c.id, channel: "email", cost: 0.02 },
          });
          await prisma.candidate.update({
            where: { id: c.id },
            data: { status: c.status === "applied" ? "contacted" : c.status },
          });
          return {
            success: true,
            booking_url: bookingUrl,
            note: "Booking link email sent to candidate. They will choose their own interview time on the booking page.",
          };
        }
        return { success: false, error: result.error };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to send booking link" };
      }
    }
    case "send_reminder": {
      try {
        const r = await sendReminder(String(args.interview_id));
        if ("alreadySent" in r && r.alreadySent) {
          return { success: false, message: "Reminder already sent" };
        }
        const { interview, candidate } = r as {
          interview: { id: string; position: string; scheduledAt: Date };
          candidate: { id: string; phone: string | null };
        };
        if (!candidate.phone) return { error: "Candidate has no phone" };
        const msg = `Reminder: Your ${interview.position} interview is scheduled. Please confirm you can attend.`;
        const result = await sendSms(candidate.phone, msg);
        if (result.success) {
          await prisma.interview.update({
            where: { id: interview.id },
            data: { reminderSent: true },
          });
          await prisma.event.create({
            data: {
              type: "reminder_sent",
              candidateId: candidate.id,
              interviewId: interview.id,
              channel: "sms",
            },
          });
          return { success: true, message: "Reminder sent" };
        }
        return { success: false, error: result.error };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to send reminder" };
      }
    }
    default:
      return { error: `Unknown function: ${name}` };
  }
}

export async function runAgent(userMessage: string): Promise<string> {
  if (!genAI || !apiKey) {
    return "AI agent is not configured. Set GOOGLE_GEMINI_API_KEY in .env.local";
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    tools: [{ functionDeclarations } as FunctionDeclarationsTool],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    },
    systemInstruction: `You are CaresLink, an AI recruitment assistant. You help employers contact candidates and manage the interview process.

IMPORTANT: You do NOT schedule interviews directly. Candidates choose their own interview time.

CRITICAL: When asked to contact a candidate, DO NOT ask for confirmation. Just do it immediately:
1. Call get_candidate_info to get their details
2. Call send_booking_link to send them the booking page link right away
3. Confirm what you did

The booking page lets candidates see available times (based on HR availability, Google Calendar, and conflicts) and pick their own slot. Once they book, the system automatically creates a calendar event, generates a video call link, and sends a confirmation email.

You can also use send_email or send_sms independently for follow-ups, custom messages, or other communications.

Be concise. Act first, then confirm. Never ask "would you like me to..." — just do it.`,
  });

  const chat = model.startChat({
    history: [],
  });

  try {
    let lastResponse = await chat.sendMessage(userMessage);
    const maxTurns = 10;
    let turns = 0;

    while (turns < maxTurns) {
      const functionCalls = lastResponse.response.functionCalls?.() ?? [];
      if (functionCalls.length === 0) {
        const text = lastResponse.response.text?.() ?? "";
        return text || "Done.";
      }

      const functionResponses = await Promise.all(
        functionCalls.map(async (fc) => {
          const result = await executeFunction(fc.name, (fc.args || {}) as Record<string, unknown>);
          return { functionResponse: { name: fc.name, response: result } };
        })
      );

      lastResponse = await chat.sendMessage(functionResponses);
      turns++;
    }

    return lastResponse.response.text?.() ?? "Completed actions.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return "Gemini API quota exceeded. Please wait a moment and try again, or check your plan at https://ai.google.dev.";
    }
    if (msg.includes("403") || msg.includes("leaked") || msg.includes("API key")) {
      return "Gemini API key is invalid or has been revoked. Please generate a new key at https://aistudio.google.com/apikey and update your .env file.";
    }
    throw err;
  }
}
