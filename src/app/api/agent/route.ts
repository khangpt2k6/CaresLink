import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { requireUser } from "@/lib/clerk-auth";
import { getAiAccessSnapshot } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const access = await getAiAccessSnapshot(auth.user.id);
  if (access.usage.minuteRequests >= access.limits.requestsPerMinute) {
    return NextResponse.json(
      {
        error: `Rate limit reached (${access.limits.requestsPerMinute}/min for ${access.plan} plan).`,
        code: "PLAN_RATE_LIMIT_MINUTE",
        plan: access.plan,
        aiAccess: access,
      },
      { status: 429 }
    );
  }

  if (access.usage.dayRequests >= access.limits.requestsPerDay) {
    return NextResponse.json(
      {
        error: `Daily limit reached (${access.limits.requestsPerDay}/day for ${access.plan} plan).`,
        code: "PLAN_RATE_LIMIT_DAY",
        plan: access.plan,
        aiAccess: access,
      },
      { status: 429 }
    );
  }

  if (access.usage.monthCostCents >= access.limits.monthlyBudgetCents) {
    return NextResponse.json(
      {
        error: `Monthly AI budget reached for ${access.plan} plan.`,
        code: "PLAN_BUDGET_LIMIT_MONTH",
        plan: access.plan,
        aiAccess: access,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const message = body.message ?? body.prompt ?? "";
    const sessionId: string | undefined = typeof body.sessionId === "string" ? body.sessionId : undefined;
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message or prompt is required" },
        { status: 400 }
      );
    }

    const response = await runAgent(message, sessionId, auth.user.id);
    return NextResponse.json({ response, plan: access.plan });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
