import { prisma } from "./db";

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time (ET)",
  "America/Chicago": "Central Time (CT)",
  "America/Denver": "Mountain Time (MT)",
  "America/Los_Angeles": "Pacific Time (PT)",
  "America/Anchorage": "Alaska Time (AKT)",
  "Pacific/Honolulu": "Hawaii Time (HT)",
  "Europe/London": "Greenwich Mean Time (GMT)",
  "Europe/Paris": "Central European Time (CET)",
  "Europe/Berlin": "Central European Time (CET)",
  "Asia/Tokyo": "Japan Standard Time (JST)",
  "Asia/Shanghai": "China Standard Time (CST)",
  "Asia/Kolkata": "India Standard Time (IST)",
  "Asia/Ho_Chi_Minh": "Indochina Time (ICT)",
  "Australia/Sydney": "Australian Eastern Time (AET)",
  "UTC": "Coordinated Universal Time (UTC)",
};

export const SUPPORTED_TIMEZONES = Object.entries(TIMEZONE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export async function getTimezone(): Promise<string> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return settings?.timezone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export async function getDefaultDuration(): Promise<number> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return settings?.defaultDuration || 60;
  } catch {
    return 60;
  }
}

export function getTimezoneLabel(tz: string): string {
  return TIMEZONE_LABELS[tz] || tz;
}

export function formatInTimezone(date: Date, tz: string, formatStr: string): string {
  // Use Intl.DateTimeFormat for timezone-aware formatting
  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function getTimezoneAbbr(tz: string): string {
  // Get short timezone abbreviation like "EST", "PST"
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(now);
  return parts.find((p) => p.type === "timeZoneName")?.value || tz;
}
