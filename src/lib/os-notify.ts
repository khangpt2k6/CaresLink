/**
 * OS-level toast notifications for CaresLink.
 * Shows native Windows/macOS/Linux notifications (like Zalo, Messenger desktop apps)
 * so the user sees them even when the browser is behind other windows.
 */

import notifier from "node-notifier";
import path from "path";
import fs from "fs";

const LOGO_PATH = path.join(process.cwd(), "src", "lib", "careslink_logo.jpg");
const hasLogo = fs.existsSync(LOGO_PATH);

/**
 * Send a native OS toast notification.
 * On Windows: appears in the bottom-right notification sidebar.
 * On macOS: appears in the top-right Notification Center.
 */
export function sendNotification(opts: {
  title: string;
  message: string;
  /** "info" | "warning" | "error" — controls the urgency/icon */
  type?: "info" | "warning" | "error";
  /** How long the notification stays visible (seconds). Default: 15 */
  timeout?: number;
}) {
  const { title, message, type = "warning", timeout = 15 } = opts;

  notifier.notify(
    {
      title,
      message,
      icon: hasLogo ? LOGO_PATH : undefined,
      wait: false,
      timeout,
      appID: "CaresLink",
    } as Parameters<typeof notifier.notify>[0],
    (err) => {
      if (err) console.error("[os-notify] Notification error:", err);
    }
  );

  console.log(`[os-notify] ${type.toUpperCase()}: ${title} — ${message}`);
}

/** Pre-built notification for when a CAPTCHA/security check needs human intervention */
export function notifyCaptchaRequired(source: string) {
  sendNotification({
    title: `CaresLink — Action Required`,
    message: `${source} needs human verification. Please switch to the Chrome window and complete the security check.`,
    type: "warning",
    timeout: 30,
  });
}

/** Notification for when verification completes */
export function notifyVerificationProgress(source: string, status: "passed" | "failed" | "timeout") {
  const messages = {
    passed: `${source} security check passed! Automation is continuing.`,
    failed: `${source} verification failed. Check the browser window.`,
    timeout: `${source} security check timed out. Please try again.`,
  };

  sendNotification({
    title: `CaresLink — ${status === "passed" ? "Continuing" : "Attention"}`,
    message: messages[status],
    type: status === "passed" ? "info" : "error",
    timeout: 10,
  });
}
