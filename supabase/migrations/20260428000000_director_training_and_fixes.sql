-- ============================================================
-- Director Panel: Training Jobs + Credit Balance Auto-Creation
-- ============================================================

begin;

-- 1. Training jobs table
create table if not exists public.director_training_jobs (
  id              text        primary key,
  org_id          uuid        not null,
  name            text        not null,
  trigger_word    text        not null,
  base_model      text        not null default 'flux-dev-lora',
  steps           int         not null default 1000,
  image_count     int         not null default 0,
  status          text        not null default 'pending'
                              check (status in ('pending','uploading','training','completed','failed')),
  model_id        text,
  fal_request_id  text,
  error_json      jsonb       default '{}',
  metadata_json   jsonb       default '{}',
  completed_at    timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_director_training_jobs_org
  on director_training_jobs (org_id, created_at desc);

alter table director_training_jobs enable row level security;
create policy director_training_jobs_select on director_training_jobs
  for select using (has_org_membership(auth.uid(), org_id));
create policy director_training_jobs_insert on director_training_jobs
  for insert with check (has_org_membership(auth.uid(), org_id));

-- 2. Auto-create credit balance for new orgs
create or replace function public.ensure_org_credit_balance()
returns trigger as $$
begin
  insert into public.org_credit_balances (org_id, credits_balance)
  values (NEW.id, 100)
  on conflict (org_id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

-- Attach to orgs/organizations table if it exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'organizations' and table_schema = 'public') then
    drop trigger if exists trg_ensure_org_credits on public.organizations;
    create trigger trg_ensure_org_credits after insert on public.organizations
      for each row execute function ensure_org_credit_balance();
  end if;
end $$;

-- 3. Fix director_flow_links check constraint to include 'audience'
do $$
begin
  -- Drop old constraint if exists and recreate with audience
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name like '%entity_type%' and table_name = 'director_flow_links'
  ) then
    alter table public.director_flow_links drop constraint if exists director_flow_links_entity_type_check;
  end if;
  alter table public.director_flow_links add constraint director_flow_links_entity_type_check
    check (entity_type in ('campaign', 'product', 'brand', 'audience'));
exception when others then
  null; -- table may not exist yet
end $$;

-- 4. Ensure director-assets storage bucket
-- (This must be done via API, not SQL — handled in server route)

commit;
