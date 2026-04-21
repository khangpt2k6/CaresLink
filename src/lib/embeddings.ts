import { prisma } from "./db";
import { upsertProfileEmbedding, upsertJobEmbedding } from "./vector-store";
import { textCompletion } from "./ai-provider";

// ─── Singleton Embedding Pipeline ────────────────────────────
// Uses the same globalThis pattern as db.ts to persist across hot reloads.

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
  if (globalForEmbeddings.embeddingPipelinePromise) {
    return globalForEmbeddings.embeddingPipelinePromise;
  }
  globalForEmbeddings.embeddingPipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
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

// ─── Text Builders (Flutter profile / jobs schema) ───────────

type FlutterProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  role: string | null;
  preferred_roles: string[];
  preferred_job_type: string[];
  preferred_shift_type: string[];
  preferred_business_units: string[];
  care_specialty: string[];
  languages_known: string[];
  user_type: string | null;
};

type FlutterJob = {
  job_id: string;
  job_title: string;
  job_description: string;
  role: string | null;
  job_type: string | null;
  workplace_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  experience_required: string | null;
  benefits_offered: string | null;
  certifications_required: string | null;
  nursing_skills_required: string[];
  care_specialty: string[];
  shift_type: string[];
  business_unit: string[];
};

function fullName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Candidate";
}

export function buildCandidateText(profile: FlutterProfile): string {
  const parts: string[] = [];
  parts.push(`Name: ${fullName(profile)}`);
  if (profile.role) parts.push(`Role: ${profile.role}`);
  if (profile.about) parts.push(`About: ${profile.about}`);

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);

  if (profile.preferred_roles.length) parts.push(`Preferred roles: ${profile.preferred_roles.join(", ")}`);
  if (profile.care_specialty.length) parts.push(`Care specialty: ${profile.care_specialty.join(", ")}`);
  if (profile.preferred_job_type.length) parts.push(`Job types: ${profile.preferred_job_type.join(", ")}`);
  if (profile.preferred_shift_type.length) parts.push(`Shifts: ${profile.preferred_shift_type.join(", ")}`);
  if (profile.preferred_business_units.length)
    parts.push(`Business units: ${profile.preferred_business_units.join(", ")}`);
  if (profile.languages_known.length) parts.push(`Languages: ${profile.languages_known.join(", ")}`);

  return parts.join("\n");
}

export function buildJobText(job: FlutterJob): string {
  const parts: string[] = [];
  parts.push(`Title: ${job.job_title}`);
  if (job.role) parts.push(`Role: ${job.role}`);
  const location = [job.city, job.state, job.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);
  if (job.job_type) parts.push(`Type: ${job.job_type}`);
  if (job.workplace_type) parts.push(`Workplace: ${job.workplace_type}`);
  if (job.experience_required) parts.push(`Experience: ${job.experience_required}`);
  if (job.nursing_skills_required.length)
    parts.push(`Skills required: ${job.nursing_skills_required.join(", ")}`);
  if (job.care_specialty.length) parts.push(`Care specialty: ${job.care_specialty.join(", ")}`);
  if (job.shift_type.length) parts.push(`Shifts: ${job.shift_type.join(", ")}`);
  if (job.business_unit.length) parts.push(`Business units: ${job.business_unit.join(", ")}`);
  if (job.certifications_required) parts.push(`Certifications: ${job.certifications_required}`);
  if (job.benefits_offered) parts.push(`Benefits: ${job.benefits_offered}`);
  if (job.job_description) parts.push(`Description: ${job.job_description}`);
  return parts.join("\n");
}

// ─── Embedding Helpers (fire-and-forget from API routes) ─────

/**
 * Embed a candidate profile and recompute match scores against all open jobs.
 */
export async function embedCandidate(profileId: string): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) return;

    const text = buildCandidateText(profile as FlutterProfile);
    const embedding = await generateEmbedding(text);
    await upsertProfileEmbedding(profileId, text, embedding);

    await autoMatchCandidateToJobs(profileId);
  } catch (e) {
    console.error(`[embeddings] Failed to embed candidate ${profileId}:`, e);
  }
}

/**
 * Embed a job and recompute match scores against all professional profiles.
 */
export async function embedJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.jobs.findUnique({ where: { job_id: jobId } });
    if (!job) return;

    const text = buildJobText(job as FlutterJob);
    const embedding = await generateEmbedding(text);
    await upsertJobEmbedding(jobId, text, embedding);

    await autoMatchJobToCandidates(jobId);
  } catch (e) {
    console.error(`[embeddings] Failed to embed job ${jobId}:`, e);
  }
}

/**
 * Re-embed a candidate when their profile changes. On the Flutter schema,
 * the profile row IS the candidate (its id = auth.users.id).
 */
export async function reembedCandidateByUserId(userId: string): Promise<void> {
  return embedCandidate(userId);
}

// ─── Auto-Matching with Claude (accurate, cost-optimized) ────
// One Claude call per job/candidate change — batches all scorings together.

async function autoMatchCandidateToJobs(profileId: string): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) return;

    const candidateSummary = buildCandidateSummary(profile as FlutterProfile);

    const jobs = await prisma.jobs.findMany({
      select: {
        job_id: true,
        job_title: true,
        role: true,
        city: true,
        state: true,
        country: true,
        job_type: true,
        job_description: true,
      },
      take: 200,
    });
    if (jobs.length === 0) return;

    const text = await textCompletion({
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      messages: [
        {
          role: "user",
          content: `Score this healthcare candidate against each job. Be accurate and realistic.

## Candidate
${candidateSummary}

## Jobs
${jobs
  .map((j, i) => {
    const loc = [j.city, j.state, j.country].filter(Boolean).join(", ") || "N/A";
    return `${i + 1}. [${j.job_id}] ${j.job_title} — ${j.role || "N/A"}, ${loc}, ${j.job_type || "N/A"}${
      j.job_description ? `\n   ${j.job_description.slice(0, 200)}` : ""
    }`;
  })
  .join("\n")}

Return ONLY a JSON array. Score 0-100 where 90+=Excellent fit, 75-89=Good fit, 50-74=Partial fit, 25-49=Weak fit, 0-24=Not a fit.
[{"jobId":"id","score":85,"label":"Good fit","reason":"1 sentence"}]`,
        },
      ],
    });

    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const scores: { jobId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

    const validJobIds = new Set(jobs.map((j) => j.job_id));
    const validScores = scores.filter((s) => validJobIds.has(s.jobId));

    const now = new Date();
    for (const s of validScores) {
      try {
        await prisma.job_match_scores.upsert({
          where: { job_id_profile_id: { job_id: s.jobId, profile_id: profileId } },
          create: {
            job_id: s.jobId,
            profile_id: profileId,
            score: s.score,
            label: s.label,
            reason: s.reason,
            computed_at: now,
          },
          update: { score: s.score, label: s.label, reason: s.reason, computed_at: now },
        });
      } catch {
        /* skip invalid */
      }
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match candidate ${profileId}:`, e);
  }
}

async function autoMatchJobToCandidates(jobId: string): Promise<void> {
  try {
    const job = await prisma.jobs.findUnique({ where: { job_id: jobId } });
    if (!job) return;

    const candidates = await prisma.profile.findMany({
      where: { user_type: "professional" },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    if (candidates.length === 0) return;

    const candidateSummaries = candidates.map((c) => ({
      id: c.id,
      summary: buildCandidateSummary(c as FlutterProfile),
    }));

    const jobLoc = [job.city, job.state, job.country].filter(Boolean).join(", ") || "N/A";

    const text = await textCompletion({
      model: "claude-sonnet-4-20250514",
      maxTokens: 4096,
      messages: [
        {
          role: "user",
          content: `Score each candidate against this job. Be accurate and realistic.

## Job
**${job.job_title}** — ${job.role || "N/A"}, ${jobLoc}, ${job.job_type || "N/A"}
${job.job_description || "No description"}

## Candidates
${candidateSummaries.map((c, i) => `### ${i + 1}. [${c.id}]\n${c.summary}`).join("\n\n")}

Return ONLY a JSON array. Score 0-100 where 90+=Excellent fit, 75-89=Good fit, 50-74=Partial fit, 25-49=Weak fit, 0-24=Not a fit.
[{"candidateId":"id","score":85,"label":"Good fit","reason":"1 sentence"}]`,
        },
      ],
    });

    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const scores: { candidateId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

    const validIds = new Set(candidates.map((c) => c.id));
    const validScores = scores.filter((s) => validIds.has(s.candidateId));

    const now = new Date();
    for (const s of validScores) {
      try {
        await prisma.job_match_scores.upsert({
          where: { job_id_profile_id: { job_id: jobId, profile_id: s.candidateId } },
          create: {
            job_id: jobId,
            profile_id: s.candidateId,
            score: s.score,
            label: s.label,
            reason: s.reason,
            computed_at: now,
          },
          update: { score: s.score, label: s.label, reason: s.reason, computed_at: now },
        });
      } catch {
        /* skip invalid */
      }
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match job ${jobId}:`, e);
  }
}

/**
 * Build a concise candidate summary for Claude scoring (keeps token count low).
 */
function buildCandidateSummary(profile: FlutterProfile): string {
  const parts: string[] = [`**${fullName(profile)}**`];
  if (profile.role) parts.push(`Role: ${profile.role}`);
  if (profile.about) parts.push(`About: ${profile.about.slice(0, 300)}`);
  const loc = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (profile.preferred_roles.length) parts.push(`Preferred roles: ${profile.preferred_roles.join(", ")}`);
  if (profile.care_specialty.length) parts.push(`Specialties: ${profile.care_specialty.join(", ")}`);
  if (profile.preferred_job_type.length) parts.push(`Types: ${profile.preferred_job_type.join(", ")}`);
  if (profile.preferred_shift_type.length) parts.push(`Shifts: ${profile.preferred_shift_type.join(", ")}`);
  return parts.join("\n");
}
