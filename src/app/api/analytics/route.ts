import { NextRequest, NextResponse } from "next/server";
import { getMetrics, getInsights } from "@/lib/insights";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || undefined;
    const daysBack = parseInt(searchParams.get("days") || "30", 10);

    const metrics = await getMetrics(position, daysBack);
    const insights = getInsights(metrics);

    return NextResponse.json({ metrics, insights });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
