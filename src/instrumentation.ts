export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.DISABLE_IN_PROCESS_CRON === "1") return;
    if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_CRON !== "1") return;
    const { startCronJobs } = await import("./lib/cron");
    startCronJobs();
  }
}
