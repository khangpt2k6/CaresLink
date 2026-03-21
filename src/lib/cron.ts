/**
 * Cron job scheduler — BullMQ with Upstash Redis
 *
 * Replaces the old node-cron in-process scheduler with durable,
 * retryable job queues. Jobs survive server restarts and automatically
 * retry on failure with exponential backoff.
 *
 * Jobs:
 *  - Interview reminders: every 30 min (3 retries, 30s/60s/120s backoff)
 *  - Follow-up sequence:  daily at 9 AM (3 retries, 1m/2m/4m backoff)
 *  - Agent cron:          weekdays 9 AM (2 retries, 2m fixed backoff)
 */

let started = false;

export async function startCronJobs() {
  if (started) return;
  started = true;

  if (!process.env.REDIS_URL) {
    console.warn("[Cron] REDIS_URL not set — falling back to node-cron");
    const cron = await import("node-cron");
    const { checkAndSendReminders, runFollowUpSequence } = await import("./cron-jobs");

    cron.default.schedule("*/30 * * * *", async () => {
      try { await checkAndSendReminders(); }
      catch (e) { console.error("[Cron] Reminder check failed:", e); }
    });

    cron.default.schedule("0 9 * * *", async () => {
      try { await runFollowUpSequence(); }
      catch (e) { console.error("[Cron] Follow-up sequence failed:", e); }
    });

    console.log("[Cron] node-cron fallback started (no Redis)");
    return;
  }

  try {
    const { scheduleRecurringJobs, startWorkers } = await import("./queue");
    await scheduleRecurringJobs();
    startWorkers();
    console.log("[Cron] BullMQ scheduler started with Upstash Redis");
  } catch (err) {
    console.error("[Cron] BullMQ startup failed, falling back to node-cron:", err);
    started = false;
    // Remove REDIS_URL temporarily so fallback kicks in
    const savedUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    await startCronJobs();
    process.env.REDIS_URL = savedUrl;
  }
}
