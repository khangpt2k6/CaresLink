import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

const SCREENING_SYSTEM_PROMPT = `You are CaresLink AI, a friendly and professional screening assistant for a healthcare recruiting platform. You are conducting an initial phone screening with a candidate.

Your job is to gather key information through a natural, conversational flow. Be warm, professional, and encouraging. Ask ONE question at a time. Do NOT ask multiple questions at once.

## Screening Flow (follow this order):

1. **Greeting & Name Verification** — Greet the candidate warmly. Confirm their name and the position they applied for.
2. **Introduction** — Ask them to briefly tell you about themselves and their background.
3. **Why This Role** — Ask why they're interested in this particular position/organization.
4. **Relevant Experience** — Ask about their relevant work experience for this role.
5. **Key Strengths** — Ask what they consider their greatest strengths for this role.
6. **Availability** — Ask about their availability to start and preferred work schedule.
7. **Work Authorization** — Ask about their work authorization/immigration status (e.g., US citizen, permanent resident, visa holder, etc.). Be respectful and note this is standard for all candidates.
8. **Salary Expectations** — Ask about their salary expectations or desired compensation range.
9. **Questions** — Ask if they have any questions about the role or organization.
10. **Wrap Up** — Thank them for their time, let them know a recruiter will follow up, and wish them a great day.

## Rules:
- Keep responses concise (2-3 sentences max per message)
- Be conversational, not robotic
- If a candidate gives a vague answer, ask a brief follow-up before moving on
- NEVER make hiring decisions or promises
- After completing ALL questions, end with exactly this marker on its own line: [SCREENING_COMPLETE]
- Include the marker ONLY when you have covered all topics and said goodbye

## Context:
- Candidate Name: {CANDIDATE_NAME}
- Position: {POSITION}
`;

// POST /api/screening/[interviewId]/chat — send a message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  const { interviewId } = await params;
  const body = await request.json();
  const { message, email } = body;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { candidate: true, screening: true },
  });

  if (!interview || interview.candidate.email !== email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create screening if doesn't exist
  let screening = interview.screening;
  if (!screening) {
    screening = await prisma.screening.create({
      data: { interviewId, status: "in_progress", messages: [] },
    });
  }

  const existingMessages = (screening.messages as unknown as ChatMessage[]) || [];

  // If this is the first message (empty conversation), generate the greeting
  const isFirstMessage = existingMessages.length === 0 && !message;

  // Build conversation for Claude
  const systemPrompt = SCREENING_SYSTEM_PROMPT
    .replace("{CANDIDATE_NAME}", interview.candidate.name)
    .replace("{POSITION}", interview.position);

  let claudeMessages: { role: "user" | "assistant"; content: string }[] = [];

  if (isFirstMessage) {
    // Start the conversation — Claude sends the first greeting
    claudeMessages = [{ role: "user", content: "[System: The candidate has just joined the screening chat. Greet them and start the screening.]" }];
  } else {
    // Convert existing chat history to Claude format
    for (const msg of existingMessages) {
      claudeMessages.push({ role: msg.role, content: msg.content });
    }
    // Add the new user message
    if (message) {
      claudeMessages.push({ role: "user", content: message });
    }
  }

  // Call Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const aiResponse = response.content[0].type === "text" ? response.content[0].text : "";
  const isComplete = aiResponse.includes("[SCREENING_COMPLETE]");
  const cleanResponse = aiResponse.replace("[SCREENING_COMPLETE]", "").trim();

  // Build updated messages array
  const updatedMessages: ChatMessage[] = [...existingMessages];

  if (!isFirstMessage && message) {
    updatedMessages.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });
  }

  updatedMessages.push({
    role: "assistant",
    content: cleanResponse,
    timestamp: Date.now(),
  });

  // Update screening in DB
  const updateData: Record<string, unknown> = {
    messages: updatedMessages,
    status: isComplete ? "completed" : "in_progress",
  };

  if (isComplete) {
    updateData.completedAt = new Date();

    // Generate structured answers summary
    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this screening interview conversation and extract structured data.

Conversation:
${updatedMessages.map((m) => `${m.role === "assistant" ? "Screener" : "Candidate"}: ${m.content}`).join("\n")}

Return ONLY a JSON object:
{
  "name": "verified name",
  "introduction": "brief summary of their background",
  "whyApply": "why they want this role",
  "experience": "relevant experience summary",
  "strengths": "key strengths mentioned",
  "availability": "when they can start / schedule preference",
  "workAuthorization": "immigration/work authorization status",
  "salaryExpectation": "desired compensation",
  "questions": "any questions they asked",
  "aiSummary": "2-3 sentence overall screening assessment — factual observations only, NO hiring recommendation",
  "flagged": false
}

Set "flagged" to true ONLY if: candidate was unresponsive, gave contradictory information, or there are objective concerns the recruiter should review. Do NOT flag based on hiring suitability.`,
        },
      ],
    });

    const summaryText = summaryResponse.content[0].type === "text" ? summaryResponse.content[0].text : "{}";
    try {
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (parsed) {
        updateData.answers = parsed;
        updateData.aiSummary = parsed.aiSummary || null;
        updateData.flagged = parsed.flagged || false;
      }
    } catch (e) {
      console.error("Failed to parse screening summary:", e);
    }
  }

  await prisma.screening.update({
    where: { id: screening.id },
    data: updateData,
  });

  return NextResponse.json({
    message: cleanResponse,
    isComplete,
  });
}
