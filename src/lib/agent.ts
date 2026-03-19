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

const SYSTEM_PROMPT = `You are CaresLink, an AI recruitment assistant for healthcare. You help employers manage candidates, schedule interviews, and verify nursing licenses.

You specialize in auto-booking: finding a mutual time for recruiter and candidate, then scheduling the interview automatically. Use auto_book_interview when asked to schedule/contact a candidate — do NOT use send_email for booking links. Booking links are sent via the app UI (no AI).

You can use send_email for custom follow-ups, reminders, or other communications.

When a function returns already_scheduled: true, tell the employer: "This candidate already has an interview on [date]. Cancel it first to reschedule."

You can manage the recruiter's weekly availability with get_availability and update_availability. When asked to change availability (e.g. "set Monday to Friday 9-5"), update all relevant days at once.

You can verify nursing licenses by searching the Florida Department of Health (FL DOH) public database. Use verify_nursing_license when asked to verify, check, or look up a candidate's nursing license. You can search by name or license number. Present the results clearly: license type, status (Active/Inactive), expiration date, and city.

Be concise and direct. Act first, then confirm. Never ask "would you like me to..." — just do it.`;

async function scrapeFLMQA(args: { first_name?: string; last_name?: string; license_number?: string }): Promise<object> {
  const baseUrl = "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";

  try {
    // Build form data for the search
    const formData = new URLSearchParams();
    formData.append("Board", "BOARD OF NURSING");
    formData.append("Profession", "");
    formData.append("LicenseNumber", args.license_number || "");
    formData.append("BusinessName", "");
    formData.append("LastName", args.last_name || "");
    formData.append("FirstName", args.first_name || "");
    formData.append("City", "");
    formData.append("County", "");
    formData.append("ZipCode", "");
    formData.append("LicenseStatus", "");

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: formData.toString(),
    });

    if (!resp.ok) {
      return { error: `FL MQA returned status ${resp.status}`, source: "FL DOH MQA" };
    }

    const html = await resp.text();

    // Parse the results table from HTML
    const results: {
      name: string;
      licenseType: string;
      licenseNumber: string;
      status: string;
      expiration: string;
      city: string;
    }[] = [];

    // Match table rows from the results
    const rowRegex = /<tr[^>]*class="[^"]*SearchResultsRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length >= 5) {
        results.push({
          name: cells[0] || "",
          licenseType: cells[1] || "",
          licenseNumber: cells[2] || "",
          status: cells[3] || "",
          expiration: cells[4] || "",
          city: cells[5] || "",
        });
      }
    }

    // Fallback: try alternative table parsing if no rows found
    if (results.length === 0) {
      // Check for "no results" message
      if (html.includes("No results found") || html.includes("0 results")) {
        return {
          source: "FL DOH MQA (Board of Nursing)",
          url: baseUrl,
          found: false,
          message: `No nursing license found for ${args.first_name || ""} ${args.last_name || ""} ${args.license_number ? `(License: ${args.license_number})` : ""}`.trim(),
        };
      }

      // Try simpler row parsing
      const simpleRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let simpleMatch;
      let rowCount = 0;
      while ((simpleMatch = simpleRowRegex.exec(html)) !== null) {
        rowCount++;
        if (rowCount <= 1) continue; // skip header
        const cells: string[] = [];
        const cellRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch2;
        while ((cellMatch2 = cellRegex2.exec(simpleMatch[1])) !== null) {
          cells.push(cellMatch2[1].replace(/<[^>]+>/g, "").trim());
        }
        if (cells.length >= 4) {
          results.push({
            name: cells[0] || "",
            licenseType: cells[1] || "",
            licenseNumber: cells[2] || "",
            status: cells[3] || "",
            expiration: cells[4] || "",
            city: cells[5] || "",
          });
        }
        if (results.length >= 5) break;
      }
    }

    if (results.length === 0) {
      return {
        source: "FL DOH MQA (Board of Nursing)",
        url: baseUrl,
        found: false,
        message: `No results found. Try checking the spelling or use a license number directly.`,
      };
    }

    return {
      source: "FL DOH MQA (Board of Nursing)",
      url: baseUrl,
      found: true,
      count: results.length,
      results: results.slice(0, 10),
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to query FL MQA",
      source: "FL DOH MQA",
      suggestion: "The FL DOH website may be temporarily unavailable. Try again later.",
    };
  }
}

const TOOLS: Tool[] = [
  {
    name: "verify_nursing_license",
    description:
      "Verify a nursing license by searching the Florida Department of Health (FL DOH) MQA public database. Returns license type, status, expiration date, and location. Can search by name or license number.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" as const, description: "Candidate's first name" },
        last_name: { type: "string" as const, description: "Candidate's last name" },
        license_number: { type: "string" as const, description: "License number (optional, more precise)" },
      },
      required: [],
    },
  },
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
    case "verify_nursing_license": {
      return scrapeFLMQA({
        first_name: args.first_name ? String(args.first_name) : undefined,
        last_name: args.last_name ? String(args.last_name) : undefined,
        license_number: args.license_number ? String(args.license_number) : undefined,
      });
    }
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

export async function runAgent(userMessage: string, sessionId?: string, userId?: string): Promise<string> {
  if (!anthropic || !apiKey) {
    return "AI agent is not configured. Set ANTHROPIC_API_KEY in .env.local";
  }

  let messages: MessageParam[] = [{ role: "user", content: userMessage }];

  if (sessionId && userId) {
    // Only load memory that belongs to this user — prevents cross-user session access
    const memory = await prisma.agentMemory.findFirst({
      where: { sessionId, userId },
    });
    if (memory?.history && Array.isArray(memory.history)) {
      const stored = memory.history as unknown as MessageParam[];
      if (stored.length > 0) {
        messages = [...stored, { role: "user", content: userMessage }];
      }
    }
  }

  const maxTurns = 10;
  let turns = 0;
  let lastText = "";

  const saveHistory = async (history: MessageParam[]) => {
    if (!sessionId || !userId) return;
    const trimmed = history.slice(-20);
    await prisma.agentMemory.upsert({
      where: { sessionId },
      update: { history: trimmed as object },
      create: { sessionId, userId, history: trimmed as object },
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
