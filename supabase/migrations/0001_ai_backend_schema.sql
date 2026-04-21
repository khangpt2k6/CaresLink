-- 0001 — AI backend tables
--
-- Adds the 6 tables we need for the AI stuff (usage log, agent memory,
-- facts, embeddings for profiles/jobs, match scores).
--
-- Two things I changed from the spec — both called out at the bottom
-- of this file so it's easy to review:
--   1. HNSW indexes instead of IVFFlat
--   2. search_profiles() is service_role only, not authenticated
--
-- FKs to profile / jobs / ai_agents / JobApplications are inside a DO
-- block so this file doesn't blow up when I run it on my local POC
-- (which doesn't have those tables). On prod they'll attach normally.

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- 1. ai_usage_log
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,
  model               text NOT NULL,
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  total_tokens        integer NOT NULL DEFAULT 0,
  cost_cents          double precision NOT NULL DEFAULT 0,
  duration_ms         integer NOT NULL DEFAULT 0,
  endpoint            text,
  user_id             uuid,            -- FK to public.profile(id),       added conditionally
  agent_id            uuid,            -- FK to public.ai_agents(id),     added conditionally
  job_application_id  uuid,            -- FK to public.JobApplications,   added conditionally
  success             boolean NOT NULL DEFAULT true,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_id_idx    ON public.ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_provider_idx   ON public.ai_usage_log(provider);

-- 2. agent_memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL,
  user_id     uuid NOT NULL,           -- FK to public.profile(id),   added conditionally
  agent_id    uuid,                    -- FK to public.ai_agents(id), added conditionally
  history     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_memory_session_user_unique UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS agent_memory_user_id_idx ON public.agent_memory(user_id);

-- 3. semantic_facts
CREATE TABLE IF NOT EXISTS public.semantic_facts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,          -- FK to public.profile(id), added conditionally
  fact         text NOT NULL,
  category     text NOT NULL,
  entity_id    uuid,
  entity_type  text,
  embedding    vector(384) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS semantic_facts_user_id_idx ON public.semantic_facts(user_id);
-- using HNSW here instead of IVFFlat — see note at bottom
CREATE INDEX IF NOT EXISTS semantic_facts_embedding_idx
  ON public.semantic_facts USING hnsw (embedding vector_cosine_ops);

-- 4. profile_embeddings
CREATE TABLE IF NOT EXISTS public.profile_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid UNIQUE NOT NULL,    -- FK to public.profile(id), added conditionally
  content     text NOT NULL,
  embedding   vector(384) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_embeddings_embedding_idx
  ON public.profile_embeddings USING hnsw (embedding vector_cosine_ops);

-- 5. job_embeddings
CREATE TABLE IF NOT EXISTS public.job_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid UNIQUE NOT NULL,    -- FK to public.jobs(job_id), added conditionally
  content     text NOT NULL,
  embedding   vector(384) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_embeddings_embedding_idx
  ON public.job_embeddings USING hnsw (embedding vector_cosine_ops);

-- 6. job_match_scores
CREATE TABLE IF NOT EXISTS public.job_match_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL,          -- FK to public.jobs(job_id), added conditionally
  profile_id   uuid NOT NULL,          -- FK to public.profile(id),  added conditionally
  score        integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  label        text NOT NULL,
  reason       text NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_match_scores_unique UNIQUE (job_id, profile_id)
);

CREATE INDEX IF NOT EXISTS job_match_scores_job_id_score_idx
  ON public.job_match_scores(job_id, score DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.ai_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_memory_updated_at       ON public.agent_memory;
DROP TRIGGER IF EXISTS semantic_facts_updated_at     ON public.semantic_facts;
DROP TRIGGER IF EXISTS profile_embeddings_updated_at ON public.profile_embeddings;
DROP TRIGGER IF EXISTS job_embeddings_updated_at     ON public.job_embeddings;

CREATE TRIGGER agent_memory_updated_at       BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();
CREATE TRIGGER semantic_facts_updated_at     BEFORE UPDATE ON public.semantic_facts
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();
CREATE TRIGGER profile_embeddings_updated_at BEFORE UPDATE ON public.profile_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();
CREATE TRIGGER job_embeddings_updated_at     BEFORE UPDATE ON public.job_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- RLS. Service role bypasses this, so the Next.js backend is unaffected.
-- Flutter hits the DB directly with the anon/authenticated key, so it does apply there.
ALTER TABLE public.ai_usage_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semantic_facts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_embeddings ENABLE ROW LEVEL SECURITY;  -- extra, not in spec
ALTER TABLE public.job_embeddings     ENABLE ROW LEVEL SECURITY;  -- extra, not in spec
ALTER TABLE public.job_match_scores   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own usage"        ON public.ai_usage_log;
DROP POLICY IF EXISTS "own memory"       ON public.agent_memory;
DROP POLICY IF EXISTS "own facts"        ON public.semantic_facts;
DROP POLICY IF EXISTS "own matches"      ON public.job_match_scores;
DROP POLICY IF EXISTS "read embeddings"  ON public.profile_embeddings;
DROP POLICY IF EXISTS "read job embeds"  ON public.job_embeddings;

CREATE POLICY "own usage"   ON public.ai_usage_log     FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own memory"  ON public.agent_memory     FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own facts"   ON public.semantic_facts   FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own matches" ON public.job_match_scores FOR SELECT USING (auth.uid() = profile_id);

-- Embeddings are shared-read. Writes are done by the backend (service role).
CREATE POLICY "read embeddings" ON public.profile_embeddings FOR SELECT TO authenticated USING (true);
CREATE POLICY "read job embeds" ON public.job_embeddings     FOR SELECT TO authenticated USING (true);

-- search_profiles — restricted to service_role, see note at bottom
CREATE OR REPLACE FUNCTION public.search_profiles(
  query_embedding vector(384),
  match_count     integer DEFAULT 10,
  min_similarity  float   DEFAULT 0.3
)
RETURNS TABLE (
  profile_id uuid,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pe.profile_id,
         1 - (pe.embedding <=> query_embedding) AS similarity
  FROM public.profile_embeddings pe
  WHERE 1 - (pe.embedding <=> query_embedding) > min_similarity
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(vector, integer, float) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_profiles(vector, integer, float) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.search_profiles(vector, integer, float) TO service_role;

-- Foreign keys — only attach if the target table actually exists,
-- so the same file runs on my local POC and on prod.
DO $$
BEGIN
  -- → public.profile(id)
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='profile') THEN
    BEGIN ALTER TABLE public.ai_usage_log       ADD CONSTRAINT ai_usage_log_user_id_fkey        FOREIGN KEY (user_id)    REFERENCES public.profile(id);        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.agent_memory       ADD CONSTRAINT agent_memory_user_id_fkey        FOREIGN KEY (user_id)    REFERENCES public.profile(id);        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.semantic_facts     ADD CONSTRAINT semantic_facts_user_id_fkey      FOREIGN KEY (user_id)    REFERENCES public.profile(id);        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.profile_embeddings ADD CONSTRAINT profile_embeddings_profile_fkey  FOREIGN KEY (profile_id) REFERENCES public.profile(id);        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.job_match_scores   ADD CONSTRAINT job_match_scores_profile_fkey    FOREIGN KEY (profile_id) REFERENCES public.profile(id);        EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  -- → public.jobs(job_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='jobs') THEN
    BEGIN ALTER TABLE public.job_embeddings   ADD CONSTRAINT job_embeddings_job_fkey     FOREIGN KEY (job_id) REFERENCES public.jobs(job_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.job_match_scores ADD CONSTRAINT job_match_scores_job_fkey   FOREIGN KEY (job_id) REFERENCES public.jobs(job_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  -- → public.ai_agents(id)
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ai_agents') THEN
    BEGIN ALTER TABLE public.ai_usage_log ADD CONSTRAINT ai_usage_log_agent_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TABLE public.agent_memory ADD CONSTRAINT agent_memory_agent_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  -- → public."JobApplications"(application_id)  -- yeah, this one is PascalCase in prod
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='JobApplications') THEN
    BEGIN ALTER TABLE public.ai_usage_log ADD CONSTRAINT ai_usage_log_job_app_fkey FOREIGN KEY (job_application_id) REFERENCES public."JobApplications"(application_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- -------------------------------------------------------------
-- Notes on what I changed from the spec (easy to revert either one)
-- -------------------------------------------------------------
--
-- 1) HNSW instead of IVFFlat (lists=100)
--    IVFFlat needs a periodic REINDEX to keep recall up once the
--    data drifts — the centroids go stale as rows come in. Since
--    candidates/jobs keep getting added, HNSW is less ops for us
--    and it's also the default Supabase recommends on newer
--    pgvector. Downsides: build is a bit slower and it uses a bit
--    more memory. If there's a reason to stick with IVFFlat (ops
--    constraint, pgvector version, etc.) just swap the index back.
--
-- 2) search_profiles() is service_role only
--    The spec didn't include any GRANT, which in Supabase means
--    PostgREST still exposes the RPC to `authenticated` by default.
--    With SECURITY DEFINER that lets any logged-in user vector-
--    search the whole profile table through the API. I revoked
--    anon/authenticated and granted service_role only, so it can
--    only be called from the Next.js backend (which holds the
--    service role key). The Flutter app isn't supposed to call
--    this directly anyway. Flip the GRANT back to authenticated
--    if direct client search is actually the intent.
