import { NextRequest, NextResponse } from "next/server";
import { getMetrics, getInsights, getStaleCandidates } from "@/lib/insights";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || undefined;
    const daysBack = parseInt(searchParams.get("days") || "30", 10);

    const [metrics, staleCandidates] = await Promise.all([
      getMetrics(position, daysBack),
      getStaleCandidates(5),
    ]);
    const insights = getInsights(metrics, staleCandidates.length);

    return NextResponse.json({ metrics, insights, staleCandidates });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
