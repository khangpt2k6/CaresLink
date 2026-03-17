import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  if (!anthropic) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Fetch the job posting
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Fetch all candidates with their rich profile data
    const candidates = await prisma.candidate.findMany({
      orderBy: { appliedAt: "desc" },
    });

    // For each candidate, try to find their User + CandidateProfile
    const candidateProfiles = await Promise.all(
      candidates.map(async (c) => {
        const user = await prisma.user.findFirst({
          where: { email: { equals: c.email, mode: "insensitive" } },
          include: {
            profile: {
              include: {
                experiences: { orderBy: { startDate: "desc" } },
                educations: { orderBy: { startDate: "desc" } },
                skills: true,
                certifications: true,
              },
            },
          },
        });

        // Also fetch screening data if available
        const interview = await prisma.interview.findFirst({
          where: { candidateId: c.id },
          include: {
            screening: true,
            summaries: { take: 1, orderBy: { createdAt: "desc" } },
          },
          orderBy: { scheduledAt: "desc" },
        });

        const profile = user?.profile;
        const screening = interview?.screening;
        const interviewSummary = interview?.summaries?.[0];

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          position: c.position,
          status: c.status,
          profile: profile
            ? {
                headline: profile.headline,
                summary: profile.summary,
                city: profile.city,
                state: profile.state,
                experiences: profile.experiences.map((e) => ({
                  title: e.title,
                  company: e.company,
                  description: e.description,
                  startDate: e.startDate,
                  endDate: e.endDate,
                  current: e.current,
                })),
                educations: profile.educations.map((e) => ({
                  school: e.school,
                  degree: e.degree,
                  field: e.field,
                })),
                skills: profile.skills.map((s) => s.name),
                certifications: profile.certifications.map((c) => ({
                  name: c.name,
                  issuer: c.issuer,
                })),
              }
            : null,
          screening: screening?.answers
            ? {
                summary: screening.aiSummary,
                answers: screening.answers,
                flagged: screening.flagged,
              }
            : null,
          interviewSummary: interviewSummary
            ? {
                strengths: interviewSummary.strengths,
                concerns: interviewSummary.concerns,
                ratings: {
                  technical: interviewSummary.ratingTechnical,
                  communication: interviewSummary.ratingCommunication,
                  cultureFit: interviewSummary.ratingCultureFit,
                  overall: interviewSummary.ratingOverall,
                },
                recommendation: interviewSummary.recommendation,
              }
            : null,
        };
      })
    );

    // Build the AI prompt
    const systemPrompt = `You are an expert healthcare recruiter AI. Your job is to analyze candidates against a specific job posting and score how well each candidate matches.

For each candidate, evaluate:
1. **Position match** — Does their applied position align with the job?
2. **Experience relevance** — Do their work experiences match what the job needs?
3. **Skills & certifications** — Do they have the required skills/certs?
4. **Education** — Does their education background fit?
5. **Screening performance** — If screening data exists, how well did they perform?
6. **Interview performance** — If interview data exists, what were the results?
7. **Overall potential** — Even if not a perfect match, could they grow into the role?

Score each candidate from 0 to 100 where:
- 90-100: Excellent match — strongly recommended
- 75-89: Good match — solid candidate
- 50-74: Partial match — some relevant qualifications
- 25-49: Weak match — limited alignment
- 0-24: Poor match — not suitable

IMPORTANT: Be realistic. A candidate who applied for "Registered Nurse" matches well with a "Registered Nurse" posting but poorly with "Medical Billing Specialist". Consider ALL available data — profile, experience, skills, screening answers, interview results.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation. Just the raw JSON array:
[
  {
    "candidateId": "the_id",
    "score": 85,
    "label": "Good fit",
    "reason": "1-2 sentence explanation of why this score"
  }
]

Labels must be one of: "Excellent fit", "Good fit", "Partial fit", "Weak fit", "Not a fit"`;

    const userMessage = `## Job Posting
**Title:** ${job.title}
**Department:** ${job.department || "N/A"}
**Location:** ${job.location}
**Type:** ${job.type}
**Description:** ${job.description || "No description provided"}

## Candidates to Evaluate (${candidateProfiles.length} total)

${candidateProfiles
  .map(
    (c, i) => `### Candidate ${i + 1}: ${c.name}
- **ID:** ${c.id}
- **Applied Position:** ${c.position}
- **Status:** ${c.status}
- **Email:** ${c.email}
${c.phone ? `- **Phone:** ${c.phone}` : ""}
${
  c.profile
    ? `- **Headline:** ${c.profile.headline || "N/A"}
- **Summary:** ${c.profile.summary || "N/A"}
- **Location:** ${[c.profile.city, c.profile.state].filter(Boolean).join(", ") || "N/A"}
- **Skills:** ${c.profile.skills.length > 0 ? c.profile.skills.join(", ") : "None listed"}
- **Certifications:** ${c.profile.certifications.length > 0 ? c.profile.certifications.map((cert) => cert.name).join(", ") : "None listed"}
- **Experience:** ${
        c.profile.experiences.length > 0
          ? c.profile.experiences
              .map(
                (e) =>
                  `${e.title} at ${e.company}${e.description ? ` — ${e.description}` : ""}`
              )
              .join("; ")
          : "None listed"
      }
- **Education:** ${
        c.profile.educations.length > 0
          ? c.profile.educations
              .map(
                (e) =>
                  `${e.degree || ""} ${e.field || ""} at ${e.school}`.trim()
              )
              .join("; ")
          : "None listed"
      }`
    : "- **Profile:** No detailed profile available"
}
${
  c.screening
    ? `- **Screening Summary:** ${c.screening.summary || "Completed"}${c.screening.flagged ? " ⚠️ FLAGGED" : ""}`
    : ""
}
${
  c.interviewSummary
    ? `- **Interview Results:** Overall rating: ${c.interviewSummary.ratings.overall}/5, Recommendation: ${c.interviewSummary.recommendation}
- **Strengths:** ${(c.interviewSummary.strengths as string[])?.join(", ") || "N/A"}
- **Concerns:** ${(c.interviewSummary.concerns as string[])?.join(", ") || "N/A"}`
    : ""
}
`
  )
  .join("\n")}

Evaluate ALL ${candidateProfiles.length} candidates against the "${job.title}" position. Return the JSON array sorted by score descending (best matches first).`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response
    let matches: { candidateId: string; score: number; label: string; reason: string }[];
    try {
      // Strip any markdown code fences if present
      const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      matches = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", text);
      return NextResponse.json(
        { error: "AI returned invalid response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      jobTitle: job.title,
      matches,
    });
  } catch (e) {
    console.error("Job matching error:", e);
    return NextResponse.json(
      { error: "Failed to run job matching" },
      { status: 500 }
    );
  }
}
