import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { requireUser } from "@/lib/clerk-auth";
import { hasPremiumAccess } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const premium = await hasPremiumAccess(auth.user.id);
  if (!premium) {
    return NextResponse.json(
      {
        error: "Premium subscription required to use the AI agent.",
        code: "PREMIUM_REQUIRED",
      },
      { status: 402 }
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
    return NextResponse.json({ response });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
