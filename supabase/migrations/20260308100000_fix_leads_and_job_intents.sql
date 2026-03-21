-- 1) Drop the leads_org_fk constraint that references a non-existent organizations table.
alter table if exists public.leads drop constraint if exists leads_org_fk;

-- 2) Ensure the unique index on job_intents exists and is usable.
--    PostgreSQL's "ON CONFLICT ON CONSTRAINT <name>" requires a real constraint,
--    not just a unique index. Drop the index and recreate as an actual constraint.
drop index if exists public.uq_job_intents_pending_lead;

-- Add soft-delete column if missing (needed for the partial index condition).
alter table if exists public.job_intents
  add column if not exists deleted_at timestamptz;

-- Create a proper partial unique index that the trigger can reference.
create unique index if not exists uq_job_intents_pending_lead
  on public.job_intents (lead_id)
  where status = 'pending' and deleted_at is null;

-- 3) Rewrite the trigger function to use ON CONFLICT with the index predicate
--    instead of ON CONFLICT ON CONSTRAINT (which requires a named table constraint).
create or replace function public.pipeline_deals_emit_job_intent()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage_slug text;
  v_active_job_exists boolean;
begin
  if new.lead_id is null then
    return new;
  end if;

  v_stage_slug := lower(replace(coalesce(new.stage, ''), ' ', '_'));

  if v_stage_slug <> 'qualified' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(replace(coalesce(old.stage, ''), ' ', '_')) = 'qualified' then
      return new;
    end if;
  end if;

  select exists (
    select 1
    from public.jobs j
    where j.lead_id = new.lead_id
      and j.deleted_at is null
      and lower(coalesce(j.status, 'unscheduled')) not in ('done', 'canceled', 'cancelled', 'completed')
  ) into v_active_job_exists;

  if v_active_job_exists then
    return new;
  end if;

  -- Use column-based ON CONFLICT with the WHERE clause matching the partial unique index.
  insert into public.job_intents (org_id, lead_id, deal_id, triggered_stage, status, created_by)
  values (new.org_id, new.lead_id, new.id, v_stage_slug, 'pending', auth.uid())
  on conflict (lead_id) where status = 'pending' and deleted_at is null
  do update set
    deal_id = excluded.deal_id,
    triggered_stage = excluded.triggered_stage,
    created_at = now(),
    created_by = excluded.created_by,
    org_id = excluded.org_id;

  return new;
end;
$fn$;

drop trigger if exists trg_pipeline_deals_emit_job_intent on public.pipeline_deals;
create trigger trg_pipeline_deals_emit_job_intent
after insert or update of stage on public.pipeline_deals
for each row execute function public.pipeline_deals_emit_job_intent();
