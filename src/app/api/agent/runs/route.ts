import { NextResponse } from "next/server";

// agentRun table does not exist on Flutter production DB. Return empty list
// until we decide whether to derive from ai_usage_log or add a new table.
export async function GET() {
  return NextResponse.json({ runs: [] });
}
