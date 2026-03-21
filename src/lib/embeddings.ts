import { prisma } from "./db";
import { upsertCandidateEmbedding, upsertJobEmbedding } from "./vector-store";

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
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
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
 * Fetch a candidate + profile and generate/store its embedding.
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
  } catch (e) {
    console.error(`[embeddings] Failed to embed candidate ${candidateId}:`, e);
  }
}

/**
 * Fetch a job and generate/store its embedding.
 */
export async function embedJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const text = buildJobText(job);
    const embedding = await generateEmbedding(text);
    await upsertJobEmbedding(jobId, text, embedding);
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
