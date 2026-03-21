/**
 * BullMQ job queue with Upstash Redis
 *
 * Replaces node-cron with durable, retryable job scheduling.
 * Jobs survive server restarts and automatically retry on failure.
 */
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

// ── Redis connection ─────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL;

function createRedisConnection() {
  if (!REDIS_URL) {
    throw new Error("REDIS_URL environment variable is not set");
  }
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  });
}

let connection: IORedis | null = null;

function getConnection() {
  if (!connection) {
    connection = createRedisConnection();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return connection as any;
}

// ── Queue names ──────────────────────────────────────────────
export const QUEUE_NAMES = {
  REMINDERS: "interview-reminders",
  FOLLOW_UPS: "follow-up-sequence",
  AGENT_CRON: "agent-cron",
} as const;

// ── Queues ───────────────────────────────────────────────────
export function getReminderQueue() {
  return new Queue(QUEUE_NAMES.REMINDERS, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 }, // 30s, 60s, 120s
      removeOnComplete: { count: 100 },  // Keep last 100 completed
      removeOnFail: { count: 200 },      // Keep last 200 failed for debugging
    },
  });
}

export function getFollowUpQueue() {
  return new Queue(QUEUE_NAMES.FOLLOW_UPS, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 }, // 1min, 2min, 4min
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export function getAgentCronQueue() {
  return new Queue(QUEUE_NAMES.AGENT_CRON, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 120_000 }, // Retry after 2 min
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  });
}

// ── Schedule repeating jobs ──────────────────────────────────
let scheduled = false;

export async function scheduleRecurringJobs() {
  if (scheduled) return;
  scheduled = true;

  const reminderQ = getReminderQueue();
  const followUpQ = getFollowUpQueue();
  const agentCronQ = getAgentCronQueue();

  // Remove old repeatable jobs to avoid duplicates on restart
  for (const q of [reminderQ, followUpQ, agentCronQ]) {
    const existing = await q.getRepeatableJobs();
    for (const job of existing) {
      await q.removeRepeatableByKey(job.key);
    }
  }

  // Interview reminders — every 30 minutes
  await reminderQ.add(
    "check-reminders",
    {},
    { repeat: { pattern: "*/30 * * * *" } }
  );

  // Follow-up sequence — daily at 9 AM
  await followUpQ.add(
    "run-follow-ups",
    {},
    { repeat: { pattern: "0 9 * * *" } }
  );

  // Agent cron — weekdays at 9 AM
  await agentCronQ.add(
    "run-agent",
    {},
    { repeat: { pattern: "0 9 * * 1-5" } }
  );

  console.log("[BullMQ] Scheduled recurring jobs:");
  console.log("  - Interview reminders: every 30 min (3 retries, exponential backoff)");
  console.log("  - Follow-up sequence: daily at 9 AM (3 retries)");
  console.log("  - Agent cron: weekdays at 9 AM (2 retries)");
}

// ── Workers ──────────────────────────────────────────────────
let workersStarted = false;

export function startWorkers() {
  if (workersStarted) return;
  workersStarted = true;

  // Worker: Interview Reminders
  const reminderWorker = new Worker(
    QUEUE_NAMES.REMINDERS,
    async (job) => {
      console.log(`[BullMQ] Running reminder check (attempt ${job.attemptsMade + 1}/${job.opts.attempts})...`);
      const { checkAndSendReminders } = await import("./cron-jobs");
      await checkAndSendReminders();
    },
    {
      connection: getConnection(),
      concurrency: 1, // One reminder check at a time
    }
  );

  // Worker: Follow-up Sequence
  const followUpWorker = new Worker(
    QUEUE_NAMES.FOLLOW_UPS,
    async (job) => {
      console.log(`[BullMQ] Running follow-up sequence (attempt ${job.attemptsMade + 1}/${job.opts.attempts})...`);
      const { runFollowUpSequence } = await import("./cron-jobs");
      await runFollowUpSequence();
    },
    {
      connection: getConnection(),
      concurrency: 1,
    }
  );

  // Worker: Agent Cron
  const agentCronWorker = new Worker(
    QUEUE_NAMES.AGENT_CRON,
    async (job) => {
      console.log(`[BullMQ] Running agent cron (attempt ${job.attemptsMade + 1}/${job.opts.attempts})...`);
      const { runAgentCronJob } = await import("./cron-jobs");
      await runAgentCronJob();
    },
    {
      connection: getConnection(),
      concurrency: 1,
    }
  );

  // Event logging for all workers
  for (const [name, worker] of Object.entries({
    reminders: reminderWorker,
    followUps: followUpWorker,
    agentCron: agentCronWorker,
  })) {
    worker.on("completed", (job) => {
      console.log(`[BullMQ] ${name} job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
      const attemptsLeft = job ? (job.opts.attempts ?? 0) - job.attemptsMade : 0;
      console.error(
        `[BullMQ] ${name} job ${job?.id} failed: ${err.message}` +
        (attemptsLeft > 0 ? ` — ${attemptsLeft} retries left` : " — no retries left")
      );
    });
  }

  console.log("[BullMQ] Workers started for: reminders, follow-ups, agent-cron");
}

// ── Graceful shutdown ────────────────────────────────────────
export async function closeQueues() {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
