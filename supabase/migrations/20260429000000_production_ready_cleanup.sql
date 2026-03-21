-- ============================================================
-- Production-Ready Cleanup Migration
--
-- 1. Consolidate jobs.address / property_address
-- 2. Add jobs.start_at if missing
-- 3. Make schedule_events time columns nullable (canonical = start_at/end_at)
-- 4. Add team_members.team_id FK
-- 5. Normalize pipeline_deals.stage constraint
-- 6. Consolidate leads.status (drop leads.stage if exists)
-- 7. Fix jobs status constraint to lowercase
-- ============================================================

begin;

-- ============================================================
-- 1. Consolidate address columns on jobs
-- ============================================================

-- Ensure address column exists
alter table public.jobs add column if not exists address text;

-- Backfill: copy property_address → address where address is null
update public.jobs
  set address = property_address
  where address is null and property_address is not null and property_address != '-';

-- Keep property_address as a computed alias (trigger sync)
create or replace function public.jobs_sync_address()
returns trigger language plpgsql as $$
begin
  -- Sync property_address → address on write
  if NEW.property_address is distinct from OLD.property_address
     and (NEW.address is null or NEW.address = OLD.address) then
    NEW.address := NEW.property_address;
  end if;
  -- Sync address → property_address on write
  if NEW.address is distinct from OLD.address
     and (NEW.property_address is null or NEW.property_address = OLD.property_address) then
    NEW.property_address := NEW.address;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_jobs_sync_address on public.jobs;
create trigger trg_jobs_sync_address
  before update on public.jobs
  for each row execute function public.jobs_sync_address();

-- ============================================================
-- 2. Add jobs.start_at if missing
-- ============================================================

alter table public.jobs add column if not exists start_at timestamptz;

-- Backfill from scheduled_at
update public.jobs
  set start_at = scheduled_at
  where start_at is null and scheduled_at is not null;

-- ============================================================
-- 3. Make legacy time columns on schedule_events nullable
-- ============================================================

-- These may fail if the columns were already nullable — that's fine
do $$
begin
  alter table public.schedule_events alter column start_time drop not null;
exception when others then null;
end;
$$;

do $$
begin
  alter table public.schedule_events alter column end_time drop not null;
exception when others then null;
end;
$$;

-- ============================================================
-- 4. Add team_members.team_id FK to teams
-- ============================================================

alter table public.team_members add column if not exists team_id uuid;

-- Add FK only if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'team_members_team_id_fkey'
      and table_name = 'team_members'
  ) then
    alter table public.team_members
      add constraint team_members_team_id_fkey
      foreign key (team_id) references public.teams(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_team_members_team_id on public.team_members(team_id);

-- ============================================================
-- 5. Normalize pipeline_deals.stage constraint (6 canonical slugs only)
-- ============================================================

-- Drop old constraint safely
alter table public.pipeline_deals drop constraint if exists pipeline_deals_stage_check;

-- Normalize existing data to lowercase slugs
update public.pipeline_deals set stage = lower(trim(stage))
  where stage != lower(trim(stage));

-- Map legacy values
update public.pipeline_deals set stage = 'new' where lower(stage) in ('qualified', 'lead');
update public.pipeline_deals set stage = 'follow_up_1' where lower(stage) in ('contacted', 'contact', 'follow_up', 'proposal');
update public.pipeline_deals set stage = 'follow_up_2' where lower(stage) in ('estimate_sent', 'quote_sent', 'quote sent', 'negotiation');
update public.pipeline_deals set stage = 'closed' where lower(stage) in ('won');
update public.pipeline_deals set stage = 'lost' where lower(stage) in ('archived');

-- Add clean constraint
alter table public.pipeline_deals add constraint pipeline_deals_stage_check
  check (stage in ('new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost'));

-- ============================================================
-- 6. Normalize leads.status to lowercase slugs
-- ============================================================

-- Normalize existing data
update public.leads set status = lower(trim(status))
  where status != lower(trim(status));

-- Map legacy values
update public.leads set status = 'new' where lower(status) in ('qualified', 'lead');
update public.leads set status = 'follow_up_1' where lower(status) in ('contacted', 'contact', 'follow_up', 'proposal');
update public.leads set status = 'follow_up_2' where lower(status) in ('estimate_sent', 'quote_sent', 'negotiation');
update public.leads set status = 'closed' where lower(status) in ('won');
update public.leads set status = 'lost' where lower(status) in ('archived');

-- Drop old constraints
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads drop constraint if exists leads_stage_check;

-- Add clean constraint
alter table public.leads add constraint leads_status_check
  check (status in ('new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost'));

-- ============================================================
-- 7. Normalize jobs.status to lowercase
-- ============================================================

-- Normalize existing data
update public.jobs set status = lower(trim(status))
  where status != lower(trim(status));

-- Map legacy values
update public.jobs set status = 'draft' where lower(status) in ('unscheduled', 'late', 'action_required', 'qualified', 'quote_sent', 'lead', 'new');
update public.jobs set status = 'completed' where lower(status) in ('done', 'closed', 'requires_invoicing');
update public.jobs set status = 'cancelled' where lower(status) in ('canceled', 'lost');

-- Drop old constraint and add clean one
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled'));

commit;
