import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { createMessage, getProvider, getProviderName, type AITool } from "./ai-provider";
import { prisma } from "./db";
import { sendEmail } from "./sendgrid";
import { sendReminder, scheduleInterview, findMutualAvailableSlots } from "./scheduling";
import { generateEmbedding, buildCandidateText, buildJobText } from "./embeddings";
import { searchSimilarCandidates, searchSimilarJobs, getJobEmbeddingVector } from "./vector-store";
import { rememberFact, recallFacts } from "./agent-memory";

const SYSTEM_PROMPT = `You are CaresLink, an AI recruitment assistant for healthcare. You help employers manage candidates, schedule interviews, verify nursing licenses, run credential checks, and match candidates to jobs.

You specialize in auto-booking: finding a mutual time for recruiter and candidate, then scheduling the interview automatically. Use auto_book_interview when asked to schedule/contact a candidate — do NOT use send_email for booking links. Booking links are sent via the app UI (no AI).

You can use send_email for custom follow-ups, reminders, or other communications.

When a function returns already_scheduled: true, tell the employer: "This candidate already has an interview on [date]. Cancel it first to reschedule."

You can manage the recruiter's weekly availability with get_availability and update_availability. When asked to change availability (e.g. "set Monday to Friday 9-5"), update all relevant days at once.

You can verify nursing licenses by searching the Florida Department of Health (FL DOH) public database. Use verify_nursing_license when asked to verify, check, or look up a candidate's nursing license. You can search by name or license number. Present the results clearly: license type, status (Active/Inactive), expiration date, and city.

You can run full credential verification checks using run_credential_check. This creates a record, verifies the candidate against FL DOH (for CNAs) and Nursys (for RNs), checks OIG exclusion lists and SAM.gov, and provides an AI recommendation (Employable, Review Required, or Not Employable). Use list_credential_checks to show recent checks and their results.

You can match candidates to jobs using get_job_matches. This returns AI-scored matches (0-100) for a job, showing how well each candidate fits. Use find_candidates_for_job for RAG-enhanced matching (uses vector embeddings to pre-filter, then AI scores the top matches). Use list_jobs to find available job IDs first.

You have semantic search capabilities powered by vector embeddings (RAG). When asked to find or search for candidates, prefer semantic_search_candidates over list_candidates — it understands natural language queries like "RN with ICU experience in Tampa" and returns semantically similar candidates. Use find_similar_jobs to find related positions.

You have long-term memory. You can remember important facts using remember_fact — use it proactively when the employer shares preferences, requirements, or notes about candidates/jobs that should persist across conversations. Use recall_context to retrieve relevant memories before complex tasks.

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
  {
    name: "run_credential_check",
    description:
      "Run a full credential verification check for a candidate. Checks FL DOH (CNA), Nursys (RN), OIG exclusion list, and SAM.gov. Returns an AI recommendation: EMPLOYABLE, REVIEW_REQUIRED, or NOT_EMPLOYABLE.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" as const, description: "Candidate's first name" },
        last_name: { type: "string" as const, description: "Candidate's last name" },
        role_type: { type: "string" as const, description: "Either 'CNA' or 'NURSE'" },
        email: { type: "string" as const, description: "Candidate's email (optional)" },
        license_number: { type: "string" as const, description: "License number (optional)" },
      },
      required: ["first_name", "last_name", "role_type"],
    },
  },
  {
    name: "list_credential_checks",
    description: "List recent credential verification checks and their results (AI recommendation, status).",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, description: "Number of results to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "get_job_matches",
    description:
      "Get AI-scored candidate matches for a specific job. Returns candidates ranked 0-100 with explanations. Use list_candidates or list_jobs to find job IDs first.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job ID to get matches for" },
        min_score: { type: "number" as const, description: "Minimum match score to include (default 0)" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "run_job_matching",
    description:
      "Trigger a new AI matching analysis for a specific job against all candidates. This re-computes scores using latest candidate data. Returns updated matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job ID to run matching for" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "list_jobs",
    description: "List all jobs, optionally filtered by status. Returns job IDs, titles, and candidate counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Filter by status: 'open' or 'closed' (default: all)" },
      },
      required: [],
    },
  },
  // ─── RAG & Semantic Memory Tools ─────────────────────────
  {
    name: "semantic_search_candidates",
    description:
      "Search for candidates using natural language. Uses AI vector embeddings to find semantically similar candidates based on skills, experience, certifications, location, etc. Much better than keyword filtering. Example: 'RN with ICU experience and BLS certification in Tampa'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Natural language search query describing the ideal candidate" },
        limit: { type: "number" as const, description: "Max results to return (default 10)" },
        min_similarity: { type: "number" as const, description: "Minimum similarity score 0-1 (default 0.3)" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_similar_jobs",
    description:
      "Find jobs similar to a given description or to an existing job. Uses vector embeddings for semantic matching. Useful for finding related positions or suggesting alternative roles for a candidate.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Natural language job description or requirements" },
        job_id: { type: "string" as const, description: "Existing job ID to find similar jobs to (alternative to query)" },
        limit: { type: "number" as const, description: "Max results (default 5)" },
      },
      required: [],
    },
  },
  {
    name: "remember_fact",
    description:
      "Store an important fact, preference, or note for long-term memory. Use proactively when the employer shares preferences, requirements, or important notes about candidates/jobs. These persist across conversations.",
    input_schema: {
      type: "object" as const,
      properties: {
        fact: {
          type: "string" as const,
          description: "The fact to remember, e.g. 'Employer prefers candidates with BLS certification for ICU positions'",
        },
        category: {
          type: "string" as const,
          enum: ["preference", "candidate_note", "job_requirement", "workflow", "general"],
          description: "Category of the fact",
        },
        entity_id: { type: "string" as const, description: "Optional ID of related candidate or job" },
        entity_type: { type: "string" as const, enum: ["candidate", "job"], description: "Type of related entity" },
      },
      required: ["fact", "category"],
    },
  },
  {
    name: "recall_context",
    description:
      "Recall previously remembered facts and preferences relevant to the current context. Use before complex tasks to load relevant long-term memory from past conversations.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "What context to search for, e.g. 'ICU nurse preferences' or 'notes about Maria Santos'" },
        limit: { type: "number" as const, description: "Max facts to return (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_candidates_for_job",
    description:
      "RAG-enhanced job matching. First finds semantically similar candidates via vector embeddings, then uses AI to fine-score the top matches. More accurate and scalable than legacy matching. Returns ranked candidates with scores and explanations.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job ID to find matches for" },
        top_k: { type: "number" as const, description: "Number of candidates to pre-filter via similarity (default 20)" },
      },
      required: ["job_id"],
    },
  },
];

async function executeFunction(name: string, args: Record<string, unknown>, userId?: string): Promise<object> {
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
    case "run_credential_check": {
      try {
        if (!userId) return { error: "User context required for credential checks" };
        const record = await prisma.credentialCheck.create({
          data: {
            employerId: userId,
            firstName: String(args.first_name),
            lastName: String(args.last_name),
            roleType: String(args.role_type) === "NURSE" ? "NURSE" : "CNA",
            email: args.email ? String(args.email) : null,
            targetState: "FLORIDA",
            status: "PENDING",
          },
        });

        // Trigger verification
        const verifyRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/credential-check/${record.id}/verify`,
          { method: "POST" }
        );

        if (verifyRes.ok) {
          const updated = await verifyRes.json();
          return {
            success: true,
            id: updated.id,
            name: `${updated.firstName} ${updated.lastName}`,
            roleType: updated.roleType,
            status: updated.status,
            aiRecommendation: updated.aiRecommendation || "Pending",
            aiSummary: updated.aiSummary || "Verification completed",
          };
        }

        return {
          success: false,
          id: record.id,
          error: "Verification request failed. Check can be retried from the Credential Check page.",
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to run credential check" };
      }
    }
    case "list_credential_checks": {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const checks = await prisma.credentialCheck.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          roleType: true,
          status: true,
          aiRecommendation: true,
          aiSummary: true,
          createdAt: true,
        },
      });
      return {
        checks: checks.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          roleType: c.roleType,
          status: c.status,
          recommendation: c.aiRecommendation || "N/A",
          summary: c.aiSummary || "N/A",
          date: c.createdAt.toISOString(),
        })),
        count: checks.length,
      };
    }
    case "get_job_matches": {
      const jobId = String(args.job_id);
      const minScore = typeof args.min_score === "number" ? args.min_score : 0;
      const matches = await prisma.jobMatch.findMany({
        where: { jobId, score: { gte: minScore } },
        include: {
          candidate: { select: { name: true, email: true, position: true, status: true } },
          job: { select: { title: true } },
        },
        orderBy: { score: "desc" },
        take: 10,
      });
      if (matches.length === 0) {
        return {
          matches: [],
          count: 0,
          message: "No matches found. Run AI matching first with run_job_matching.",
        };
      }
      return {
        jobTitle: matches[0].job.title,
        matches: matches.map((m) => ({
          candidateName: m.candidate.name,
          candidateEmail: m.candidate.email,
          candidatePosition: m.candidate.position,
          candidateStatus: m.candidate.status,
          score: m.score,
          label: m.label,
          reason: m.reason,
        })),
        count: matches.length,
      };
    }
    case "run_job_matching": {
      try {
        const { computeAndStoreMatches } = await import("./matching-service");
        const jobId = String(args.job_id);
        const matches = await computeAndStoreMatches(jobId);
        return {
          success: true,
          jobId,
          matchesComputed: matches.length,
          topMatches: matches.slice(0, 5).map((m) => ({
            candidateName: m.candidate.name,
            score: m.score,
            label: m.label,
            reason: m.reason,
          })),
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to run job matching" };
      }
    }
    case "list_jobs": {
      const where = args.status ? { status: String(args.status) } : {};
      const jobsList = await prisma.job.findMany({
        where,
        select: { id: true, title: true, location: true, type: true, status: true, _count: { select: { matches: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        jobs: jobsList.map((j) => ({
          id: j.id,
          title: j.title,
          location: j.location,
          type: j.type,
          status: j.status,
          candidateCount: j._count.matches,
        })),
        count: jobsList.length,
      };
    }
    // ─── RAG & Semantic Memory Tool Handlers ───────────────
    case "semantic_search_candidates": {
      try {
        const query = String(args.query);
        const limit = typeof args.limit === "number" ? args.limit : 10;
        const minSimilarity = typeof args.min_similarity === "number" ? args.min_similarity : 0.3;

        const queryEmbedding = await generateEmbedding(query);
        const results = await searchSimilarCandidates(queryEmbedding, limit, minSimilarity);

        if (results.length === 0) {
          return { candidates: [], count: 0, message: "No semantically similar candidates found. Try a broader query, or embeddings may need to be generated (run embed:all)." };
        }

        // Enrich with candidate details
        const candidateIds = results.map((r) => r.candidateId);
        const candidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, name: true, email: true, position: true, status: true },
        });

        const candidateMap = Object.fromEntries(candidates.map((c) => [c.id, c]));
        return {
          candidates: results.map((r) => ({
            ...candidateMap[r.candidateId],
            similarity: Number(r.similarity).toFixed(3),
          })),
          count: results.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Semantic search failed" };
      }
    }
    case "find_similar_jobs": {
      try {
        let queryEmbedding: number[];

        if (args.job_id) {
          const stored = await getJobEmbeddingVector(String(args.job_id));
          if (!stored) {
            // Generate on the fly
            const job = await prisma.job.findUnique({ where: { id: String(args.job_id) } });
            if (!job) return { error: "Job not found" };
            queryEmbedding = await generateEmbedding(buildJobText(job));
          } else {
            queryEmbedding = stored;
          }
        } else if (args.query) {
          queryEmbedding = await generateEmbedding(String(args.query));
        } else {
          return { error: "Provide either query or job_id" };
        }

        const limit = typeof args.limit === "number" ? args.limit : 5;
        const results = await searchSimilarJobs(queryEmbedding, limit);

        if (results.length === 0) {
          return { jobs: [], count: 0, message: "No similar jobs found." };
        }

        const jobIds = results.map((r) => r.jobId);
        const jobs = await prisma.job.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, title: true, location: true, type: true, status: true },
        });

        const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));
        return {
          jobs: results.map((r) => ({
            ...jobMap[r.jobId],
            similarity: Number(r.similarity).toFixed(3),
          })),
          count: results.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Similar jobs search failed" };
      }
    }
    case "remember_fact": {
      try {
        if (!userId) return { error: "User context required to store memories" };
        const fact = String(args.fact);
        const category = String(args.category || "general");
        const entityId = args.entity_id ? String(args.entity_id) : null;
        const entityType = args.entity_type ? String(args.entity_type) : null;

        const result = await rememberFact(userId, fact, category, entityId, entityType);
        return { success: true, ...result, message: "Fact stored in long-term memory." };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to store fact" };
      }
    }
    case "recall_context": {
      try {
        if (!userId) return { error: "User context required to recall memories" };
        const query = String(args.query);
        const limit = typeof args.limit === "number" ? args.limit : 5;

        const facts = await recallFacts(userId, query, limit);
        return {
          facts: facts.map((f) => ({
            fact: f.fact,
            category: f.category,
            relevance: Number(f.similarity).toFixed(3),
          })),
          count: facts.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to recall context" };
      }
    }
    case "find_candidates_for_job": {
      try {
        const { computeAndStoreMatchesRAG } = await import("./matching-service");
        const jobId = String(args.job_id);
        const topK = typeof args.top_k === "number" ? args.top_k : 20;

        const matches = await computeAndStoreMatchesRAG(jobId, topK);
        return {
          success: true,
          jobId,
          matchesComputed: matches.length,
          method: "RAG-enhanced (vector pre-filter + AI scoring)",
          topMatches: matches.slice(0, 5).map((m) => ({
            candidateName: m.candidate.name,
            score: m.score,
            label: m.label,
            reason: m.reason,
          })),
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "RAG matching failed" };
      }
    }
    default:
      return { error: `Unknown function: ${name}` };
  }
}

export async function runAgent(userMessage: string, sessionId?: string, userId?: string): Promise<string> {
  const provider = await getProvider();
  const providerName = await getProviderName();
  const apiKeyVar = provider === "groq" ? "GROQ_API_KEY" : "ANTHROPIC_API_KEY";
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return "AI agent is not configured. Set ANTHROPIC_API_KEY in .env.local";
  }
  if (provider === "groq" && !process.env.GROQ_API_KEY) {
    return "AI agent is not configured. Set GROQ_API_KEY in .env.local (free at https://console.groq.com)";
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

  // ─── Auto-inject recalled semantic context ─────────────
  let systemPrompt = SYSTEM_PROMPT;
  if (userId) {
    try {
      const relevantFacts = await recallFacts(userId, userMessage, 3);
      if (relevantFacts.length > 0) {
        const contextBlock = relevantFacts
          .filter((f) => f.similarity > 0.35)
          .map((f) => `- ${f.fact}`)
          .join("\n");
        if (contextBlock) {
          systemPrompt += `\n\n[Relevant context from previous conversations:]\n${contextBlock}`;
        }
      }
    } catch {
      // Silently skip if semantic memory not available (e.g. pgvector not enabled yet)
    }
  }

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
      const response = await createMessage({
        model: "claude-sonnet-4-20250514",
        maxTokens: 4096,
        system: systemPrompt,
        tools: TOOLS as AITool[],
        messages,
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      if (textBlocks.length > 0) {
        lastText = textBlocks[0].text || "";
      }

      if (toolUseBlocks.length === 0) {
        // Store response content in Anthropic MessageParam format for history
        const contentForHistory = response.content.map((b) =>
          b.type === "text"
            ? { type: "text" as const, text: b.text || "" }
            : { type: "tool_use" as const, id: b.id!, name: b.name!, input: b.input || {} }
        );
        await saveHistory([
          ...messages,
          { role: "assistant", content: contentForHistory },
        ]);
        return lastText || "Done.";
      }

      // Build assistant message with content blocks for history
      const contentForHistory = response.content.map((b) =>
        b.type === "text"
          ? { type: "text" as const, text: b.text || "" }
          : { type: "tool_use" as const, id: b.id!, name: b.name!, input: b.input || {} }
      );
      const assistantMsg: MessageParam = { role: "assistant", content: contentForHistory };
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      for (const block of toolUseBlocks) {
        const result = await executeFunction(block.name!, (block.input ?? {}) as Record<string, unknown>, userId);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id!,
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
      return `${providerName} API rate limit exceeded. Please wait a moment and try again.`;
    }
    if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication")) {
      return `${providerName} API key is invalid. Please check ${apiKeyVar} in your .env file.`;
    }
    throw err;
  }
}
