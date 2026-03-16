/**
 * Simulate the AI Interview Agent
 *
 * This script:
 * 1. Creates a test candidate + interview
 * 2. Inserts simulated transcript segments (as if Deepgram transcribed them)
 * 3. Calls Claude to generate AI notes
 * 4. Calls Claude to generate an AI summary with ratings
 * 5. Prints everything out
 *
 * Usage: npx tsx scripts/simulate-interview-ai.ts
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simulated interview transcript (nursing position)
const SIMULATED_TRANSCRIPT = [
  { speaker: "interviewer", content: "Welcome! Thank you for coming in today. Can you start by telling me a bit about your background in nursing?", timestampMs: 0 },
  { speaker: "candidate", content: "Thank you for having me. I graduated from USF with a BSN in 2021. I've been working at Tampa General Hospital for the past three years in the medical-surgical unit. I've handled up to 6 patients at a time and became the charge nurse on night shift last year.", timestampMs: 15000 },
  { speaker: "interviewer", content: "That's great experience. What made you decide to apply for this position?", timestampMs: 45000 },
  { speaker: "candidate", content: "I've always been passionate about patient-centered care, and I've heard great things about your facility's culture. I'm looking for a place where I can grow into a leadership role while still being hands-on with patients. The day shift availability also works better for my schedule.", timestampMs: 60000 },
  { speaker: "interviewer", content: "Can you walk me through how you handle a high-stress situation? Maybe a specific example?", timestampMs: 90000 },
  { speaker: "candidate", content: "Absolutely. Last month, I had a patient whose condition deteriorated rapidly — their blood pressure dropped and they became unresponsive. I immediately called a rapid response, started IV fluids, and communicated clearly with the team. The patient was stabilized and transferred to the ICU within 20 minutes. My charge nurse commended me for staying calm.", timestampMs: 105000 },
  { speaker: "interviewer", content: "Impressive. How do you handle conflicts with other staff members?", timestampMs: 150000 },
  { speaker: "candidate", content: "I believe in direct, respectful communication. There was a situation where a CNA and I disagreed about patient prioritization. I asked if we could step aside and talk it through. We realized we had different information about the patients, and once we shared our perspectives, we came to an agreement quickly. I always try to assume positive intent.", timestampMs: 165000 },
  { speaker: "interviewer", content: "What are your thoughts on electronic health records and documentation?", timestampMs: 210000 },
  { speaker: "candidate", content: "I'm very comfortable with EHR systems. I've used Epic extensively at Tampa General. I think thorough documentation is crucial not just for compliance but for patient safety and continuity of care. I actually helped train new nurses on our Epic workflow last quarter.", timestampMs: 225000 },
  { speaker: "interviewer", content: "Last question — where do you see yourself in five years?", timestampMs: 270000 },
  { speaker: "candidate", content: "In five years, I'd love to be in a nurse manager or clinical coordinator role. I'm also considering getting my MSN to eventually become a nurse practitioner. But right now, my focus is on being the best bedside nurse I can be and contributing to team success.", timestampMs: 285000 },
];

async function main() {
  console.log("\n🎬 Starting AI Interview Agent Simulation...\n");
  console.log("=".repeat(60));

  // Step 1: Create test candidate + interview
  console.log("\n📋 Step 1: Creating test candidate and interview...");

  let candidate = await prisma.candidate.findFirst({
    where: { email: "demo.nurse@test.com" },
  });

  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        name: "Sarah Johnson",
        email: "demo.nurse@test.com",
        phone: "813-555-0199",
        position: "Registered Nurse - Med/Surg",
        status: "interviewed",
      },
    });
  }

  const interview = await prisma.interview.create({
    data: {
      candidateId: candidate.id,
      position: "Registered Nurse - Med/Surg",
      scheduledAt: new Date(),
      duration: 30,
      location: "Video Call",
    },
  });
  console.log(`   ✅ Interview created: ${interview.id}`);
  console.log(`   👤 Candidate: ${candidate.name}`);
  console.log(`   💼 Position: ${interview.position}`);

  // Step 2: Insert transcript segments
  console.log("\n🎤 Step 2: Inserting simulated transcript...\n");

  for (const segment of SIMULATED_TRANSCRIPT) {
    await prisma.interviewTranscript.create({
      data: {
        interviewId: interview.id,
        speaker: segment.speaker,
        content: segment.content,
        timestampMs: segment.timestampMs,
        confidence: 0.95 + Math.random() * 0.05,
      },
    });

    const timeStr = `${Math.floor(segment.timestampMs / 60000)}:${String(Math.floor((segment.timestampMs % 60000) / 1000)).padStart(2, "0")}`;
    const label = segment.speaker === "interviewer" ? "🔵 Interviewer" : "🟣 Candidate  ";
    console.log(`   [${timeStr}] ${label}: ${segment.content.slice(0, 80)}...`);
  }

  console.log(`\n   ✅ ${SIMULATED_TRANSCRIPT.length} transcript segments saved`);

  // Step 3: Generate AI Notes
  console.log("\n🧠 Step 3: Generating AI notes with Claude...\n");

  const fullTranscript = SIMULATED_TRANSCRIPT
    .map((t) => `[${t.speaker}]: ${t.content}`)
    .join("\n");

  const notesMessage = await anthropic.messages.create({
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

  const notesRaw = notesMessage.content[0].type === "text" ? notesMessage.content[0].text : "[]";
  const notesJsonMatch = notesRaw.match(/\[[\s\S]*\]/);
  const parsedNotes: { content: string; category: string }[] = notesJsonMatch ? JSON.parse(notesJsonMatch[0]) : [];

  // Save notes to DB
  await prisma.interviewNote.createMany({
    data: parsedNotes.map((n) => ({
      interviewId: interview.id,
      content: n.content,
      category: n.category,
      source: "ai",
    })),
  });

  const categoryIcons: Record<string, string> = {
    strength: "💪",
    concern: "⚠️ ",
    follow_up: "📌",
    general: "📝",
  };

  for (const note of parsedNotes) {
    console.log(`   ${categoryIcons[note.category] || "📝"} [${note.category}] ${note.content}`);
  }
  console.log(`\n   ✅ ${parsedNotes.length} AI notes generated`);

  // Step 4: Generate AI Summary
  console.log("\n⭐ Step 4: Generating AI summary with Claude...\n");

  const summaryMessage = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an AI assistant summarizing a job interview for a recruiter.

Candidate: ${candidate.name}
Position: ${interview.position}

Full transcript:
${fullTranscript}

Return ONLY a JSON object with this exact structure (no extra text):
{
  "summary": "2-3 sentence overall narrative",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1"],
  "recommendation": "strong_hire" | "hire" | "no_hire" | "strong_no_hire",
  "technicalRating": 1-5,
  "communicationRating": 1-5,
  "cultureFitRating": 1-5,
  "overallRating": 1-5,
  "nextSteps": ["next step 1", "next step 2"]
}`,
      },
    ],
  });

  const summaryRaw = summaryMessage.content[0].type === "text" ? summaryMessage.content[0].text : "{}";
  const summaryJsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
  const parsedSummary = summaryJsonMatch ? JSON.parse(summaryJsonMatch[0]) : null;

  if (parsedSummary) {
    // Save to DB
    await prisma.interviewSummary.create({
      data: {
        interviewId: interview.id,
        summary: parsedSummary.summary,
        strengths: parsedSummary.strengths,
        concerns: parsedSummary.concerns,
        recommendation: parsedSummary.recommendation,
        technicalRating: parsedSummary.technicalRating,
        communicationRating: parsedSummary.communicationRating,
        cultureFitRating: parsedSummary.cultureFitRating,
        overallRating: parsedSummary.overallRating,
        nextSteps: parsedSummary.nextSteps,
      },
    });

    // Mark interview completed
    await prisma.interview.update({
      where: { id: interview.id },
      data: { completed: true },
    });

    const recLabel: Record<string, string> = {
      strong_hire: "🟢 STRONG HIRE",
      hire: "🔵 HIRE",
      no_hire: "🔴 NO HIRE",
      strong_no_hire: "🔴 STRONG NO HIRE",
    };

    console.log("   ┌─────────────────────────────────────────────────┐");
    console.log(`   │  Recommendation: ${recLabel[parsedSummary.recommendation] || parsedSummary.recommendation}`);
    console.log("   └─────────────────────────────────────────────────┘");
    console.log();
    console.log(`   📄 Summary: ${parsedSummary.summary}`);
    console.log();
    console.log("   📊 Ratings:");
    console.log(`      Technical:     ${"★".repeat(parsedSummary.technicalRating)}${"☆".repeat(5 - parsedSummary.technicalRating)} (${parsedSummary.technicalRating}/5)`);
    console.log(`      Communication: ${"★".repeat(parsedSummary.communicationRating)}${"☆".repeat(5 - parsedSummary.communicationRating)} (${parsedSummary.communicationRating}/5)`);
    console.log(`      Culture Fit:   ${"★".repeat(parsedSummary.cultureFitRating)}${"☆".repeat(5 - parsedSummary.cultureFitRating)} (${parsedSummary.cultureFitRating}/5)`);
    console.log(`      Overall:       ${"★".repeat(parsedSummary.overallRating)}${"☆".repeat(5 - parsedSummary.overallRating)} (${parsedSummary.overallRating}/5)`);
    console.log();
    console.log("   💪 Strengths:");
    for (const s of parsedSummary.strengths) console.log(`      • ${s}`);
    console.log();
    console.log("   ⚠️  Concerns:");
    for (const c of parsedSummary.concerns) console.log(`      • ${c}`);
    console.log();
    console.log("   📌 Next Steps:");
    for (const n of parsedSummary.nextSteps) console.log(`      • ${n}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Simulation complete! Check the interview room in the UI:");
  console.log(`   → /interviews/${interview.id}/room`);
  console.log("=".repeat(60) + "\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Simulation failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
