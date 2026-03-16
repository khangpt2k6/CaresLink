import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// POST /api/interviews/[id]/deepgram-token
// Transcribes an audio blob via Deepgram REST API and saves the transcript segment
export async function POST(
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

  const formData = await request.formData();
  const audio = formData.get("audio") as Blob | null;
  const speaker = (formData.get("speaker") as string) ?? "interviewer";
  const timestampMs = parseInt((formData.get("timestampMs") as string) ?? "0");

  if (!audio) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());

  // Send to Deepgram REST API
  const dgResponse = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=false",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audio.type || "audio/webm",
      },
      body: audioBuffer,
    }
  );

  if (!dgResponse.ok) {
    const err = await dgResponse.text();
    console.error("Deepgram error:", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }

  const dgData = await dgResponse.json();
  const content: string =
    dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const confidence: number =
    dgData?.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? null;

  if (!content.trim()) {
    return NextResponse.json({ transcript: null });
  }

  const transcript = await prisma.interviewTranscript.create({
    data: {
      interviewId: id,
      speaker,
      content,
      timestampMs,
      confidence,
    },
  });

  return NextResponse.json({ transcript });
}
