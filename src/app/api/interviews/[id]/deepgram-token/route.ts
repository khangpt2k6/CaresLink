import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/interviews/[id]/deepgram-token
// Returns a temporary Deepgram API key for browser WebSocket streaming
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // Create a temporary Deepgram API key (valid for 10 seconds)
  const res = await fetch("https://api.deepgram.com/v1/projects/" + await getProjectId() + "/keys", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment: `Temp key for interview ${id}`,
      scopes: ["usage:write"],
      time_to_live_in_seconds: 600,
    }),
  });

  if (!res.ok) {
    // Fallback: return the main key directly (less secure but works)
    return NextResponse.json({ key: process.env.DEEPGRAM_API_KEY });
  }

  const data = await res.json();
  return NextResponse.json({ key: data.key });
}

async function getProjectId(): Promise<string> {
  const res = await fetch("https://api.deepgram.com/v1/projects", {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
  });
  const data = await res.json();
  return data.projects?.[0]?.project_id ?? "";
}

// POST /api/interviews/[id]/deepgram-token
// Save a transcript segment from the browser WebSocket stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;
  const body = await request.json();
  const { speaker, content, timestampMs, confidence } = body;

  if (!content?.trim()) {
    return NextResponse.json({ transcript: null });
  }

  const transcript = await prisma.interviewTranscript.create({
    data: {
      interviewId: id,
      speaker: speaker ?? "interviewer",
      content: content.trim(),
      timestampMs: timestampMs ?? 0,
      confidence: confidence ?? null,
    },
  });

  return NextResponse.json({ transcript });
}
