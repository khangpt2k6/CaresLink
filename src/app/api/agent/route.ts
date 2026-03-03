import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message ?? body.prompt ?? "";
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message or prompt is required" },
        { status: 400 }
      );
    }

    const response = await runAgent(message);
    return NextResponse.json({ response });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
