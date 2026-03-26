/**
 * OS-level toast notifications for CaresLink.
 * Uses native Windows Toast API (same system as Snipping Tool, Messenger, Zalo)
 * so notifications appear in the Windows notification center / sidebar
 * even when the browser is hidden behind other windows.
 *
 * KEY REQUIREMENT for Windows 10/11:
 * The AppUserModelID must be registered in the Windows registry BEFORE
 * CreateToastNotifier() is called, otherwise the notification is silently
 * dropped. This module handles registration automatically on first use.
 */

import { exec, execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const LOGO_PATH = path.join(process.cwd(), "src", "lib", "careslink_logo.jpg")
  .replace(/\//g, "\\");
const hasLogo = fs.existsSync(LOGO_PATH);
const IS_WIN = process.platform === "win32";

/**
 * The AppUserModelID used for all CaresLink notifications.
 * Format: "CompanyName.AppName" — must match what is registered in the registry.
 */
const APP_ID = "CaresLink.Notifications";

/** Track whether we've already registered the AppUserModelID this session */
let appIdRegistered = false;

/**
 * Register the CaresLink AppUserModelID in the Windows registry.
 * This is REQUIRED for toast notifications to appear on Windows 10/11.
 * Without this, CreateToastNotifier() silently drops notifications.
 *
 * Registration only happens once per process lifetime.
 */
function ensureAppIdRegistered(): void {
  if (!IS_WIN || appIdRegistered) return;

  try {
    const regScript = `
$appId = "${APP_ID}"
$regPath = "HKCU:\\Software\\Classes\\AppUserModelId\\$appId"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
New-ItemProperty -Path $regPath -Name "DisplayName" -Value "CaresLink" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $regPath -Name "ShowInSettings" -Value 1 -PropertyType DWord -Force | Out-Null
`;
    const tmpFile = path.join(os.tmpdir(), `careslink-reg-${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, "\ufeff" + regScript, "utf-8");
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { windowsHide: true, timeout: 10_000 }
    );
    try { fs.unlinkSync(tmpFile); } catch {}
    appIdRegistered = true;
    console.log(`[os-notify] Registered AppUserModelId: ${APP_ID}`);
  } catch (err) {
    console.error("[os-notify] Failed to register AppUserModelId:", err);
    // Continue anyway — the notification might still work if previously registered
    appIdRegistered = true;
  }
}

/**
 * Send a native OS toast notification.
 * On Windows: uses PowerShell + Windows.UI.Notifications with a registered AppUserModelID.
 * On other platforms: falls back to node-notifier.
 */
export function sendNotification(opts: {
  title: string;
  message: string;
  type?: "info" | "warning" | "error";
}) {
  const { title, message, type = "warning" } = opts;

  if (IS_WIN) {
    ensureAppIdRegistered();
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
 * Uses Windows.UI.Notifications WinRT API with a registered AppUserModelID.
 *
 * WHY THE PREVIOUS VERSION DIDN'T WORK:
 * - CreateToastNotifier("CaresLink") used an unregistered AppID
 * - Windows 10/11 requires the AppID to exist in the registry at
 *   HKCU:\Software\Classes\AppUserModelId\<AppID>
 * - Without registration, the toast is silently dropped (no error thrown)
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
<toast duration="long" launch="careslink:notification">
  <visual>
    <binding template="ToastGeneric">
      <text>${escXml(title)}</text>
      <text>${escXml(message)}</text>
      ${logoXml}
      <text placement="attribution">CaresLink</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Reminder"/>
</toast>
"@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$toast.ExpirationTime = [DateTimeOffset]::Now.AddMinutes(30)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("${APP_ID}").Show($toast)
`;

  // Write to a temp file to avoid all shell escaping issues.
  // Prepend UTF-8 BOM so PowerShell reads special characters (em dash, ®) correctly.
  const tmpFile = path.join(os.tmpdir(), `careslink-toast-${Date.now()}.ps1`);
  fs.writeFileSync(tmpFile, "\ufeff" + script, "utf-8");

  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { windowsHide: true },
    (err) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        console.error("[os-notify] Toast error:", err.message);
        // Fallback: try snoretoast (bundled with node-notifier)
        sendSnoreToastFallback(title, message);
      }
    }
  );
}

/**
 * Fallback: use SnoreToast.exe (bundled with node-notifier) directly.
 * SnoreToast is a standalone .exe that can show Windows toast notifications.
 * It handles its own AppID registration via the --install flag.
 */
function sendSnoreToastFallback(title: string, message: string) {
  const snoreToastPath = path.join(
    process.cwd(),
    "node_modules", "node-notifier", "vendor", "snoreToast", "snoretoast-x64.exe"
  );

  if (!fs.existsSync(snoreToastPath)) {
    console.error("[os-notify] SnoreToast fallback unavailable — exe not found");
    sendBalloonFallback(title, message);
    return;
  }

  // Escape for command line
  const escCmd = (s: string) => s.replace(/"/g, '\\"');

  exec(
    `"${snoreToastPath}" -t "${escCmd(title)}" -m "${escCmd(message)}" -appID "${APP_ID}"`,
    { windowsHide: true },
    (err) => {
      if (err) {
        console.error("[os-notify] SnoreToast fallback error:", err.message);
        sendBalloonFallback(title, message);
      }
    }
  );
}

/** Last-resort fallback: system tray balloon notification */
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
  fs.writeFileSync(tmpFile, "\ufeff" + script, "utf-8");

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
