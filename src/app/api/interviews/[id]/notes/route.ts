import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { textCompletion } from "@/lib/ai-provider";

// POST /api/interviews/[id]/notes — generate AI notes from current transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const transcripts = await prisma.interviewTranscript.findMany({
    where: { interviewId: id },
    orderBy: { timestampMs: "asc" },
  });

  if (transcripts.length === 0) {
    return NextResponse.json({ notes: [] });
  }

  const fullTranscript = transcripts
    .map((t) => `[${t.speaker}]: ${t.content}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an AI assistant helping a recruiter take notes during a job interview.

Based on the interview transcript below, extract key notes. For each note, classify it as one of:
- "strength" — a positive signal about the candidate
- "concern" — a potential red flag or area of concern
- "follow_up" — something to follow up on later
- "general" — general observation

Return ONLY a JSON array, no extra text. Example:
[
  { "content": "Strong leadership experience managing teams of 10+", "category": "strength" },
  { "content": "Unclear on technical depth in cloud infrastructure", "category": "concern" }
]

Transcript:
${fullTranscript}`,
      },
    ],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "[]";

  let parsed: { content: string; category: string }[] = [];
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.error("Failed to parse Claude notes:", rawText);
    return NextResponse.json({ error: "Failed to parse AI notes" }, { status: 500 });
  }

  // Delete old AI notes and re-insert fresh ones
  await prisma.interviewNote.deleteMany({
    where: { interviewId: id, source: "ai" },
  });

  const notes = await prisma.interviewNote.createMany({
    data: parsed.map((n) => ({
      interviewId: id,
      content: n.content,
      category: n.category,
      source: "ai",
    })),
  });

  const savedNotes = await prisma.interviewNote.findMany({
    where: { interviewId: id, source: "ai" },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ notes: savedNotes });
}

// GET /api/interviews/[id]/notes — fetch all notes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const notes = await prisma.interviewNote.findMany({
    where: { interviewId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(notes);
}
