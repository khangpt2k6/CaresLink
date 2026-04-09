import "dotenv/config";
import { closeQueues, startCredentialVerifyWorker } from "../src/lib/queue";

function ensureEnv(name: string) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for credential verify worker`);
  }
}

async function main() {
  ensureEnv("REDIS_URL");
  ensureEnv("DATABASE_URL");

  startCredentialVerifyWorker();
  console.log("[Worker] credential verify worker is running");
}

main().catch((err) => {
  console.error("[Worker] failed to start:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[Worker] received ${signal}, shutting down...`);
  await closeQueues();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
