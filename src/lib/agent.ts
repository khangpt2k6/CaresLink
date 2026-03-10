import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { prisma } from "./db";
import { sendEmail } from "./sendgrid";
import { sendReminder, scheduleInterview, findMutualAvailableSlots } from "./scheduling";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn("ANTHROPIC_API_KEY not set - AI agent disabled");
}

const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are CaresLink, an AI recruitment assistant. You help employers contact candidates and manage the interview process.

IMPORTANT: You do NOT schedule interviews directly. Candidates choose their own interview time.

CRITICAL: When asked to contact a candidate, DO NOT ask for confirmation. Just do it immediately:
1. Call get_candidate_info to get their details
2. Call send_booking_link to send them the booking page link right away
3. Confirm what you did

The booking page lets candidates see available times (based on HR availability, Google Calendar, and conflicts) and pick their own slot. Once they book, the system automatically creates a calendar event, generates a video call link, and sends a confirmation email.

You can also use send_email independently for follow-ups, custom messages, or other communications.

When a function returns already_scheduled: true, tell the employer directly: "This candidate already has an interview scheduled on [date]. Cancel it first to reschedule."

You can also manage the recruiter's weekly availability schedule using get_availability and update_availability. When asked to change availability (e.g. "set Monday to Friday 9-5"), update all the relevant days at once.

Be concise and direct. Act first, then confirm. Never ask "would you like me to..." — just do it.`;

const TOOLS: Tool[] = [
  {
    name: "get_candidate_info",
    description: "Get details about a candidate by ID",
    input_schema: {
      type: "object" as const,
      properties: {
        candidate_id: { type: "string" as const, description: "The candidate ID" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "list_candidates",
    description: "List all candidates, optionally filtered by position or status",
    input_schema: {
      type: "object" as const,
      properties: {
        position: { type: "string" as const, description: "Filter by position" },
        status: { type: "string" as const, description: "Filter by status (applied, contacted, scheduled, etc)" },
      },
      required: [],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a candidate",
    input_schema: {
      type: "object" as const,
      properties: {
        candidate_id: { type: "string" as const, description: "The candidate ID" },
        subject: { type: "string" as const, description: "Email subject" },
        body: { type: "string" as const, description: "Email body" },
      },
      required: ["candidate_id", "subject", "body"],
    },
  },
  {
    name: "send_booking_link",
    description:
      "Send the self-service booking link to a candidate so they can choose their own interview time. This is the preferred way to schedule interviews — let candidates pick a time that works for them.",
    input_schema: {
      type: "object" as const,
      properties: {
        candidate_id: { type: "string" as const, description: "The candidate ID" },
        message: { type: "string" as const, description: "Optional custom message to include in the email (e.g. greeting, context about the role)" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "send_reminder",
    description: "Send an interview reminder via email to the candidate",
    input_schema: {
      type: "object" as const,
      properties: {
        interview_id: { type: "string" as const, description: "The interview ID" },
      },
      required: ["interview_id"],
    },
  },
  {
    name: "auto_book_interview",
    description:
      "Find a time that works for BOTH the recruiter and the candidate (using their availability), then automatically schedule the interview and send the confirmation email. Use when the recruiter wants to auto-book instead of sending a booking link.",
    input_schema: {
      type: "object" as const,
      properties: {
        candidate_id: { type: "string" as const, description: "The candidate ID" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "get_stale_candidates",
    description: "Get candidates who haven't replied in 5+ days after outreach (email or booking link). Use to proactively suggest follow-ups.",
    input_schema: {
      type: "object" as const,
      properties: {
        min_days: { type: "number" as const, description: "Minimum days since last outreach (default 5)" },
      },
      required: [],
    },
  },
  {
    name: "list_upcoming_interviews",
    description: "List scheduled interviews happening within the next N hours. Use to find interviews that need reminders sent.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours_ahead: { type: "number" as const, description: "How many hours ahead to look (default 24)" },
        reminder_not_sent: { type: "boolean" as const, description: "If true, only return interviews where reminder hasn't been sent yet" },
      },
      required: [],
    },
  },
  {
    name: "get_availability",
    description: "Get the current recruiter weekly availability schedule. Shows which days are enabled and the start/end hours for each day.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_availability",
    description:
      "Update the recruiter's weekly availability schedule. Can set hours and enable/disable specific days. dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "array" as const,
          description: "Array of day configurations to update",
          items: {
            type: "object" as const,
            properties: {
              dayOfWeek: { type: "number" as const, description: "0=Sunday, 1=Monday, ..., 6=Saturday" },
              startHour: { type: "number" as const, description: "Start hour (e.g. 9 for 9 AM, 9.5 for 9:30 AM)" },
              endHour: { type: "number" as const, description: "End hour (e.g. 17 for 5 PM)" },
              enabled: { type: "boolean" as const, description: "Whether this day is available" },
            },
            required: ["dayOfWeek"],
          },
        },
      },
      required: ["days"],
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
    case "get_stale_candidates": {
      const { getStaleCandidates } = await import("./insights");
      const minDays = typeof args.min_days === "number" ? args.min_days : 5;
      const stale = await getStaleCandidates(minDays);
      return { staleCandidates: stale, count: stale.length };
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
    case "send_booking_link": {
      try {
        const c = await prisma.candidate.findUnique({ where: { id: String(args.candidate_id) } });
        if (!c) return { error: "Candidate not found" };

        const existingInterview = await prisma.interview.findFirst({
          where: {
            candidateId: c.id,
            cancelled: false,
            completed: false,
            noShow: false,
            scheduledAt: { gt: new Date() },
          },
        });
        if (existingInterview) {
          return {
            success: false,
            already_scheduled: true,
            scheduled_at: existingInterview.scheduledAt.toISOString(),
            error: `Cannot send booking link. This candidate already has an interview on ${existingInterview.scheduledAt.toLocaleString()}. Cancel it first to reschedule.`,
          };
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const bookingUrl = `${appUrl}/book?email=${encodeURIComponent(c.email)}`;
        const rawMessage = args.message ? String(args.message) : "";
        const customMessage = rawMessage.replace(/^(hi|hello|dear|hey)\s+[^,.\n]+[,.]?\s*/i, "").trim();
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
    case "auto_book_interview": {
      try {
        const candidateId = String(args.candidate_id);

        const existingInterview = await prisma.interview.findFirst({
          where: {
            candidateId,
            cancelled: false,
            completed: false,
            noShow: false,
            scheduledAt: { gt: new Date() },
          },
        });
        if (existingInterview) {
          return {
            success: false,
            already_scheduled: true,
            scheduled_at: existingInterview.scheduledAt.toISOString(),
            error: `Cannot book. This candidate already has an interview on ${existingInterview.scheduledAt.toLocaleString()}. Cancel it first to reschedule.`,
          };
        }

        const slots = await findMutualAvailableSlots(candidateId);
        if (slots.length === 0) {
          return {
            success: false,
            error: "No mutual availability found. The candidate may need to set their availability at /availability, or try sending the booking link instead.",
          };
        }
        const interview = await scheduleInterview(candidateId, slots[0]);
        return {
          success: true,
          interview_id: interview.id,
          scheduled_at: interview.scheduledAt.toISOString(),
          note: `Interview auto-booked for ${interview.scheduledAt.toLocaleString()}. Confirmation email sent to the candidate.`,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to auto-book interview" };
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
          candidate: { id: string; email: string; name: string };
        };
        const result = await sendEmail(
          candidate.email,
          `Interview Reminder — ${interview.position}`,
          `Reminder: Your ${interview.position} interview is scheduled. Please confirm you can attend.`
        );
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
              channel: "email",
            },
          });
          return { success: true, message: "Reminder email sent" };
        }
        return { success: false, error: result.error };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to send reminder" };
      }
    }
    case "list_upcoming_interviews": {
      const hoursAhead = typeof args.hours_ahead === "number" ? args.hours_ahead : 24;
      const reminderNotSent = args.reminder_not_sent === true;
      const now = new Date();
      const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
      const interviews = await prisma.interview.findMany({
        where: {
          scheduledAt: { gte: now, lte: cutoff },
          cancelled: false,
          completed: false,
          noShow: false,
          ...(reminderNotSent ? { reminderSent: false } : {}),
        },
        include: { candidate: { select: { name: true, email: true, position: true } } },
        orderBy: { scheduledAt: "asc" },
      });
      return {
        interviews: interviews.map((i) => ({
          id: i.id,
          candidateName: i.candidate.name,
          candidateEmail: i.candidate.email,
          position: i.candidate.position,
          scheduledAt: i.scheduledAt.toISOString(),
          reminderSent: i.reminderSent,
        })),
        count: interviews.length,
      };
    }
    case "get_availability": {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const schedule = await prisma.availability.findMany({ orderBy: { dayOfWeek: "asc" } });
      return {
        schedule: schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          day: dayNames[s.dayOfWeek],
          startHour: s.startHour,
          endHour: s.endHour,
          enabled: s.enabled,
          display: s.enabled
            ? `${s.startHour % 1 === 0 ? Math.floor(s.startHour) : s.startHour}:00 - ${s.endHour % 1 === 0 ? Math.floor(s.endHour) : s.endHour}:00`
            : "Unavailable",
        })),
      };
    }
    case "update_availability": {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const days = args.days as { dayOfWeek: number; startHour?: number; endHour?: number; enabled?: boolean }[];
      if (!Array.isArray(days) || days.length === 0) {
        return { error: "days array is required" };
      }
      const updated = [];
      for (const day of days) {
        const dayOfWeek = Number(day.dayOfWeek);
        if (dayOfWeek < 0 || dayOfWeek > 6) continue;
        const data: { startHour?: number; endHour?: number; enabled?: boolean } = {};
        if (typeof day.startHour === "number") data.startHour = day.startHour;
        if (typeof day.endHour === "number") data.endHour = day.endHour;
        if (typeof day.enabled === "boolean") data.enabled = day.enabled;
        await prisma.availability.upsert({
          where: { dayOfWeek },
          update: data,
          create: { dayOfWeek, startHour: day.startHour ?? 9, endHour: day.endHour ?? 17, enabled: day.enabled ?? true },
        });
        updated.push({ day: dayNames[dayOfWeek], ...data });
      }
      await prisma.settings.upsert({
        where: { id: "default" },
        update: { scheduleVersion: { increment: 1 } },
        create: { id: "default", scheduleVersion: 1 },
      });
      return { success: true, updated };
    }
    default:
      return { error: `Unknown function: ${name}` };
  }
}

export async function runAgent(userMessage: string, sessionId?: string): Promise<string> {
  if (!anthropic || !apiKey) {
    return "AI agent is not configured. Set ANTHROPIC_API_KEY in .env.local";
  }

  let messages: MessageParam[] = [{ role: "user", content: userMessage }];

  if (sessionId) {
    const memory = await prisma.agentMemory.findUnique({ where: { sessionId } });
    if (memory?.history && Array.isArray(memory.history)) {
      const stored = memory.history as MessageParam[];
      if (stored.length > 0) {
        messages = [...stored, { role: "user", content: userMessage }];
      }
    }
  }

  const maxTurns = 10;
  let turns = 0;
  let lastText = "";

  const saveHistory = async (history: MessageParam[]) => {
    if (!sessionId) return;
    const trimmed = history.slice(-20);
    await prisma.agentMemory.upsert({
      where: { sessionId },
      update: { history: trimmed as object },
      create: { sessionId, history: trimmed as object },
    });
  };

  try {
    while (turns < maxTurns) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      if (textBlocks.length > 0) {
        lastText = (textBlocks[0] as { type: "text"; text: string }).text;
      }

      if (toolUseBlocks.length === 0) {
        await saveHistory([
          ...messages,
          { role: "assistant", content: response.content },
        ]);
        return lastText || "Done.";
      }

      const assistantMsg: MessageParam = { role: "assistant", content: response.content };
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        const result = await executeFunction(block.name, (block.input ?? {}) as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages = [
        ...messages,
        assistantMsg,
        { role: "user", content: toolResults },
      ];

      turns++;
    }

    await saveHistory(messages);
    return lastText || "Completed actions.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("overloaded") || msg.includes("rate")) {
      return "Anthropic API rate limit exceeded. Please wait a moment and try again.";
    }
    if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication")) {
      return "Anthropic API key is invalid. Please check ANTHROPIC_API_KEY in your .env file.";
    }
    throw err;
  }
}
