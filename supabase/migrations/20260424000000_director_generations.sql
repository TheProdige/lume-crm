-- ============================================================
-- Director Panel: Generations tracking table
-- Stores every AI generation output for the "Recent Generations" panel
-- ============================================================

begin;

create table if not exists public.director_generations (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  created_by      uuid        references auth.users(id),
  flow_id         uuid        references director_flows(id) on delete set null,
  run_id          uuid        references director_runs(id) on delete set null,
  node_id         uuid,
  template_id     text,
  title           text        not null default 'Untitled',
  prompt          text,
  output_type     text        not null default 'image'
                              check (output_type in ('image','video','edit','batch')),
  output_url      text,
  thumbnail_url   text,
  provider        text,
  model           text,
  status          text        not null default 'completed'
                              check (status in ('processing','completed','failed')),
  metadata        jsonb       default '{}',
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_director_generations_org
  on director_generations (org_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_director_generations_flow
  on director_generations (flow_id)
  where deleted_at is null;

create index if not exists idx_director_generations_type
  on director_generations (org_id, output_type)
  where deleted_at is null;

-- Updated-at trigger
create trigger trg_director_generations_updated_at
  before update on director_generations
  for each row execute function set_updated_at();

-- RLS
alter table director_generations enable row level security;

create policy director_generations_select on director_generations
  for select using (has_org_membership(auth.uid(), org_id));

create policy director_generations_insert on director_generations
  for insert with check (has_org_membership(auth.uid(), org_id));

create policy director_generations_update on director_generations
  for update using (has_org_membership(auth.uid(), org_id))
            with check (has_org_membership(auth.uid(), org_id));

create policy director_generations_delete on director_generations
  for delete using (has_org_membership(auth.uid(), org_id));

commit;
