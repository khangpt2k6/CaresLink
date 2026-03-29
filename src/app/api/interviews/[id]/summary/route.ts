import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { textCompletion } from "@/lib/ai-provider";

// POST /api/interviews/[id]/summary — generate final AI summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const transcripts = await prisma.interviewTranscript.findMany({
    where: { interviewId: id },
    orderBy: { timestampMs: "asc" },
  });

  if (transcripts.length === 0) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  const fullTranscript = transcripts
    .map((t) => `[${t.speaker}]: ${t.content}`)
    .join("\n");

  const rawText = await textCompletion({
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an AI assistant summarizing a job interview for a recruiter.

Candidate: ${interview.candidate.name}
Position: ${interview.position}

Full transcript:
${fullTranscript}

IMPORTANT: Do NOT make any hiring recommendations. Your role is to provide factual analysis only. The hiring decision is made entirely by humans.

Return ONLY a JSON object with this exact structure (no extra text):
{
  "summary": "2-3 sentence factual overview of the interview — what was discussed, candidate background, and key topics covered",
  "strengths": ["observed strength 1", "observed strength 2"],
  "concerns": ["observed concern or gap 1"],
  "technicalRating": 1-5,
  "communicationRating": 1-5,
  "cultureFitRating": 1-5,
  "overallRating": 1-5,
  "nextSteps": ["suggested follow-up 1", "suggested follow-up 2"]
}`,
      },
    ],
  });

  let parsed: {
    summary: string;
    strengths: string[];
    concerns: string[];
    technicalRating: number;
    communicationRating: number;
    cultureFitRating: number;
    overallRating: number;
    nextSteps: string[];
  };

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (!parsed) throw new Error("No JSON found");
  } catch {
    console.error("Failed to parse Claude summary:", rawText);
    return NextResponse.json({ error: "Failed to parse AI summary" }, { status: 500 });
  }

  const summary = await prisma.interviewSummary.upsert({
    where: { interviewId: id },
    create: {
      interviewId: id,
      summary: parsed.summary,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      technicalRating: parsed.technicalRating,
      communicationRating: parsed.communicationRating,
      cultureFitRating: parsed.cultureFitRating,
      overallRating: parsed.overallRating,
      nextSteps: parsed.nextSteps,
    },
    update: {
      summary: parsed.summary,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      technicalRating: parsed.technicalRating,
      communicationRating: parsed.communicationRating,
      cultureFitRating: parsed.cultureFitRating,
      overallRating: parsed.overallRating,
      nextSteps: parsed.nextSteps,
    },
  });

  // Mark interview as completed
  await prisma.interview.update({
    where: { id },
    data: { completed: true },
  });

  return NextResponse.json({ summary });
}

// GET /api/interviews/[id]/summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireEmployer(request);
  if ("error" in result) return result.error;

  const { id } = await params;

  const summary = await prisma.interviewSummary.findUnique({
    where: { interviewId: id },
  });

  if (!summary) {
    return NextResponse.json({ summary: null });
  }

  return NextResponse.json({ summary });
}
