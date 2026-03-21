-- ============================================================
-- Director Panel: Creative Direction System
--
-- Tables:
--   1. director_style_dna — reusable style profiles
--   2. director_creative_directions — structured generation packages
-- ============================================================

begin;

-- ============================================================
-- 1. Style DNA — reusable visual identity profiles
-- ============================================================

create table if not exists public.director_style_dna (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  created_by      uuid        references auth.users(id),
  name            text        not null,
  description     text,
  -- Visual identity
  color_palette   text[],
  lighting        text,
  contrast        text        check (contrast in ('low','medium','high','extreme')),
  texture         text,
  camera_style    text,
  composition     text,
  -- Style parameters
  realism_level   int         default 8 check (realism_level between 1 and 10),
  brand_descriptors text[],
  visual_rules    text[],
  negative_rules  text[],
  -- Serialized full config
  config_json     jsonb       default '{}',
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_director_style_dna_org
  on director_style_dna (org_id) where deleted_at is null;

create trigger trg_director_style_dna_updated_at
  before update on director_style_dna
  for each row execute function set_updated_at();

alter table director_style_dna enable row level security;

create policy director_style_dna_select on director_style_dna
  for select using (has_org_membership(auth.uid(), org_id));
create policy director_style_dna_insert on director_style_dna
  for insert with check (has_org_membership(auth.uid(), org_id));
create policy director_style_dna_update on director_style_dna
  for update using (has_org_membership(auth.uid(), org_id))
            with check (has_org_membership(auth.uid(), org_id));
create policy director_style_dna_delete on director_style_dna
  for delete using (has_org_membership(auth.uid(), org_id));

-- ============================================================
-- 2. Creative Directions — structured generation packages
-- ============================================================

create table if not exists public.director_creative_directions (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  created_by      uuid        references auth.users(id),
  flow_id         uuid        references director_flows(id) on delete set null,
  node_id         uuid,
  style_dna_id    uuid        references director_style_dna(id) on delete set null,
  -- Structured layers
  concept         text,
  subject         text,
  wardrobe        text,
  environment     text,
  mood            text,
  lighting        text,
  composition     text,
  camera          text,
  motion          text,
  realism_level   int         default 8 check (realism_level between 1 and 10),
  artistic_direction text,
  brand_tone      text,
  -- Shot design
  shot_type       text,
  camera_angle    text,
  camera_movement text,
  lens_type       text,
  depth_of_field  text,
  -- Continuity
  continuity_lock jsonb       default '{}',
  -- Prompts
  raw_prompt      text,
  optimized_prompt text,
  negative_prompt text,
  prompt_score    int         check (prompt_score between 0 and 100),
  -- Reference strategy
  references_json jsonb       default '[]',
  -- Full config
  config_json     jsonb       default '{}',
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_director_creative_directions_org
  on director_creative_directions (org_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_director_creative_directions_flow
  on director_creative_directions (flow_id)
  where deleted_at is null;

create trigger trg_director_creative_directions_updated_at
  before update on director_creative_directions
  for each row execute function set_updated_at();

alter table director_creative_directions enable row level security;

create policy director_creative_directions_select on director_creative_directions
  for select using (has_org_membership(auth.uid(), org_id));
create policy director_creative_directions_insert on director_creative_directions
  for insert with check (has_org_membership(auth.uid(), org_id));
create policy director_creative_directions_update on director_creative_directions
  for update using (has_org_membership(auth.uid(), org_id))
            with check (has_org_membership(auth.uid(), org_id));
create policy director_creative_directions_delete on director_creative_directions
  for delete using (has_org_membership(auth.uid(), org_id));

commit;
