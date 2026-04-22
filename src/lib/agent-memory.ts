import { prisma } from "./db";
import { generateEmbedding } from "./embeddings";
import { insertFactEmbedding, searchSimilarFacts } from "./vector-store";

/**
 * Store a semantic fact in the agent's long-term memory.
 * The fact is embedded and stored with a vector for later retrieval.
 */
export async function rememberFact(
  userId: string,
  fact: string,
  category: string,
  entityId?: string | null,
  entityType?: string | null
): Promise<{ id: string; fact: string; category: string }> {
  const id = crypto.randomUUID();
  const embedding = await generateEmbedding(fact);

  await insertFactEmbedding(id, userId, fact, category, embedding, entityId, entityType);

  return { id, fact, category };
}

/**
 * Recall facts from long-term memory that are semantically relevant to a query.
 */
export async function recallFacts(
  userId: string,
  query: string,
  limit: number = 5
): Promise<{ id: string; fact: string; category: string; similarity: number }[]> {
  const queryEmbedding = await generateEmbedding(query);
  const results = await searchSimilarFacts(userId, queryEmbedding, limit);

  return results.map((r) => ({
    id: r.id,
    fact: r.fact,
    category: r.category,
    similarity: typeof r.similarity === "number" ? r.similarity : Number(r.similarity),
  }));
}

/**
 * Delete a specific fact from long-term memory.
 */
export async function deleteFact(factId: string, userId: string): Promise<boolean> {
  const result = await prisma.semantic_facts.deleteMany({
    where: { id: factId, user_id: userId },
  });
  return result.count > 0;
}

/**
 * List all facts for a user, optionally filtered by category.
 */
export async function listFacts(
  userId: string,
  category?: string
): Promise<{ id: string; fact: string; category: string; createdAt: Date }[]> {
  const rows = await prisma.semantic_facts.findMany({
    where: {
      user_id: userId,
      ...(category ? { category } : {}),
    },
    select: { id: true, fact: true, category: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    fact: r.fact,
    category: r.category,
    createdAt: r.created_at,
  }));
}
