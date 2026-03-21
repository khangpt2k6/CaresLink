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

// ─── Auto-Matching (real-time score recomputation) ───────────

/**
 * When a candidate's embedding changes, recompute their match score
 * against all open jobs using multi-factor scoring (fast, no LLM call).
 */
async function autoMatchCandidateToJobs(candidateId: string, candidateEmbedding: number[]): Promise<void> {
  try {
    const { getJobEmbeddingVector } = await import("./vector-store");

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { position: true, name: true },
    });
    if (!candidate) return;

    // Load candidate profile for multi-factor scoring
    const user = await prisma.user.findFirst({
      where: { email: { mode: "insensitive", equals: (await prisma.candidate.findUnique({ where: { id: candidateId }, select: { email: true } }))?.email || "" } },
      include: {
        profile: {
          include: { skills: true, certifications: true, experiences: true },
        },
      },
    });

    const openJobs = await prisma.job.findMany({
      where: { status: "open" },
      select: { id: true, title: true, location: true, type: true, description: true, department: true },
    });

    for (const job of openJobs) {
      const jobEmbedding = await getJobEmbeddingVector(job.id);
      if (!jobEmbedding) continue;

      const result = computeMultiFactorScore(
        candidateEmbedding, jobEmbedding,
        candidate.position, job.title,
        job.description,
        user?.profile?.skills?.map(s => s.name),
        user?.profile?.certifications?.map(c => c.name),
        user?.profile?.experiences?.map(e => e.title),
      );

      await prisma.jobMatch.upsert({
        where: { jobId_candidateId: { jobId: job.id, candidateId } },
        create: { jobId: job.id, candidateId, score: result.score, label: result.label, reason: result.reason, computedAt: new Date() },
        update: { score: result.score, label: result.label, reason: result.reason, computedAt: new Date() },
      });
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match candidate ${candidateId}:`, e);
  }
}

/**
 * When a job's embedding changes, score ALL candidates against it.
 * At typical recruitment scale (<1000 candidates) this is instant.
 */
async function autoMatchJobToCandidates(jobId: string): Promise<void> {
  try {
    const { getJobEmbeddingVector } = await import("./vector-store");

    const jobEmbedding = await getJobEmbeddingVector(jobId);
    if (!jobEmbedding) return;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, location: true, type: true, description: true, department: true },
    });
    if (!job) return;

    // Score ALL candidates with embeddings — no pre-filtering at this scale
    const allCandidateEmbeddings = await prisma.$queryRawUnsafe<{ candidateId: string; embedding: string }[]>(
      `SELECT "candidateId", embedding::text FROM "CandidateEmbedding"`
    );

    for (const row of allCandidateEmbeddings) {
      const candidate = await prisma.candidate.findUnique({
        where: { id: row.candidateId },
        select: { position: true, email: true },
      });
      if (!candidate) continue;

      const user = await prisma.user.findFirst({
        where: { email: { mode: "insensitive", equals: candidate.email } },
        include: {
          profile: {
            include: { skills: true, certifications: true, experiences: true },
          },
        },
      });

      const candVec: number[] = JSON.parse(row.embedding);

      const result = computeMultiFactorScore(
        candVec, jobEmbedding,
        candidate.position, job.title,
        job.description,
        user?.profile?.skills?.map(s => s.name),
        user?.profile?.certifications?.map(c => c.name),
        user?.profile?.experiences?.map(e => e.title),
      );

      await prisma.jobMatch.upsert({
        where: { jobId_candidateId: { jobId, candidateId: row.candidateId } },
        create: { jobId, candidateId: row.candidateId, score: result.score, label: result.label, reason: result.reason, computedAt: new Date() },
        update: { score: result.score, label: result.label, reason: result.reason, computedAt: new Date() },
      });
    }
  } catch (e) {
    console.error(`[auto-match] Failed to match job ${jobId}:`, e);
  }
}

// ─── Multi-Factor Scoring Engine ─────────────────────────────
// Combines multiple signals for accuracy closer to LLM scoring.

interface MatchResult {
  score: number;
  label: string;
  reason: string;
}

function computeMultiFactorScore(
  candidateEmbedding: number[],
  jobEmbedding: number[],
  candidatePosition: string,
  jobTitle: string,
  jobDescription?: string | null,
  candidateSkills?: string[],
  candidateCerts?: string[],
  candidateExpTitles?: string[],
): MatchResult {
  // Factor 1: Semantic similarity (50% weight)
  // bge-small-en-v1.5 typically produces similarities in 0.3-0.85 range
  const rawSimilarity = cosineSimilarity(candidateEmbedding, jobEmbedding);
  // Normalize from [0.25, 0.85] → [0, 100]
  const semanticScore = Math.min(100, Math.max(0, ((rawSimilarity - 0.25) / 0.60) * 100));

  // Factor 2: Position/title match (25% weight)
  const titleScore = computeTitleMatch(candidatePosition, jobTitle, candidateExpTitles);

  // Factor 3: Keyword overlap — skills/certs mentioned in job description (25% weight)
  const keywordScore = computeKeywordOverlap(jobTitle, jobDescription, candidateSkills, candidateCerts);

  // Weighted ensemble
  const finalScore = Math.round(
    semanticScore * 0.50 +
    titleScore * 0.25 +
    keywordScore * 0.25
  );

  const clampedScore = Math.min(100, Math.max(0, finalScore));
  const label = clampedScore >= 90 ? "Excellent fit" : clampedScore >= 75 ? "Good fit" : clampedScore >= 50 ? "Partial fit" : clampedScore >= 25 ? "Weak fit" : "Not a fit";

  // Build reason
  const reasons: string[] = [];
  if (titleScore >= 80) reasons.push("strong position alignment");
  else if (titleScore >= 50) reasons.push("related position");
  if (semanticScore >= 70) reasons.push("high semantic match on profile");
  if (keywordScore >= 60) reasons.push("relevant skills/certifications");
  if (reasons.length === 0) reasons.push("limited alignment with job requirements");

  const reason = `${label} — ${reasons.join(", ")}. Semantic: ${Math.round(semanticScore)}%, Title: ${Math.round(titleScore)}%, Skills: ${Math.round(keywordScore)}%.`;

  return { score: clampedScore, label, reason };
}

/**
 * Score how well candidate's position/experience titles match the job title.
 */
function computeTitleMatch(candidatePosition: string, jobTitle: string, experienceTitles?: string[]): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const jobNorm = normalize(jobTitle);
  const posNorm = normalize(candidatePosition);

  // Exact match
  if (posNorm === jobNorm) return 100;

  // Check if one contains the other
  if (jobNorm.includes(posNorm) || posNorm.includes(jobNorm)) return 85;

  // Common healthcare role abbreviation matching
  const roleMap: Record<string, string[]> = {
    "rn": ["registered nurse", "rn"],
    "lpn": ["licensed practical nurse", "lpn"],
    "cna": ["certified nursing assistant", "cna", "nurse aide"],
    "aprn": ["advanced practice", "aprn", "nurse practitioner"],
    "hha": ["home health aide", "hha"],
  };

  for (const [abbr, variants] of Object.entries(roleMap)) {
    const jobHasRole = variants.some(v => jobNorm.includes(v)) || jobNorm.includes(abbr);
    const candHasRole = variants.some(v => posNorm.includes(v)) || posNorm.includes(abbr);
    if (jobHasRole && candHasRole) return 90;
  }

  // Check experience titles
  if (experienceTitles) {
    for (const title of experienceTitles) {
      const titleNorm = normalize(title);
      if (titleNorm === jobNorm || jobNorm.includes(titleNorm) || titleNorm.includes(jobNorm)) return 75;
      // Check role abbreviations in experience
      for (const [abbr, variants] of Object.entries(roleMap)) {
        const jobHasRole = variants.some(v => jobNorm.includes(v)) || jobNorm.includes(abbr);
        const expHasRole = variants.some(v => titleNorm.includes(v)) || titleNorm.includes(abbr);
        if (jobHasRole && expHasRole) return 70;
      }
    }
  }

  // Word overlap
  const jobWords = new Set(jobNorm.split(/\s+/));
  const posWords = posNorm.split(/\s+/);
  const overlap = posWords.filter(w => jobWords.has(w) && w.length > 2).length;
  if (overlap >= 2) return 60;
  if (overlap >= 1) return 35;

  return 10;
}

/**
 * Score keyword overlap between candidate skills/certs and job description.
 */
function computeKeywordOverlap(
  jobTitle: string,
  jobDescription?: string | null,
  candidateSkills?: string[],
  candidateCerts?: string[],
): number {
  if (!candidateSkills?.length && !candidateCerts?.length) return 30; // no data, neutral score

  const jobText = `${jobTitle} ${jobDescription || ""}`.toLowerCase();
  const allTerms = [
    ...(candidateSkills || []),
    ...(candidateCerts || []),
  ].map(t => t.toLowerCase());

  if (allTerms.length === 0) return 30;

  let matches = 0;
  for (const term of allTerms) {
    // Check if the skill/cert appears in the job text
    if (jobText.includes(term)) {
      matches++;
    } else {
      // Check individual words (e.g., "BLS" in "BLS certification required")
      const words = term.split(/\s+/);
      if (words.some(w => w.length >= 3 && jobText.includes(w))) {
        matches += 0.5;
      }
    }
  }

  const ratio = matches / allTerms.length;
  return Math.min(100, Math.round(ratio * 100 + 20)); // base 20 + overlap bonus
}

/**
 * Cosine similarity between two vectors (0 to 1).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
