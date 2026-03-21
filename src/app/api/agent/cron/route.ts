import { NextRequest, NextResponse } from "next/server";
import { runAgentCronJob } from "@/lib/cron-jobs";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && bearerToken !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    // If BullMQ is available, add the job to the queue for durable execution with retries
    if (process.env.REDIS_URL) {
      const { getAgentCronQueue } = await import("@/lib/queue");
      const queue = getAgentCronQueue();
      const job = await queue.add("manual-agent-run", {}, {
        attempts: 2,
        backoff: { type: "fixed", delay: 120_000 },
      });
      return NextResponse.json({
        success: true,
        message: "Agent cron job queued via BullMQ (retries on failure)",
        jobId: job.id,
        startedAt: startedAt.toISOString(),
      });
    }

    // Fallback: run directly (no queue, no retries)
    await runAgentCronJob();
    const completedAt = new Date();

    return NextResponse.json({
      success: true,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
  } catch (e) {
    console.error("[agent/cron] error:", e);
    const errorMsg = e instanceof Error ? e.message : "Cron agent failed";
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
