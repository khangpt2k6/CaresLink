/**
 * Seed realistic AI interview data for multiple candidates
 *
 * Picks candidates from the DB, creates interviews with transcripts,
 * generates AI notes + summaries via Claude, and saves everything.
 *
 * Usage: npx tsx scripts/seed-interview-ai.ts
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Interview scenarios per position type
const SCENARIOS: Record<string, { questions: string[]; context: string }> = {
  "Registered Nurse": {
    context: "a med-surg unit at a busy hospital",
    questions: [
      "Tell me about your nursing background and what drew you to this field.",
      "How do you handle high patient loads during a busy shift?",
      "Describe a time you had to advocate for a patient's care.",
      "How do you stay current with nursing best practices?",
      "What's your experience with electronic health records?",
      "Where do you see your nursing career in the next few years?",
    ],
  },
  "Medical Assistant": {
    context: "a family practice clinic",
    questions: [
      "What experience do you have as a medical assistant?",
      "How do you handle difficult or anxious patients?",
      "Walk me through how you would prepare a patient for an exam.",
      "What EHR systems have you used?",
      "How do you prioritize tasks when the clinic is running behind schedule?",
      "Why are you interested in working at our clinic?",
    ],
  },
  "Patient Care Coordinator": {
    context: "a multi-specialty healthcare group",
    questions: [
      "What experience do you have in care coordination?",
      "How do you manage communication between patients and multiple providers?",
      "Describe a situation where you improved a patient's care experience.",
      "How do you handle insurance authorization challenges?",
      "What tools do you use to stay organized with multiple patients?",
      "How do you ensure follow-up care doesn't fall through the cracks?",
    ],
  },
  default: {
    context: "a growing healthcare facility",
    questions: [
      "Tell me about your background and experience in healthcare.",
      "What attracted you to this position?",
      "Describe a challenging situation you faced at work and how you resolved it.",
      "How do you handle working in a fast-paced environment?",
      "What are your greatest strengths in a clinical setting?",
      "Where do you see yourself in the next 3-5 years?",
    ],
  },
};

async function generateTranscript(
  candidateName: string,
  position: string,
  questions: string[],
  context: string
): Promise<{ speaker: string; content: string; timestampMs: number }[]> {
  const prompt = `Generate a realistic job interview transcript for a healthcare position.

Candidate: ${candidateName}
Position: ${position}
Setting: ${context}

The interviewer asks these questions (in order):
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Generate the FULL transcript as a JSON array. Each entry has:
- "speaker": "interviewer" or "candidate"
- "content": what they said (2-4 sentences each, natural and realistic)

The candidate should have a mix of strong answers and some areas where they're less confident. Make it feel like a real conversation — include small talk at the start and a closing.

Return ONLY the JSON array, no extra text.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const parsed: { speaker: string; content: string }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  // Add timestamps (each segment ~15-30 seconds apart)
  let ts = 0;
  return parsed.map((entry) => {
    const segment = { ...entry, timestampMs: ts };
    ts += 15000 + Math.floor(Math.random() * 15000);
    return segment;
  });
}

async function generateNotes(transcript: string): Promise<{ content: string; category: string }[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an AI assistant helping a recruiter take notes during a job interview.

Extract key notes from this transcript. For each note, classify as:
- "strength" — positive signal
- "concern" — red flag or area of concern
- "follow_up" — something to follow up on
- "general" — general observation

Return ONLY a JSON array:
[{ "content": "...", "category": "strength|concern|follow_up|general" }]

Transcript:
${transcript}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}

async function generateSummary(candidateName: string, position: string, transcript: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Summarize this job interview for a recruiter.

Candidate: ${candidateName}
Position: ${position}

Transcript:
${transcript}

Return ONLY a JSON object:
{
  "summary": "2-3 sentence narrative",
  "strengths": ["..."],
  "concerns": ["..."],
  "recommendation": "strong_hire" | "hire" | "no_hire" | "strong_no_hire",
  "technicalRating": 1-5,
  "communicationRating": 1-5,
  "cultureFitRating": 1-5,
  "overallRating": 1-5,
  "nextSteps": ["..."]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

async function main() {
  console.log("\n🎬 Seeding AI Interview Data...\n");
  console.log("=".repeat(60));

  // Pick candidates that don't have transcripts yet
  const candidates = await prisma.candidate.findMany({
    where: {
      interviews: { none: { transcripts: { some: {} } } },
    },
    take: 5,
  });

  if (candidates.length === 0) {
    console.log("⚠️  All candidates already have interview transcripts. Skipping.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📋 Found ${candidates.length} candidates to interview:\n`);
  for (const c of candidates) {
    console.log(`   • ${c.name} — ${c.position}`);
  }

  // Schedule interviews at different past times
  const pastDates = [
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const scenario = SCENARIOS[candidate.position] || SCENARIOS.default;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`\n👤 ${i + 1}/${candidates.length}: ${candidate.name} — ${candidate.position}`);

    // Create interview
    const interview = await prisma.interview.create({
      data: {
        candidateId: candidate.id,
        position: candidate.position,
        scheduledAt: pastDates[i] || pastDates[0],
        duration: 30,
        location: "Video Call",
        completed: true,
      },
    });
    console.log(`   📅 Interview: ${interview.id}`);

    // Generate transcript via Claude
    console.log("   🎤 Generating transcript...");
    const transcript = await generateTranscript(
      candidate.name,
      candidate.position,
      scenario.questions,
      scenario.context
    );

    // Save transcript
    for (const seg of transcript) {
      await prisma.interviewTranscript.create({
        data: {
          interviewId: interview.id,
          speaker: seg.speaker,
          content: seg.content,
          timestampMs: seg.timestampMs,
          confidence: 0.93 + Math.random() * 0.07,
        },
      });
    }
    console.log(`   ✅ ${transcript.length} segments saved`);

    const fullTranscript = transcript
      .map((t) => `[${t.speaker}]: ${t.content}`)
      .join("\n");

    // Generate AI notes
    console.log("   🧠 Generating AI notes...");
    const notes = await generateNotes(fullTranscript);

    await prisma.interviewNote.createMany({
      data: notes.map((n) => ({
        interviewId: interview.id,
        content: n.content,
        category: n.category,
        source: "ai",
      })),
    });
    console.log(`   ✅ ${notes.length} notes generated`);

    // Generate AI summary
    console.log("   ⭐ Generating summary...");
    const summary = await generateSummary(candidate.name, candidate.position, fullTranscript);

    if (summary) {
      await prisma.interviewSummary.create({
        data: {
          interviewId: interview.id,
          summary: summary.summary,
          strengths: summary.strengths,
          concerns: summary.concerns,
          recommendation: summary.recommendation,
          technicalRating: summary.technicalRating,
          communicationRating: summary.communicationRating,
          cultureFitRating: summary.cultureFitRating,
          overallRating: summary.overallRating,
          nextSteps: summary.nextSteps,
        },
      });

      const recIcons: Record<string, string> = {
        strong_hire: "🟢 STRONG HIRE",
        hire: "🔵 HIRE",
        no_hire: "🔴 NO HIRE",
        strong_no_hire: "🔴 STRONG NO HIRE",
      };
      console.log(`   📊 Result: ${recIcons[summary.recommendation] || summary.recommendation} (${summary.overallRating}/5)`);
    }

    // Update candidate status
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "interviewed" },
    });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Done! All interviews seeded with transcripts, notes & summaries.");
  console.log("   Open any interview → AI Room to view the data.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
