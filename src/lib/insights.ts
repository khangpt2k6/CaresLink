import { prisma } from "./db";

export interface RecruitmentMetrics {
  totalCandidates: number;
  emailsSent: number;
  responseRateEmail: number;
  interviewsScheduled: number;
  noShowCount: number;
  noShowRate: number;
  totalCost: number;
  costPerHire: number;
  hiresCount: number;
  timeToHireDays: number | null;
  periodStart: Date;
  periodEnd: Date;
}

export interface StaleCandidate {
  id: string;
  name: string;
  email: string;
  position: string;
  daysSinceLastOutreach: number;
  lastOutreachType: string;
}

export interface Insight {
  title: string;
  description: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

export async function getMetrics(
  position?: string,
  daysBack = 30
): Promise<RecruitmentMetrics> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const where: { createdAt: { gte: Date; lte: Date }; candidate?: { position: string } } = {
    createdAt: { gte: periodStart, lte: periodEnd },
  };
  if (position) {
    where.candidate = { position };
  }

  const events = await prisma.event.findMany({
    where,
    include: { candidate: true },
  });

  // Count all email-related events: direct emails, booking links, reminders
  const emailEventTypes = ["email_sent", "booking_link_sent", "reminder_sent", "template_email_sent"];
  const emailsSent = events.filter((e) => emailEventTypes.includes(e.type)).length;
  const emailOpened = events.filter((e) => e.type === "email_opened").length;
  const interviews = events.filter((e) =>
    e.type === "interview_scheduled" || e.type === "self_booked"
  ).length;
  const noShows = events.filter((e) => e.type === "interview_no_show").length;
  const hires = events.filter(
    (e) => e.type === "status_changed" && (e.metadata || "").toLowerCase().includes("hired")
  ).length;

  const uniqueCandidates = new Set(events.map((e) => e.candidateId).filter(Boolean)).size;
  const totalCost = events.reduce((s, e) => s + (e.cost || 0), 0);

  // Time-to-hire: from appliedAt to hire event (status_changed with hired)
  let timeToHireDays: number | null = null;
  const hireEvents = events.filter(
    (e) => e.type === "status_changed" && (e.metadata || "").toLowerCase().includes("hired")
  );
  if (hireEvents.length > 0) {
    const days: number[] = [];
    for (const e of hireEvents) {
      if (e.candidate?.appliedAt) {
        const applied = new Date(e.candidate.appliedAt).getTime();
        const hired = new Date(e.createdAt).getTime();
        days.push((hired - applied) / (24 * 60 * 60 * 1000));
      }
    }
    if (days.length > 0) {
      timeToHireDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    }
  }

  return {
    totalCandidates: uniqueCandidates,
    emailsSent,
    responseRateEmail: emailsSent ? emailOpened / emailsSent : 0,
    interviewsScheduled: interviews,
    noShowCount: noShows,
    noShowRate: interviews ? noShows / interviews : 0,
    totalCost,
    costPerHire: hires ? totalCost / hires : 0,
    hiresCount: hires,
    timeToHireDays,
    periodStart,
    periodEnd,
  };
}

export async function getStaleCandidates(minDays = 5): Promise<StaleCandidate[]> {
  const outreachTypes = ["email_sent", "booking_link_sent", "template_email_sent"];
  const responseTypes = ["interview_scheduled", "self_booked"];

  const candidates = await prisma.candidate.findMany({
    where: { status: "contacted" },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  const stale: StaleCandidate[] = [];
  const now = new Date();

  for (const c of candidates) {
    const events = c.events;
    const lastOutreach = events.find((e) => outreachTypes.includes(e.type));
    if (!lastOutreach) continue;

    const outreachAt = new Date(lastOutreach.createdAt);
    const hasRespondedAfter = events.some(
      (e) => responseTypes.includes(e.type) && new Date(e.createdAt) > outreachAt
    );
    if (hasRespondedAfter) continue;

    const daysSince = Math.floor((now.getTime() - outreachAt.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince >= minDays) {
      stale.push({
        id: c.id,
        name: c.name,
        email: c.email,
        position: c.position,
        daysSinceLastOutreach: daysSince,
        lastOutreachType: lastOutreach.type,
      });
    }
  }

  stale.sort((a, b) => b.daysSinceLastOutreach - a.daysSinceLastOutreach);
  return stale;
}

export function getInsights(metrics: RecruitmentMetrics, staleCount = 0): Insight[] {
  const insights: Insight[] = [];

  if (metrics.noShowRate > 0.15) {
    insights.push({
      title: "High No-Show Rate",
      description: `Your interview no-show rate is ${(metrics.noShowRate * 100).toFixed(0)}%, above the 15% benchmark.`,
      metric: "noShowRate",
      currentValue: `${(metrics.noShowRate * 100).toFixed(0)}%`,
      recommendedAction:
        "Enable email reminders 24h before interviews; consider a confirmation reply flow.",
      priority: "high",
    });
  } else if (metrics.noShowRate > 0) {
    insights.push({
      title: "No-Show Rate in Line",
      description: `No-show rate is ${(metrics.noShowRate * 100).toFixed(0)}%. Room to improve with more reminders.`,
      metric: "noShowRate",
      currentValue: `${(metrics.noShowRate * 100).toFixed(0)}%`,
      recommendedAction: "Add a 1-hour-before email reminder to further reduce no-shows.",
      priority: "low",
    });
  }

  if (metrics.hiresCount > 0 && metrics.costPerHire > 500) {
    insights.push({
      title: "High Cost Per Hire",
      description: `Cost per hire is $${metrics.costPerHire.toFixed(0)}, above typical $300–500 range.`,
      metric: "costPerHire",
      currentValue: `$${metrics.costPerHire.toFixed(0)}`,
      recommendedAction:
        "Automate more touchpoints; batch similar interviews; reduce manual outreach.",
      priority: "high",
    });
  }

  if (metrics.emailsSent >= 3 && metrics.responseRateEmail < 0.2) {
    insights.push({
      title: "Low Email Response Rate",
      description: `Only ${(metrics.responseRateEmail * 100).toFixed(0)}% of emails get responses.`,
      metric: "responseRateEmail",
      currentValue: `${(metrics.responseRateEmail * 100).toFixed(0)}%`,
      recommendedAction:
        "Improve subject lines; send at optimal times (Tue–Thu 10–11am); add a follow-up email sequence.",
      priority: "high",
    });
  }

  if (metrics.hiresCount > 0 && metrics.timeToHireDays != null) {
    const benchmark = 14; // typical 10–14 days
    if (metrics.timeToHireDays > benchmark) {
      insights.push({
        title: "Time-to-Hire Above Benchmark",
        description: `Average time-to-hire is ${metrics.timeToHireDays} days (benchmark: ~${benchmark} days).`,
        metric: "timeToHireDays",
        currentValue: `${metrics.timeToHireDays} days`,
        recommendedAction: "Streamline scheduling; use booking links; reduce back-and-forth.",
        priority: "medium",
      });
    } else {
      insights.push({
        title: "Time-to-Hire On Track",
        description: `Average time-to-hire is ${metrics.timeToHireDays} days.`,
        metric: "timeToHireDays",
        currentValue: `${metrics.timeToHireDays} days`,
        recommendedAction: "Keep using automated scheduling and reminders.",
        priority: "low",
      });
    }
  }

  if (staleCount > 0) {
    insights.push({
      title: "Candidates Need Follow-Up",
      description: `${staleCount} candidate${staleCount === 1 ? "" : "s"} haven't replied in 5+ days after outreach.`,
      metric: "staleCandidates",
      currentValue: String(staleCount),
      recommendedAction: "Use Contact AI to send a friendly follow-up email or booking link.",
      priority: "medium",
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return insights;
}
