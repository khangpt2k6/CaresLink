-- Migration: credential_checks table for Flutter Credential Verification UI.
-- Stores FL DOH (and future Nursys/OIG/SAM) lookup results + AI recommendation.

create table if not exists public.credential_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- employer who ran the check
  created_by_user_id uuid not null references public.profile(id) on delete cascade,

  -- optional link to an existing professional profile in our system
  candidate_profile_id uuid references public.profile(id) on delete set null,

  candidate_first_name text,
  candidate_middle_name text,
  candidate_last_name text not null,
  candidate_email text,
  candidate_phone text,

  license_number text,
  role_type text not null check (role_type in ('RN', 'LPN', 'CNA')),
  state text not null default 'FL',

  -- 'pending' while scraping, 'completed' on success, 'error' on failure
  status text not null default 'pending' check (status in ('pending', 'completed', 'error')),

  -- raw scraper output (FloridaDOHResult JSON etc.)
  source_results jsonb,

  -- AI classification: 'employable' | 'review_required' | 'not_employable'
  ai_recommendation text check (ai_recommendation in ('employable', 'review_required', 'not_employable')),
  ai_reason text
);

create index if not exists idx_credential_checks_created_by on public.credential_checks (created_by_user_id, created_at desc);
create index if not exists idx_credential_checks_candidate on public.credential_checks (candidate_profile_id);

-- Keep updated_at fresh
create or replace function public.credential_checks_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_credential_checks_updated_at on public.credential_checks;
create trigger trg_credential_checks_updated_at
before update on public.credential_checks
for each row execute function public.credential_checks_set_updated_at();

-- RLS: employers can only see/modify their own checks. Service role bypasses.
alter table public.credential_checks enable row level security;

drop policy if exists credential_checks_select_own on public.credential_checks;
create policy credential_checks_select_own on public.credential_checks
  for select using (auth.uid() = created_by_user_id);

drop policy if exists credential_checks_insert_own on public.credential_checks;
create policy credential_checks_insert_own on public.credential_checks
  for insert with check (auth.uid() = created_by_user_id);

drop policy if exists credential_checks_update_own on public.credential_checks;
create policy credential_checks_update_own on public.credential_checks
  for update using (auth.uid() = created_by_user_id);

drop policy if exists credential_checks_delete_own on public.credential_checks;
create policy credential_checks_delete_own on public.credential_checks
  for delete using (auth.uid() = created_by_user_id);
