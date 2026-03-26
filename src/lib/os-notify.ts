/**
 * OS-level toast notifications for CaresLink.
 * Uses native Windows Toast API (same system as Snipping Tool, Messenger, Zalo)
 * so notifications appear in the Windows notification center / sidebar
 * even when the browser is hidden behind other windows.
 */

import { exec } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const LOGO_PATH = path.join(process.cwd(), "src", "lib", "careslink_logo.jpg")
  .replace(/\//g, "\\");
const hasLogo = fs.existsSync(LOGO_PATH);
const IS_WIN = process.platform === "win32";

/**
 * Send a native OS toast notification.
 * On Windows: uses PowerShell + Windows.UI.Notifications (same as Snipping Tool, Teams, Zalo).
 * On other platforms: falls back to node-notifier.
 */
export function sendNotification(opts: {
  title: string;
  message: string;
  type?: "info" | "warning" | "error";
}) {
  const { title, message, type = "warning" } = opts;

  if (IS_WIN) {
    sendWindowsToast(title, message);
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notifier = require("node-notifier");
      notifier.notify({ title, message, icon: hasLogo ? LOGO_PATH : undefined });
    } catch {
      // silent fallback
    }
  }

  console.log(`[os-notify] ${type.toUpperCase()}: ${title} — ${message}`);
}

/**
 * Native Windows toast notification via a temp PowerShell script.
 * Writes a .ps1 file to avoid shell escaping issues, then executes it.
 */
function sendWindowsToast(title: string, message: string) {
  const escXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  const logoXml = hasLogo
    ? `<image placement="appLogoOverride" src="${LOGO_PATH}" />`
    : "";

  const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$template = @"
<toast duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>${escXml(title)}</text>
      <text>${escXml(message)}</text>
      ${logoXml}
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Default"/>
</toast>
"@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("CaresLink").Show($toast)
`;

  // Write to a temp file to avoid all shell escaping issues
  const tmpFile = path.join(os.tmpdir(), `careslink-toast-${Date.now()}.ps1`);
  fs.writeFileSync(tmpFile, script, "utf-8");

  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { windowsHide: true },
    (err) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        console.error("[os-notify] Toast error:", err.message);
        // Fallback: try balloon notification
        sendBalloonFallback(title, message);
      }
    }
  );
}

/** Fallback: system tray balloon notification if WinRT toast fails */
function sendBalloonFallback(title: string, message: string) {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle = '${title.replace(/'/g, "''")}'
$n.BalloonTipText = '${message.replace(/'/g, "''")}'
$n.Visible = $true
$n.ShowBalloonTip(15000)
Start-Sleep -Seconds 16
$n.Dispose()
`;

  const tmpFile = path.join(os.tmpdir(), `careslink-balloon-${Date.now()}.ps1`);
  fs.writeFileSync(tmpFile, script, "utf-8");

  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { windowsHide: true },
    (err) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) console.error("[os-notify] Balloon fallback error:", err.message);
    }
  );
}

/** Pre-built notification: CAPTCHA/security check needs human intervention */
export function notifyCaptchaRequired(source: string) {
  sendNotification({
    title: "CaresLink — Action Required",
    message: `${source} needs human verification. Switch to Chrome and complete the security check.`,
    type: "warning",
  });
}

/** Notification: verification completed/failed/timed out */
export function notifyVerificationProgress(source: string, status: "passed" | "failed" | "timeout") {
  const messages = {
    passed: `${source} check passed! Automation continuing.`,
    failed: `${source} verification failed. Check the browser.`,
    timeout: `${source} check timed out. Please try again.`,
  };

  sendNotification({
    title: `CaresLink — ${status === "passed" ? "Continuing" : "Attention"}`,
    message: messages[status],
    type: status === "passed" ? "info" : "error",
  });
}
