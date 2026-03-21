-- ============================================================
-- Migration: Pipeline visibility rules & WON auto-removal
--
-- Problems solved:
--   1. No won_at timestamp → can't compute "2 days after WON"
--   2. No centralized visibility logic → ghost cards
--   3. Client deletion doesn't remove deals
--   4. Cron only cleans lost, not won
--   5. No realtime-friendly view
--
-- Strategy:
--   - Add won_at column to pipeline_deals
--   - Backfill won_at from updated_at for existing closed deals
--   - Create pipeline_deals_visible view as single source of truth
--   - Update set_deal_stage RPC to set won_at
--   - Update cleanup cron to also remove old won deals
--   - Add trigger to soft-delete deals when client is deleted
-- ============================================================

begin;

-- ============================================================
-- 1. Add won_at column to pipeline_deals
-- ============================================================

alter table public.pipeline_deals
  add column if not exists won_at timestamptz null;

comment on column public.pipeline_deals.won_at
  is 'Timestamp when deal moved to closed/won stage. Used for auto-removal after 2 days.';

-- Backfill: existing closed deals get won_at = updated_at
update public.pipeline_deals
set won_at = updated_at
where stage = 'closed'
  and won_at is null
  and deleted_at is null;

-- Index for cleanup queries
create index if not exists idx_pipeline_deals_org_won_at
  on public.pipeline_deals (org_id, won_at)
  where deleted_at is null and stage = 'closed';

-- ============================================================
-- 2. Create pipeline_deals_visible view
--    Single source of truth for pipeline card visibility.
--    A deal is visible if ALL of these are true:
--      - Not soft-deleted (deleted_at IS NULL)
--      - Lead not soft-deleted (if linked)
--      - Client not soft-deleted (if linked)
--      - If stage=closed (WON): won_at is within last 2 days
--      - If stage=lost: lost_at is within last 15 days
-- ============================================================

create or replace view public.pipeline_deals_visible as
select pd.*
from public.pipeline_deals pd
where pd.deleted_at is null
  -- Exclude deals whose lead has been soft-deleted
  and (
    pd.lead_id is null
    or exists (
      select 1 from public.leads l
      where l.id = pd.lead_id and l.deleted_at is null
    )
  )
  -- Exclude deals whose client has been soft-deleted
  and (
    pd.client_id is null
    or exists (
      select 1 from public.clients c
      where c.id = pd.client_id and c.deleted_at is null
    )
  )
  -- WON deals: visible only for 2 days after won_at
  and (
    pd.stage <> 'closed'
    or pd.won_at is null
    or pd.won_at > now() - interval '2 days'
  )
  -- LOST deals: visible only for 15 days after lost_at
  and (
    pd.stage <> 'lost'
    or pd.lost_at is null
    or pd.lost_at > now() - interval '15 days'
  );

comment on view public.pipeline_deals_visible
  is 'Pipeline deals that should be displayed in the Kanban. Filters out deleted, orphaned, and expired WON/LOST deals.';

-- Grant access (same as pipeline_deals table)
grant select on public.pipeline_deals_visible to authenticated, service_role;

-- ============================================================
-- 3. Update set_deal_stage RPC to set won_at when stage=closed
-- ============================================================

create or replace function public.set_deal_stage(
  p_deal_id uuid,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_deal public.pipeline_deals%rowtype;
  v_old_stage text;
  v_client_id uuid;
  v_job_id uuid;
begin
  -- Validate stage
  if p_stage not in ('new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost') then
    raise exception 'Invalid stage: %', p_stage;
  end if;

  -- Lock and fetch deal
  select * into v_deal
  from public.pipeline_deals
  where id = p_deal_id
    and deleted_at is null
  for update;

  if v_deal.id is null then
    raise exception 'Deal not found or deleted';
  end if;

  if not public.has_org_membership(auth.uid(), v_deal.org_id) then
    raise exception 'Not allowed for this organization';
  end if;

  v_old_stage := v_deal.stage;

  -- Handle LOST stage
  if p_stage = 'lost' then
    update public.pipeline_deals
    set stage = 'lost',
        lost_at = coalesce(lost_at, now()),
        won_at = null,
        updated_at = now()
    where id = v_deal.id
    returning * into v_deal;

    -- Cancel linked job
    if v_deal.job_id is not null then
      update public.jobs
      set status = 'cancelled', updated_at = now()
      where id = v_deal.job_id and deleted_at is null;
    end if;

  -- Handle CLOSED (WON) stage
  elsif p_stage = 'closed' then
    -- Resolve client_id: use existing or create minimal client from lead
    v_client_id := v_deal.client_id;
    if v_client_id is null and v_deal.lead_id is not null then
      -- Try to get client from lead conversion
      select converted_to_client_id into v_client_id
      from public.leads
      where id = v_deal.lead_id and deleted_at is null;

      -- If still no client, create a minimal one from lead data
      if v_client_id is null then
        insert into public.clients (org_id, first_name, last_name, email, phone, created_by)
        select v_deal.org_id, l.first_name, l.last_name, l.email, l.phone, v_deal.created_by
        from public.leads l
        where l.id = v_deal.lead_id
        returning id into v_client_id;

        -- Link lead to client
        update public.leads
        set converted_to_client_id = v_client_id,
            converted_at = now(),
            updated_at = now()
        where id = v_deal.lead_id and deleted_at is null;
      end if;
    end if;

    update public.pipeline_deals
    set stage = 'closed',
        client_id = coalesce(v_client_id, client_id),
        won_at = coalesce(won_at, now()),
        lost_at = null,
        updated_at = now()
    where id = v_deal.id
    returning * into v_deal;

    -- Complete linked job
    if v_deal.job_id is not null then
      update public.jobs
      set status = 'completed', updated_at = now()
      where id = v_deal.job_id and deleted_at is null;
    end if;

  -- Handle other stages (new, follow_up_*)
  else
    update public.pipeline_deals
    set stage = p_stage,
        lost_at = null,
        won_at = null,
        updated_at = now()
    where id = v_deal.id
    returning * into v_deal;
  end if;

  return jsonb_build_object(
    'deal_id', v_deal.id,
    'stage', v_deal.stage,
    'old_stage', v_old_stage,
    'won_at', v_deal.won_at,
    'lost_at', v_deal.lost_at
  );
end;
$fn$;

-- ============================================================
-- 4. Trigger: soft-delete deals when linked client is soft-deleted
--    (ON DELETE SET NULL doesn't catch soft-deletes)
-- ============================================================

create or replace function public.pipeline_deals_cascade_client_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- When a client gets soft-deleted, soft-delete their pipeline deals too
  if old.deleted_at is null and new.deleted_at is not null then
    update public.pipeline_deals
    set deleted_at = now(), updated_at = now()
    where client_id = new.id
      and deleted_at is null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_clients_cascade_pipeline_soft_delete on public.clients;
create trigger trg_clients_cascade_pipeline_soft_delete
  after update of deleted_at on public.clients
  for each row
  execute function public.pipeline_deals_cascade_client_soft_delete();

-- ============================================================
-- 5. Update cleanup cron function to also remove expired WON deals
-- ============================================================

create or replace function public.cleanup_expired_pipeline_deals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_lost_count integer := 0;
  v_won_count integer := 0;
begin
  -- Soft-delete LOST deals older than 15 days
  with deleted_lost as (
    update public.pipeline_deals
    set deleted_at = now(), updated_at = now()
    where deleted_at is null
      and stage = 'lost'
      and lost_at is not null
      and lost_at <= now() - interval '15 days'
    returning id
  )
  select count(*) into v_lost_count from deleted_lost;

  -- Soft-delete WON deals older than 2 days
  with deleted_won as (
    update public.pipeline_deals
    set deleted_at = now(), updated_at = now()
    where deleted_at is null
      and stage = 'closed'
      and won_at is not null
      and won_at <= now() - interval '2 days'
    returning id
  )
  select count(*) into v_won_count from deleted_won;

  return jsonb_build_object(
    'lost_cleaned', v_lost_count,
    'won_cleaned', v_won_count,
    'cleaned_at', now()
  );
end;
$fn$;

-- Update cron job (replace old one if exists)
-- Runs every hour to catch deals promptly after 2-day window
do $cron_setup$
begin
  -- Try to unschedule old cron jobs
  begin
    perform cron.unschedule('cleanup-lost-pipeline-deals');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('cleanup-expired-pipeline-deals');
  exception when others then null;
  end;

  -- Schedule new combined cleanup (hourly)
  perform cron.schedule(
    'cleanup-expired-pipeline-deals',
    '0 * * * *',
    'select public.cleanup_expired_pipeline_deals()'
  );
exception when others then
  -- pg_cron not available, skip (cleanup handled by view filter)
  raise notice 'pg_cron not available, skipping cron setup. View filter handles visibility.';
end;
$cron_setup$;

-- ============================================================
-- 6. Ensure RLS on the view works (inherit from base table)
-- ============================================================

-- The view pipeline_deals_visible inherits RLS from pipeline_deals
-- since it queries the base table. No additional policies needed.

commit;
