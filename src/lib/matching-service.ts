import { prisma } from "@/lib/db";
import { textCompletion } from "@/lib/ai-provider";

// Matching service wired to the Flutter production schema.
//   - `profile` with `user_type = 'professional'` represents a candidate
//   - `jobs.job_id` is the job PK (not `id`)
//   - `job_match_scores` unique on (job_id, profile_id)
// Interview / screening tables from the POC don't exist on Flutter —
// scoring works purely off profile + job text.

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  preferred_roles: string[];
  preferred_job_type: string[];
  preferred_shift_type: string[];
  preferred_business_units: string[];
  care_specialty: string[];
  languages_known: string[];
};

type JobRow = {
  job_id: string;
  job_title: string;
  job_description: string;
  role: string | null;
  job_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  nursing_skills_required: string[];
  care_specialty: string[];
};

function fullName(p: { first_name: string | null; last_name: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Candidate";
}

function summarizeCandidate(p: ProfileRow): string {
  const parts: string[] = [`**${fullName(p)}**`];
  if (p.role) parts.push(`Role: ${p.role}`);
  if (p.about) parts.push(`About: ${p.about.slice(0, 300)}`);
  const loc = [p.city, p.state, p.country].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (p.preferred_roles.length) parts.push(`Preferred roles: ${p.preferred_roles.join(", ")}`);
  if (p.care_specialty.length) parts.push(`Specialties: ${p.care_specialty.join(", ")}`);
  if (p.preferred_job_type.length) parts.push(`Types: ${p.preferred_job_type.join(", ")}`);
  if (p.preferred_shift_type.length) parts.push(`Shifts: ${p.preferred_shift_type.join(", ")}`);
  if (p.languages_known.length) parts.push(`Languages: ${p.languages_known.join(", ")}`);
  return parts.join("\n");
}

function describeJob(job: JobRow): string {
  const loc = [job.city, job.state, job.country].filter(Boolean).join(", ") || "N/A";
  const lines = [
    `**Title:** ${job.job_title}`,
    `**Role:** ${job.role || "N/A"}`,
    `**Location:** ${loc}`,
    `**Type:** ${job.job_type || "N/A"}`,
  ];
  if (job.nursing_skills_required.length)
    lines.push(`**Skills required:** ${job.nursing_skills_required.join(", ")}`);
  if (job.care_specialty.length)
    lines.push(`**Care specialty:** ${job.care_specialty.join(", ")}`);
  lines.push(`**Description:** ${job.job_description || "No description provided"}`);
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are an expert healthcare recruiter AI. Score each candidate against the job posting.

Evaluate: role alignment, care specialty, preferred job type/shift, experience signals in the profile, location.

Score 0-100:
- 90-100 excellent, 75-89 good, 50-74 partial, 25-49 weak, 0-24 poor.
Labels: "Excellent fit", "Good fit", "Partial fit", "Weak fit", "Not a fit"

Respond with ONLY a valid JSON array, no markdown:
[{"candidateId":"id","score":85,"label":"Good fit","reason":"1-2 sentences"}]`;

async function scoreAndStore(
  job: JobRow,
  candidates: ProfileRow[]
): Promise<Array<{ candidateId: string; score: number; label: string; reason: string }>> {
  if (candidates.length === 0) return [];

  const userMessage = `## Job
${describeJob(job)}

## Candidates to Evaluate (${candidates.length})
${candidates
  .map(
    (c, i) => `### Candidate ${i + 1}
- **ID:** ${c.id}
${summarizeCandidate(c)
  .split("\n")
  .map((l) => `  ${l}`)
  .join("\n")}`
  )
  .join("\n\n")}

Return the JSON array sorted by score descending.`;

  const text = await textCompletion({
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const matches: { candidateId: string; score: number; label: string; reason: string }[] = JSON.parse(cleaned);

  const validIds = new Set(candidates.map((c) => c.id));
  const valid = matches.filter((m) => validIds.has(m.candidateId));

  const now = new Date();
  await Promise.all(
    valid.map((m) =>
      prisma.job_match_scores.upsert({
        where: { job_id_profile_id: { job_id: job.job_id, profile_id: m.candidateId } },
        create: {
          job_id: job.job_id,
          profile_id: m.candidateId,
          score: m.score,
          label: m.label,
          reason: m.reason,
          computed_at: now,
        },
        update: { score: m.score, label: m.label, reason: m.reason, computed_at: now },
      })
    )
  );

  return valid;
}

/**
 * Compute match scores for a job against all professional candidates,
 * upsert results, and return stored matches sorted by score descending.
 */
export async function computeAndStoreMatches(jobId: string) {
  const job = (await prisma.jobs.findUnique({ where: { job_id: jobId } })) as JobRow | null;
  if (!job) throw new Error("Job not found");

  const candidates = (await prisma.profile.findMany({
    where: { user_type: "professional" },
    orderBy: { created_at: "desc" },
    take: 200,
  })) as unknown as ProfileRow[];

  await scoreAndStore(job, candidates);

  return prisma.job_match_scores.findMany({
    where: { job_id: jobId },
    include: { profile: true },
    orderBy: { score: "desc" },
  });
}

/**
 * RAG-enhanced matching: vector pre-filter → enrich top-K → Claude fine-score.
 * Falls back to legacy computeAndStoreMatches if no profile embeddings exist.
 */
export async function computeAndStoreMatchesRAG(jobId: string, topK: number = 20) {
  const job = (await prisma.jobs.findUnique({ where: { job_id: jobId } })) as JobRow | null;
  if (!job) throw new Error("Job not found");

  const { generateEmbedding, buildJobText } = await import("./embeddings");
  const { searchSimilarProfiles, getJobEmbeddingVector, upsertJobEmbedding } = await import("./vector-store");

  let jobEmbedding = await getJobEmbeddingVector(jobId);
  if (!jobEmbedding) {
    const text = buildJobText(job as Parameters<typeof buildJobText>[0]);
    jobEmbedding = await generateEmbedding(text);
    await upsertJobEmbedding(jobId, text, jobEmbedding);
  }

  const similarProfiles = await searchSimilarProfiles(jobEmbedding, topK, 0.2);
  if (similarProfiles.length === 0) {
    return computeAndStoreMatches(jobId);
  }

  const candidateIds = similarProfiles.map((r) => r.profileId);
  const candidates = (await prisma.profile.findMany({
    where: { id: { in: candidateIds }, user_type: "professional" },
  })) as unknown as ProfileRow[];

  await scoreAndStore(job, candidates);

  return prisma.job_match_scores.findMany({
    where: { job_id: jobId },
    include: { profile: true },
    orderBy: { score: "desc" },
  });
}
