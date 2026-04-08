import { prisma } from "@/lib/db";
import { getPlanFromPriceId } from "@/lib/stripe";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
export type AiPlan = "free" | "starter" | "pro";

export interface AiPlanLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  monthlyBudgetCents: number;
}

export interface AiAccessSnapshot {
  plan: AiPlan;
  premium: boolean;
  limits: AiPlanLimits;
  usage: {
    minuteRequests: number;
    dayRequests: number;
    monthCostCents: number;
  };
}

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPlanLimits(plan: AiPlan): AiPlanLimits {
  if (plan === "pro") {
    return {
      requestsPerMinute: intEnv("AI_PRO_REQUESTS_PER_MINUTE", 60),
      requestsPerDay: intEnv("AI_PRO_REQUESTS_PER_DAY", 1500),
      monthlyBudgetCents: intEnv("AI_PRO_MONTHLY_BUDGET_CENTS", 7000),
    };
  }

  if (plan === "starter") {
    return {
      requestsPerMinute: intEnv("AI_STARTER_REQUESTS_PER_MINUTE", 30),
      requestsPerDay: intEnv("AI_STARTER_REQUESTS_PER_DAY", 400),
      monthlyBudgetCents: intEnv("AI_STARTER_MONTHLY_BUDGET_CENTS", 2500),
    };
  }

  return {
    requestsPerMinute: intEnv("AI_FREE_REQUESTS_PER_MINUTE", 5),
    requestsPerDay: intEnv("AI_FREE_REQUESTS_PER_DAY", 40),
    monthlyBudgetCents: intEnv("AI_FREE_MONTHLY_BUDGET_CENTS", 300),
  };
}

export async function getUserSubscription(userId: string) {
  return prisma.userSubscription.findUnique({ where: { userId } });
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (!sub) return false;

  const now = new Date();

  if (sub.premiumUntil && sub.premiumUntil > now) {
    return true;
  }

  if (sub.currentPeriodEnd && sub.currentPeriodEnd > now && ACTIVE_STATUSES.has(sub.status)) {
    return true;
  }

  return ACTIVE_STATUSES.has(sub.status);
}

export async function getAiAccessSnapshot(userId: string): Promise<AiAccessSnapshot> {
  const [subscription, premium] = await Promise.all([
    getUserSubscription(userId),
    hasPremiumAccess(userId),
  ]);

  const paidPlan = getPlanFromPriceId(subscription?.stripePriceId);
  const plan: AiPlan = premium && paidPlan !== "free" ? paidPlan : "free";
  const limits = getPlanLimits(plan);

  const now = new Date();
  const minuteStart = new Date(now.getTime() - 60_000);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [minuteRequests, dayRequests, monthUsage] = await Promise.all([
    prisma.aIUsageLog.count({
      where: {
        userId,
        endpoint: "agent",
        createdAt: { gte: minuteStart },
      },
    }),
    prisma.aIUsageLog.count({
      where: {
        userId,
        endpoint: "agent",
        createdAt: { gte: dayStart },
      },
    }),
    prisma.aIUsageLog.aggregate({
      where: {
        userId,
        endpoint: "agent",
        createdAt: { gte: monthStart },
      },
      _sum: { costCents: true },
    }),
  ]);

  return {
    plan,
    premium,
    limits,
    usage: {
      minuteRequests,
      dayRequests,
      monthCostCents: monthUsage._sum.costCents ?? 0,
    },
  };
}
