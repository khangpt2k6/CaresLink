import { prisma } from "./db";

// ─── pgvector operations via raw SQL ─────────────────────────
// Prisma's Unsupported("vector(384)") type cannot be used with
// the normal query builder — all vector operations use $queryRawUnsafe.

/**
 * Insert or update a candidate's embedding vector.
 */
export async function upsertCandidateEmbedding(
  candidateId: string,
  content: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$queryRawUnsafe(
    `INSERT INTO "CandidateEmbedding" (id, "candidateId", content, embedding, "updatedAt", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3::vector, NOW(), NOW())
     ON CONFLICT ("candidateId") DO UPDATE SET
       content = $2, embedding = $3::vector, "updatedAt" = NOW()`,
    candidateId,
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
    `INSERT INTO "JobEmbedding" (id, "jobId", content, embedding, "updatedAt", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3::vector, NOW(), NOW())
     ON CONFLICT ("jobId") DO UPDATE SET
       content = $2, embedding = $3::vector, "updatedAt" = NOW()`,
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
    `INSERT INTO "SemanticFact" (id, "userId", fact, category, "entityId", "entityType", embedding, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW(), NOW())`,
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
 * Find candidates most similar to a query embedding.
 */
export async function searchSimilarCandidates(
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<(SimilarityResult & { candidateId: string })[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRawUnsafe<(SimilarityResult & { candidateId: string })[]>(
    `SELECT "candidateId" AS "candidateId", id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "CandidateEmbedding"
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
    `SELECT "jobId" AS "jobId", id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "JobEmbedding"
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
    `SELECT id, fact, category, "entityId", "entityType",
            1 - (embedding <=> $1::vector) AS similarity
     FROM "SemanticFact"
     WHERE "userId" = $2
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
    `SELECT embedding::text FROM "JobEmbedding" WHERE "jobId" = $1 LIMIT 1`,
    jobId
  );
  if (results.length === 0) return null;
  // Parse "[0.1,0.2,...]" string back to number[]
  return JSON.parse(results[0].embedding);
}
