import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { requireUser } from "@/lib/clerk-auth";
import { getAiAccessSnapshot } from "@/lib/subscription";
import type { AgentAttachment } from "@/lib/agent";

function sseData(payload: Record<string, unknown>) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

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
    const model: string | undefined = typeof body.model === "string" ? body.model : undefined;
    const thinkingBudget: number | undefined = typeof body.thinkingBudget === "number" ? body.thinkingBudget : undefined;
    const stream = body.stream === true;
    const attachments: AgentAttachment[] = Array.isArray(body.attachments)
      ? body.attachments
          .filter((a: unknown): a is AgentAttachment => {
            if (!a || typeof a !== "object") return false;
            const obj = a as Record<string, unknown>;
            return (
              typeof obj.name === "string" &&
              typeof obj.mediaType === "string" &&
              (obj.kind === "image" || obj.kind === "text" || obj.kind === "file")
            );
          })
          .slice(0, 4)
      : [];

    if ((!message || typeof message !== "string") && attachments.length === 0) {
      return NextResponse.json(
        { error: "message/prompt or attachments are required" },
        { status: 400 }
      );
    }

    if (!stream) {
      const response = await runAgent(message, sessionId, auth.user.id, thinkingBudget, attachments, model);
      return NextResponse.json({ response, plan: access.plan });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            controller.enqueue(encoder.encode(sseData({ type: "status", text: "Thinking..." })));

            let emittedText = "";
            const finalText = await runAgent(
              message,
              sessionId,
              auth.user.id,
              thinkingBudget,
              attachments,
              model,
              {
                onText(text) {
                  if (!text) return;
                  const delta = text.startsWith(emittedText) ? text.slice(emittedText.length) : text;
                  emittedText = text;
                  if (!delta) return;
                  controller.enqueue(encoder.encode(sseData({ type: "delta", text: delta })));
                },
                onToolStart(toolName) {
                  controller.enqueue(encoder.encode(sseData({ type: "status", text: `Running ${toolName}...` })));
                },
              }
            );

            if (!emittedText && finalText) {
              controller.enqueue(encoder.encode(sseData({ type: "delta", text: finalText })));
            }
            controller.enqueue(encoder.encode(sseData({ type: "done" })));
            controller.close();
          } catch (err) {
            const error = err instanceof Error ? err.message : "Agent failed";
            controller.enqueue(encoder.encode(sseData({ type: "error", error })));
            controller.close();
          }
        })();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 }
    );
  }
}
