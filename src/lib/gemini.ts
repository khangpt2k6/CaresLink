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
import { scheduleInterview, sendReminder, findNextAvailableSlots } from "./scheduling";

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
    name: "get_available_slots",
    description: "Get available interview time slots for a candidate in the next 7 days. Returns up to 8 slots that don't conflict with existing interviews or calendar events.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "schedule_interview",
    description: "Schedule an interview for a candidate. Creates a Google Calendar event automatically.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        candidate_id: { type: SchemaType.STRING, description: "The candidate ID" },
        scheduled_at: { type: SchemaType.STRING, description: "ISO datetime string for interview" },
        duration: { type: SchemaType.INTEGER, description: "Duration in minutes", nullable: true },
      },
      required: ["candidate_id", "scheduled_at"],
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
    case "get_available_slots": {
      try {
        const slots = await findNextAvailableSlots(String(args.candidate_id));
        return {
          slots: slots.map((s) => s.toISOString()),
          count: slots.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to get slots" };
      }
    }
    case "schedule_interview": {
      try {
        const scheduledAt = new Date(String(args.scheduled_at));
        const duration = (args.duration as number) || 60;
        const interview = await scheduleInterview(
          String(args.candidate_id),
          scheduledAt,
          duration
        );
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const candidateEmail = (await prisma.candidate.findUnique({ where: { id: String(args.candidate_id) }, select: { email: true } }))?.email || "";
        const cancelUrl = `${appUrl}/book/cancel?interviewId=${interview.id}&email=${encodeURIComponent(candidateEmail)}`;
        const confirmUrl = `${appUrl}/book/confirm?interviewId=${interview.id}&email=${encodeURIComponent(candidateEmail)}`;
        return {
          success: true,
          interview_id: interview.id,
          scheduled_at: scheduledAt.toISOString(),
          meet_link: interview.meetLink || null,
          reschedule_url: `${appUrl}/book`,
          cancel_url: cancelUrl,
          confirm_url: confirmUrl,
          email_sent: true,
          note: "Interview scheduled successfully. A branded confirmation email with calendar invite (ICS), confirm/cancel links, and video call link has been automatically sent to the candidate. No need to send another email unless you want to add additional information.",
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to schedule" };
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
    systemInstruction: `You are CaresLink, an AI recruitment assistant. You help employers contact candidates, schedule interviews, and send reminders.

IMPORTANT: Always use the timezone configured by the HR admin when referring to dates and times. The system handles timezone formatting automatically in emails. Format times naturally like "Monday, March 9 at 10:00 AM".

WORKFLOW — When contacting a candidate:
1. Call get_candidate_info to get their details
2. Call get_available_slots to find open interview times (these slots respect the HR availability schedule set in the Calendar page, Google Calendar busy times, and existing interview conflicts)
3. Call schedule_interview with the best slot — this automatically:
   - Creates a Google Calendar event
   - Generates a Jitsi Meet video call link
   - Sends a branded confirmation email to the candidate with ICS calendar invite, confirm/cancel links, and video call link
   - No additional email is needed unless you want to add extra info

You can also use send_email or send_sms independently for follow-ups, custom messages, or other communications.

Be concise and confirm all actions taken.`,
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
