import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all usage logs for the period
    const logs = await prisma.aIUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate totals
    const totalRequests = logs.length;
    const totalInputTokens = logs.reduce((s, l) => s + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((s, l) => s + l.outputTokens, 0);
    const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
    const totalCostCents = logs.reduce((s, l) => s + l.costCents, 0);
    const totalErrors = logs.filter((l) => !l.success).length;
    const avgDurationMs = totalRequests > 0
      ? Math.round(logs.reduce((s, l) => s + l.durationMs, 0) / totalRequests)
      : 0;

    // Per-provider breakdown
    const byProvider: Record<string, { requests: number; tokens: number; costCents: number }> = {};
    for (const log of logs) {
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = { requests: 0, tokens: 0, costCents: 0 };
      }
      byProvider[log.provider].requests++;
      byProvider[log.provider].tokens += log.totalTokens;
      byProvider[log.provider].costCents += log.costCents;
    }

    // Per-model breakdown
    const byModel: Record<string, { requests: number; tokens: number; costCents: number }> = {};
    for (const log of logs) {
      if (!byModel[log.model]) {
        byModel[log.model] = { requests: 0, tokens: 0, costCents: 0 };
      }
      byModel[log.model].requests++;
      byModel[log.model].tokens += log.totalTokens;
      byModel[log.model].costCents += log.costCents;
    }

    // Per-endpoint breakdown
    const byEndpoint: Record<string, { requests: number; tokens: number; costCents: number }> = {};
    for (const log of logs) {
      const ep = log.endpoint || "unknown";
      if (!byEndpoint[ep]) {
        byEndpoint[ep] = { requests: 0, tokens: 0, costCents: 0 };
      }
      byEndpoint[ep].requests++;
      byEndpoint[ep].tokens += log.totalTokens;
      byEndpoint[ep].costCents += log.costCents;
    }

    // Daily breakdown for chart (last N days)
    const dailyMap: Record<string, { requests: number; tokens: number; costCents: number }> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { requests: 0, tokens: 0, costCents: 0 };
      }
      dailyMap[day].requests++;
      dailyMap[day].tokens += log.totalTokens;
      dailyMap[day].costCents += log.costCents;
    }
    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Today's usage (for rate limit display)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter((l) => l.createdAt >= todayStart);
    const todayRequests = todayLogs.length;
    const todayCostCents = todayLogs.reduce((s, l) => s + l.costCents, 0);

    // This minute's usage (for per-minute rate limit)
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const minuteRequests = logs.filter((l) => l.createdAt >= oneMinuteAgo).length;

    // This month's usage
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthLogs = logs.filter((l) => l.createdAt >= monthStart);
    const monthCostCents = monthLogs.reduce((s, l) => s + l.costCents, 0);
    const monthRequests = monthLogs.length;
    const monthTokens = monthLogs.reduce((s, l) => s + l.totalTokens, 0);

    // Get rate limits from settings
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    const rateLimits = {
      perMinute: (settings as Record<string, unknown>)?.rateLimitPerMinute ?? 30,
      perDay: (settings as Record<string, unknown>)?.rateLimitPerDay ?? 1000,
      monthlyBudgetCents: (settings as Record<string, unknown>)?.monthlyBudgetCents ?? 5000,
    };

    // Recent logs (last 20)
    const recentLogs = logs.slice(0, 20).map((l) => ({
      id: l.id,
      provider: l.provider,
      model: l.model,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      totalTokens: l.totalTokens,
      costCents: l.costCents,
      durationMs: l.durationMs,
      endpoint: l.endpoint,
      success: l.success,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      totals: {
        requests: totalRequests,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        costCents: totalCostCents,
        errors: totalErrors,
        avgDurationMs,
      },
      today: { requests: todayRequests, costCents: todayCostCents },
      thisMinute: { requests: minuteRequests },
      thisMonth: { requests: monthRequests, tokens: monthTokens, costCents: monthCostCents },
      rateLimits,
      byProvider,
      byModel,
      byEndpoint,
      daily,
      recentLogs,
    });
  } catch (e) {
    console.error("Failed to fetch usage:", e);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
