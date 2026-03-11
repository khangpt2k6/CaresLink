import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { sendBookingLinkToCandidate } from "@/lib/send-booking-link";
import { prisma } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && bearerToken !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const parts: string[] = [];

  try {
    // TASK 1 — Contact new applicants: direct send, no AI
    const applied = await prisma.candidate.findMany({
      where: { status: "applied" },
      select: { id: true, name: true },
    });
    let contacted = 0;
    for (const c of applied) {
      const result = await sendBookingLinkToCandidate(c.id);
      if (result.success) contacted++;
    }
    if (applied.length > 0) {
      parts.push(`Contacted ${contacted}/${applied.length} new applicants with booking links (no AI).`);
    }

    // TASK 2 & 3 — Follow-ups and reminders: use AI agent
    const goal = `You are running autonomously. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

Complete ALL without asking for confirmation:

TASK 1 — Follow up on stale candidates:
Get candidates who haven't replied in 5+ days (get_stale_candidates). For each, send a follow-up email with subject "Following Up — [position] Interview at CaresLink" and a friendly message reminding them to book their interview.

TASK 2 — Send interview reminders:
List upcoming interviews in the next 24 hours where reminder_not_sent is true. Send a reminder for each one (send_reminder).

Provide a brief summary: how many follow-ups sent, how many reminders sent.`;

    const agentReport = await runAgent(goal);
    parts.push(agentReport);
    const report = parts.join("\n\n");
    const completedAt = new Date();

    await prisma.agentRun.create({
      data: { trigger: "cron", report, startedAt, completedAt },
    });

    return NextResponse.json({
      success: true,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      report,
    });
  } catch (e) {
    console.error("[agent/cron] error:", e);
    const completedAt = new Date();
    const errorMsg = e instanceof Error ? e.message : "Cron agent failed";

    await prisma.agentRun.create({
      data: { trigger: "cron", report: `ERROR: ${errorMsg}`, startedAt, completedAt },
    }).catch(() => {});

    return NextResponse.json(
      { success: false, startedAt: startedAt.toISOString(), error: errorMsg },
      { status: 500 }
    );
  }
}

// Allow Vercel cron to call this via GET as well
export async function GET(request: NextRequest) {
  return POST(request);
}
