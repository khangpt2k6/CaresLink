import { prisma } from "./db";
import { upsertCandidateEmbedding, upsertJobEmbedding, searchSimilarCandidates } from "./vector-store";

// ─── Singleton Embedding Pipeline ────────────────────────────
// Uses the same globalThis pattern as db.ts to persist across hot reloads

type EmbeddingPipeline = {
  (text: string, options: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
};

const globalForEmbeddings = globalThis as unknown as {
  embeddingPipeline: EmbeddingPipeline | null;
  embeddingPipelinePromise: Promise<EmbeddingPipeline> | null;
};

async function getEmbeddingPipeline(): Promise<EmbeddingPipeline> {
  if (globalForEmbeddings.embeddingPipeline) {
    return globalForEmbeddings.embeddingPipeline;
  }

  // Prevent multiple concurrent initializations
  if (globalForEmbeddings.embeddingPipelinePromise) {
    return globalForEmbeddings.embeddingPipelinePromise;
  }

  globalForEmbeddings.embeddingPipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    // bge-small-en-v1.5: MTEB ~62 (vs all-MiniLM-L6-v2 ~56), same 384 dims, much better quality
    const pipe = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
      dtype: "fp32",
    });
    globalForEmbeddings.embeddingPipeline = pipe as unknown as EmbeddingPipeline;
    return globalForEmbeddings.embeddingPipeline;
  })();

  return globalForEmbeddings.embeddingPipelinePromise;
}

/**
 * Generate a 384-dimensional embedding vector from text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ─── Text Builders ───────────────────────────────────────────

interface CandidateData {
  position: string;
  name: string;
}

interface ProfileData {
  headline?: string | null;
  summary?: string | null;
  city?: string | null;
  state?: string | null;
  experiences?: { title: string; company: string; description?: string | null }[];
  educations?: { school: string; degree?: string | null; field?: string | null }[];
  skills?: { name: string }[];
  certifications?: { name: string; issuer?: string | null }[];
  licenses?: { type: string; licenseNumber: string; licenseState: string; status?: string | null }[];
  preferences?: {
    roles?: string[];
    businessUnits?: string[];
    jobTypes?: string[];
    shifts?: string[];
  } | null;
}

/**
 * Build a rich text representation of a candidate for embedding.
 */
export function buildCandidateText(candidate: CandidateData, profile?: ProfileData | null): string {
  const parts: string[] = [];

  parts.push(`Position: ${candidate.position}`);

  if (profile) {
    if (profile.headline) parts.push(`Headline: ${profile.headline}`);
    if (profile.summary) parts.push(`Summary: ${profile.summary}`);

    const location = [profile.city, profile.state].filter(Boolean).join(", ");
    if (location) parts.push(`Location: ${location}`);

    if (profile.skills && profile.skills.length > 0) {
      parts.push(`Skills: ${profile.skills.map((s) => s.name).join(", ")}`);
    }

    if (profile.certifications && profile.certifications.length > 0) {
      parts.push(`Certifications: ${profile.certifications.map((c) => c.name).join(", ")}`);
    }

    if (profile.licenses && profile.licenses.length > 0) {
      parts.push(
        `Licenses: ${profile.licenses.map((l) => `${l.type} (${l.licenseState}, ${l.status || "unknown"})`).join(", ")}`
      );
    }

    if (profile.experiences && profile.experiences.length > 0) {
      parts.push(
        `Experience: ${profile.experiences
          .map((e) => `${e.title} at ${e.company}${e.description ? ` - ${e.description}` : ""}`)
          .join("; ")}`
      );
    }

    if (profile.educations && profile.educations.length > 0) {
      parts.push(
        `Education: ${profile.educations
          .map((e) => [e.degree, e.field, `at ${e.school}`].filter(Boolean).join(" "))
          .join("; ")}`
      );
    }

    if (profile.preferences) {
      const prefs: string[] = [];
      if (profile.preferences.roles?.length) prefs.push(`Roles: ${profile.preferences.roles.join(", ")}`);
      if (profile.preferences.jobTypes?.length) prefs.push(`Types: ${profile.preferences.jobTypes.join(", ")}`);
      if (profile.preferences.shifts?.length) prefs.push(`Shifts: ${profile.preferences.shifts.join(", ")}`);
      if (profile.preferences.businessUnits?.length)
        prefs.push(`Units: ${profile.preferences.businessUnits.join(", ")}`);
      if (prefs.length > 0) parts.push(`Preferences: ${prefs.join("; ")}`);
    }
  }

  return parts.join("\n");
}

interface JobData {
  title: string;
  department?: string | null;
  location: string;
  type: string;
  description?: string | null;
}

/**
 * Build a text representation of a job for embedding.
 */
export function buildJobText(job: JobData): string {
  const parts: string[] = [];
  parts.push(`Title: ${job.title}`);
  if (job.department) parts.push(`Department: ${job.department}`);
  parts.push(`Location: ${job.location}`);
  parts.push(`Type: ${job.type}`);
  if (job.description) parts.push(`Description: ${job.description}`);
  return parts.join("\n");
}

// ─── Embedding Helpers (fire-and-forget from API routes) ─────

/**
 * Fetch a candidate + profile, generate/store its embedding,
 * then auto-recompute match scores against all open jobs.
 */
export async function embedCandidate(candidateId: string): Promise<void> {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) return;

    // Try to find a linked user profile via email
    const user = await prisma.user.findFirst({
      where: { email: { equals: candidate.email, mode: "insensitive" } },
      include: {
        profile: {
          include: {
            experiences: true,
            educations: true,
            skills: true,
            certifications: true,
            licenses: true,
            preferences: true,
          },
        },
      },
    });

    const profile = user?.profile;
    const text = buildCandidateText(candidate, profile ? {
      ...profile,
      preferences: profile.preferences ?? null,
    } : null);

    const embedding = await generateEmbedding(text);
    await upsertCandidateEmbedding(candidateId, text, embedding);

    // Auto-recompute matches for all open jobs
    await autoMatchCandidateToJobs(candidateId, embedding);
  } catch (e) {
    console.error(`[embeddings] Failed to embed candidate ${candidateId}:`, e);
  }
}

/**
 * Fetch a job, generate/store its embedding,
 * then auto-recompute match scores against all candidates.
 */
export async function embedJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const text = buildJobText(job);
    const embedding = await generateEmbedding(text);
    await upsertJobEmbedding(jobId, text, embedding);

    // Auto-recompute matches for this job
    await autoMatchJobToCandidates(jobId);
  } catch (e) {
    console.error(`[embeddings] Failed to embed job ${jobId}:`, e);
  }
}

/**
 * Re-embed a candidate when their profile changes.
 * Finds the Candidate record by matching the User's email.
 */
export async function reembedCandidateByUserId(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;

    const candidate = await prisma.candidate.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
    });
    if (!candidate) return;

    await embedCandidate(candidate.id);
  } catch (e) {
    console.error(`[embeddings] Failed to re-embed candidate for user ${userId}:`, e);
  }
}

// ─── Auto-Matching with Claude (accurate, cost-optimized) ────
// Uses Claude to score candidates, but batches them in ONE API call per job.
// Cost: ~$0.01-0.03 per job (scores ALL candidates in a single prompt).

import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * When a candidate changes, re-score them against all open jobs using Claude.
 * Batches into one Claude call per job for cost efficiency.
 */
async function autoMatchCandidateToJobs(candidateId: string, _embedding: number[]): Promise<void> {
  try {
    if (!anthropic) return;

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return;

    const user = await prisma.user.findFirst({
      where: { email: { equals: candidate.email, mode: "insensitive" } },
      include: {
        profile: { include: { experiences: true, skills: true, certifications: true, educations: true } },
      },
    });

    const candidateSummary = buildCandidateSummary(candidate, user?.profile);

    const openJobs = await prisma.job.findMany({
      where: { status: "open" },
      select: { id: true, title: true, department: true, location: true, type: true, description: true },
    });

    if (openJobs.length === 0) return;

    // ONE Claude call to score this candidate against ALL jobs
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Score this healthcare candidate against each job. Be accurate and realistic.

## Candidate
${candidateSummary}

## Jobs
${openJobs.map((j, i) => `${i + 1}. [${j.id}] ${j.title} — ${j.department || "N/A"}, ${j.location}, ${j.type}${j.description ? `\n   ${j.description.slice(0, 200)}` : ""}`).join("\n")}

Return ONLY a JSON array. Score 0-100 where 90+=Excellent fit, 75-89=Good fit, 50-74=Partial fit, 25-49=Weak fit, 0-24=Not a fit.
[{"jobId":"id","score":85,"label":"Good fit","reason":"1 sentence"}]`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const scores: { jobId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

    // Validate job IDs exist
    const validJobIds = new Set(openJobs.map((j) => j.id));
    const validScores = scores.filter((s) => validJobIds.has(s.jobId));

    const now = new Date();
    for (const s of validScores) {
      try {
        await prisma.jobMatch.upsert({
          where: { jobId_candidateId: { jobId: s.jobId, candidateId } },
          create: { jobId: s.jobId, candidateId, score: s.score, label: s.label, reason: s.reason, computedAt: now },
          update: { score: s.score, label: s.label, reason: s.reason, computedAt: now },
        });
      } catch { /* skip invalid */ }
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match candidate ${candidateId}:`, e);
  }
}

/**
 * When a job changes, score ALL candidates against it using Claude.
 * ONE Claude call with all candidates batched together.
 */
async function autoMatchJobToCandidates(jobId: string): Promise<void> {
  try {
    if (!anthropic) return;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const candidates = await prisma.candidate.findMany({
      orderBy: { appliedAt: "desc" },
    });

    if (candidates.length === 0) return;

    // Build candidate summaries
    const candidateSummaries = await Promise.all(
      candidates.map(async (c) => {
        const user = await prisma.user.findFirst({
          where: { email: { equals: c.email, mode: "insensitive" } },
          include: {
            profile: { include: { experiences: true, skills: true, certifications: true, educations: true } },
          },
        });
        return { id: c.id, summary: buildCandidateSummary(c, user?.profile) };
      })
    );

    // ONE Claude call to score all candidates
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Score each candidate against this job. Be accurate and realistic.

## Job
**${job.title}** — ${job.department || "N/A"}, ${job.location}, ${job.type}
${job.description || "No description"}

## Candidates
${candidateSummaries.map((c, i) => `### ${i + 1}. [${c.id}]\n${c.summary}`).join("\n\n")}

Return ONLY a JSON array. Score 0-100 where 90+=Excellent fit, 75-89=Good fit, 50-74=Partial fit, 25-49=Weak fit, 0-24=Not a fit. Deduplicate candidates with the same name — keep the highest-scoring entry.
[{"candidateId":"id","score":85,"label":"Good fit","reason":"1 sentence"}]`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const scores: { candidateId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

    // Validate candidate IDs exist (Claude sometimes hallucinates IDs)
    const validIds = new Set(candidates.map((c) => c.id));
    const validScores = scores.filter((s) => validIds.has(s.candidateId));

    const now = new Date();
    for (const s of validScores) {
      try {
        await prisma.jobMatch.upsert({
          where: { jobId_candidateId: { jobId, candidateId: s.candidateId } },
          create: { jobId, candidateId: s.candidateId, score: s.score, label: s.label, reason: s.reason, computedAt: now },
          update: { score: s.score, label: s.label, reason: s.reason, computedAt: now },
        });
      } catch { /* skip invalid */ }
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match job ${jobId}:`, e);
  }
}

/**
 * Build a concise candidate summary for Claude scoring (keeps token count low).
 */
function buildCandidateSummary(
  candidate: { name: string; position: string; status: string },
  profile?: {
    headline?: string | null;
    summary?: string | null;
    experiences?: { title: string; company: string }[];
    skills?: { name: string }[];
    certifications?: { name: string }[];
    educations?: { school: string; degree?: string | null; field?: string | null }[];
  } | null
): string {
  const parts = [`**${candidate.name}** — Applied: ${candidate.position}`];

  if (profile) {
    if (profile.headline) parts.push(`Headline: ${profile.headline}`);
    if (profile.skills?.length) parts.push(`Skills: ${profile.skills.map(s => s.name).join(", ")}`);
    if (profile.certifications?.length) parts.push(`Certs: ${profile.certifications.map(c => c.name).join(", ")}`);
    if (profile.experiences?.length) {
      parts.push(`Experience: ${profile.experiences.slice(0, 3).map(e => `${e.title} at ${e.company}`).join("; ")}`);
    }
    if (profile.educations?.length) {
      parts.push(`Education: ${profile.educations.slice(0, 2).map(e => `${e.degree || ""} ${e.field || ""} at ${e.school}`.trim()).join("; ")}`);
    }
  }

  return parts.join("\n");
}
