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
  periodStart: Date;
  periodEnd: Date;
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

  const emailsSent = events.filter((e) => e.type === "email_sent").length;
  const emailOpened = events.filter((e) => e.type === "email_opened").length;
  const interviews = events.filter((e) => e.type === "interview_scheduled").length;
  const noShows = events.filter((e) => e.type === "interview_no_show").length;
  const hires = events.filter(
    (e) => e.type === "status_changed" && (e.metadata || "").toLowerCase().includes("hired")
  ).length;

  const uniqueCandidates = new Set(events.map((e) => e.candidateId).filter(Boolean)).size;
  const totalCost = events.reduce((s, e) => s + (e.cost || 0), 0);

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
    periodStart,
    periodEnd,
  };
}

export function getInsights(metrics: RecruitmentMetrics): Insight[] {
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

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return insights;
}
