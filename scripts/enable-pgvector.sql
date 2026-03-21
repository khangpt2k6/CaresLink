-- Enable pgvector extension on Supabase PostgreSQL
-- Run this in Supabase SQL Editor or via psql
CREATE EXTENSION IF NOT EXISTS vector;

-- After running prisma db push, create HNSW indexes for fast similarity search:
CREATE INDEX IF NOT EXISTS idx_candidate_embedding_hnsw ON "CandidateEmbedding" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_job_embedding_hnsw ON "JobEmbedding" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_fact_embedding_hnsw ON "SemanticFact" USING hnsw (embedding vector_cosine_ops);
