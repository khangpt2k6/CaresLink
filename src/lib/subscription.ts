// Stub: subscription/billing removed. Rate-limiting can be reintroduced later
// without Stripe. Callers that treat `null` as "no rate limit" work unchanged.

export type AiPlan = "free" | "starter" | "pro";

export interface AiPlanLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  monthlyBudgetCents: number;
}

export interface AiAccessSnapshot {
  plan: AiPlan;
  limits: AiPlanLimits;
  usage: {
    minuteRequests: number;
    dayRequests: number;
    monthCostCents: number;
  };
}

export async function getAiAccessSnapshot(_userId: string): Promise<AiAccessSnapshot | null> {
  return null;
}
