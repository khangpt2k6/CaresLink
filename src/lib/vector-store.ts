import { prisma } from "./db";

// ─── pgvector operations via raw SQL ─────────────────────────
// Prisma's Unsupported("vector") type cannot be used with the normal
// query builder — all vector reads/writes go through $queryRawUnsafe.
// Tables used here (Flutter production schema):
//   public.profile_embeddings(profile_id uuid unique, content, embedding)
//   public.job_embeddings(job_id uuid unique, content, embedding)
//   public.semantic_facts(user_id, fact, category, entity_id, entity_type, embedding)

/**
 * Insert or update a profile's embedding vector.
 * (On the Flutter schema, "candidate" = profile with user_type = 'professional'.)
 */
export async function upsertProfileEmbedding(
  profileId: string,
  content: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$queryRawUnsafe(
    `INSERT INTO public.profile_embeddings (id, profile_id, content, embedding, created_at, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, NOW(), NOW())
     ON CONFLICT (profile_id) DO UPDATE SET
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       updated_at = NOW()`,
    profileId,
    content,
    vectorStr
  );
}

/**
 * Insert or update a job's embedding vector.
 */
export async function upsertJobEmbedding(
  jobId: string,
  content: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$queryRawUnsafe(
    `INSERT INTO public.job_embeddings (id, job_id, content, embedding, created_at, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, NOW(), NOW())
     ON CONFLICT (job_id) DO UPDATE SET
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       updated_at = NOW()`,
    jobId,
    content,
    vectorStr
  );
}

/**
 * Insert a semantic fact with its embedding vector.
 */
export async function insertFactEmbedding(
  id: string,
  userId: string,
  fact: string,
  category: string,
  embedding: number[],
  entityId?: string | null,
  entityType?: string | null
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$queryRawUnsafe(
    `INSERT INTO public.semantic_facts (id, user_id, fact, category, entity_id, entity_type, embedding, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7::vector, NOW(), NOW())`,
    id,
    userId,
    fact,
    category,
    entityId ?? null,
    entityType ?? null,
    vectorStr
  );
}

// ─── Similarity Search ───────────────────────────────────────

export interface SimilarityResult {
  id: string;
  similarity: number;
}

/**
 * Find profiles (candidates) most similar to a query embedding.
 */
export async function searchSimilarProfiles(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<(SimilarityResult & { profileId: string })[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRawUnsafe<(SimilarityResult & { profileId: string })[]>(
    `SELECT profile_id AS "profileId", id::text AS id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM public.profile_embeddings
     WHERE 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    minSimilarity,
    limit
  );
}

/**
 * Find jobs most similar to a query embedding.
 */
export async function searchSimilarJobs(
  queryEmbedding: number[],
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<(SimilarityResult & { jobId: string })[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRawUnsafe<(SimilarityResult & { jobId: string })[]>(
    `SELECT job_id AS "jobId", id::text AS id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM public.job_embeddings
     WHERE 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    minSimilarity,
    limit
  );
}

/**
 * Find semantic facts most similar to a query, scoped to a user.
 */
export async function searchSimilarFacts(
  userId: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<{ id: string; fact: string; category: string; entityId: string | null; entityType: string | null; similarity: number }[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRawUnsafe(
    `SELECT id::text AS id, fact, category,
            entity_id::text AS "entityId",
            entity_type AS "entityType",
            1 - (embedding <=> $1::vector) AS similarity
     FROM public.semantic_facts
     WHERE user_id = $2::uuid
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    userId,
    limit
  );
}

/**
 * Get the stored embedding vector for a job (for RAG matching).
 */
export async function getJobEmbeddingVector(
  jobId: string
): Promise<number[] | null> {
  const results = await prisma.$queryRawUnsafe<{ embedding: string }[]>(
    `SELECT embedding::text FROM public.job_embeddings WHERE job_id = $1::uuid LIMIT 1`,
    jobId
  );
  if (results.length === 0) return null;
  return JSON.parse(results[0].embedding);
}

/**
 * Get the stored embedding vector for a profile.
 */
export async function getProfileEmbeddingVector(
  profileId: string
): Promise<number[] | null> {
  const results = await prisma.$queryRawUnsafe<{ embedding: string }[]>(
    `SELECT embedding::text FROM public.profile_embeddings WHERE profile_id = $1::uuid LIMIT 1`,
    profileId
  );
  if (results.length === 0) return null;
  return JSON.parse(results[0].embedding);
}
