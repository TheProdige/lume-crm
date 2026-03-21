-- ============================================================
-- Director Panel: Analytics & Learning
--
-- 1. Generation usage events (downloaded, copied, reused, deleted)
-- 2. Prompt performance scores (derived from usage)
-- ============================================================

begin;

-- ============================================================
-- 1. Usage events — tracks what users do with outputs
-- ============================================================

create table if not exists public.director_usage_events (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  generation_id   uuid        references director_generations(id) on delete cascade,
  event_type      text        not null
                              check (event_type in ('view','download','copy_prompt','reuse','delete','save_style','share','favorite')),
  metadata        jsonb       default '{}',
  created_at      timestamptz default now()
);

create index if not exists idx_director_usage_events_org
  on director_usage_events (org_id, created_at desc);

create index if not exists idx_director_usage_events_gen
  on director_usage_events (generation_id);

alter table director_usage_events enable row level security;

create policy director_usage_events_select on director_usage_events
  for select using (has_org_membership(auth.uid(), org_id));
create policy director_usage_events_insert on director_usage_events
  for insert with check (has_org_membership(auth.uid(), org_id));

-- ============================================================
-- 2. Add performance columns to director_generations
-- ============================================================

alter table public.director_generations
  add column if not exists usage_score int default 0,
  add column if not exists is_favorite boolean default false;

commit;
