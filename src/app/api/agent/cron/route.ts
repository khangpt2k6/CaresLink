import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/gemini";
import { prisma } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Verify the request is from a trusted source
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && bearerToken !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const goal = `You are running autonomously as a background recruitment agent. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

Complete ALL of the following tasks without stopping to ask for confirmation:

TASK 1 — Contact new applicants:
List all candidates with status "applied". For each one, send them a booking link immediately. Do not skip any.

TASK 2 — Follow up on stale candidates:
Get candidates who haven't replied in 5+ days. For each stale candidate, send a follow-up email with subject "Following Up — [position] Interview at CaresLink" and a friendly message reminding them to book their interview slot.

TASK 3 — Send interview reminders:
List upcoming interviews in the next 24 hours where the reminder has NOT been sent yet. Send a reminder for each one.

After completing all tasks, provide a brief summary of exactly what you did: how many candidates you contacted, how many follow-ups you sent, and how many reminders you sent.`;

    const report = await runAgent(goal);
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
