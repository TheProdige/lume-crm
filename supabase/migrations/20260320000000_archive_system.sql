-- Archive system: adds archived_at/archived_by columns and restore functions
-- The existing deleted_at column serves as the soft-delete mechanism.
-- archived_at distinguishes "archived" (restorable) from "hard deleted".
-- When a record is archived, both deleted_at and archived_at are set.
-- Restoring clears both deleted_at and archived_at.

begin;

-- ── Add archive columns to clients ────────────────────────────
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.clients add column if not exists archived_by uuid;

-- ── Add archive columns to leads ──────────────────────────────
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists archived_by uuid;

-- ── Add archive columns to jobs ───────────────────────────────
alter table public.jobs add column if not exists archived_at timestamptz;
alter table public.jobs add column if not exists archived_by uuid;

-- ── Add archive columns to pipeline_deals ─────────────────────
alter table public.pipeline_deals add column if not exists archived_at timestamptz;
alter table public.pipeline_deals add column if not exists archived_by uuid;

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_clients_archived_at on public.clients (org_id, archived_at) where archived_at is not null;
create index if not exists idx_leads_archived_at on public.leads (org_id, archived_at) where archived_at is not null;
create index if not exists idx_jobs_archived_at on public.jobs (org_id, archived_at) where archived_at is not null;
create index if not exists idx_pipeline_deals_archived_at on public.pipeline_deals (org_id, archived_at) where archived_at is not null;

-- ── Archive client (sets both deleted_at and archived_at) ─────
create or replace function public.archive_client(p_org_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_client integer := 0;
  v_jobs integer := 0;
  v_leads integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can archive clients' using errcode = '42501';
  end if;

  update public.clients
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid
  where id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_client = row_count;

  update public.jobs
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid
  where client_id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_jobs = row_count;

  update public.leads
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid
  where org_id = p_org_id and deleted_at is null
    and (converted_to_client_id = p_client_id);
  get diagnostics v_leads = row_count;

  -- Also archive related pipeline deals
  update public.pipeline_deals pd
  set deleted_at = now(),
      archived_at = now(), archived_by = v_uid
  from public.leads l
  where pd.lead_id = l.id
    and l.converted_to_client_id = p_client_id
    and l.org_id = p_org_id
    and pd.deleted_at is null;

  return jsonb_build_object('client', v_client, 'jobs', v_jobs, 'leads', v_leads);
end;
$$;

-- ── Restore client (clears deleted_at and archived_at) ────────
create or replace function public.restore_client(p_org_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_client integer := 0;
  v_jobs integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can restore clients' using errcode = '42501';
  end if;

  update public.clients
  set deleted_at = null, deleted_by = null,
      archived_at = null, archived_by = null
  where id = p_client_id and org_id = p_org_id and archived_at is not null;
  get diagnostics v_client = row_count;

  -- Also restore related jobs
  update public.jobs
  set deleted_at = null, deleted_by = null,
      archived_at = null, archived_by = null
  where client_id = p_client_id and org_id = p_org_id and archived_at is not null;
  get diagnostics v_jobs = row_count;

  return jsonb_build_object('client', v_client, 'jobs', v_jobs);
end;
$$;

-- ── Restore lead ──────────────────────────────────────────────
create or replace function public.restore_lead(p_org_id uuid, p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lead integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can restore leads' using errcode = '42501';
  end if;

  update public.leads
  set deleted_at = null, deleted_by = null,
      archived_at = null, archived_by = null
  where id = p_lead_id and org_id = p_org_id and archived_at is not null;
  get diagnostics v_lead = row_count;

  -- Also restore the pipeline deal
  update public.pipeline_deals
  set deleted_at = null,
      archived_at = null, archived_by = null
  where lead_id = p_lead_id and org_id = p_org_id and archived_at is not null;

  return jsonb_build_object('lead', v_lead);
end;
$$;

-- ── Restore job ───────────────────────────────────────────────
create or replace function public.restore_job(p_org_id uuid, p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can restore jobs' using errcode = '42501';
  end if;

  update public.jobs
  set deleted_at = null, deleted_by = null,
      archived_at = null, archived_by = null
  where id = p_job_id and org_id = p_org_id and archived_at is not null;
  get diagnostics v_job = row_count;

  return jsonb_build_object('job', v_job);
end;
$$;

-- ── List archived items ───────────────────────────────────────
create or replace function public.list_archived_items(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clients jsonb;
  v_leads jsonb;
  v_jobs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'type', 'client',
    'name', concat_ws(' ', c.first_name, c.last_name),
    'company', c.company,
    'email', c.email,
    'status', c.status,
    'archived_at', c.archived_at,
    'archived_by', c.archived_by
  ) order by c.archived_at desc), '[]'::jsonb)
  into v_clients
  from public.clients c
  where c.org_id = p_org_id and c.archived_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'type', 'lead',
    'name', concat_ws(' ', l.first_name, l.last_name),
    'company', l.company,
    'email', l.email,
    'status', l.status,
    'archived_at', l.archived_at,
    'archived_by', l.archived_by
  ) order by l.archived_at desc), '[]'::jsonb)
  into v_leads
  from public.leads l
  where l.org_id = p_org_id and l.archived_at is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'type', 'job',
    'name', coalesce(j.title, 'Job #' || j.job_number),
    'client_name', j.client_name,
    'status', j.status,
    'job_number', j.job_number,
    'archived_at', j.archived_at,
    'archived_by', j.archived_by
  ) order by j.archived_at desc), '[]'::jsonb)
  into v_jobs
  from public.jobs j
  where j.org_id = p_org_id and j.archived_at is not null;

  return jsonb_build_object(
    'clients', v_clients,
    'leads', v_leads,
    'jobs', v_jobs
  );
end;
$$;

-- ── Grant permissions ─────────────────────────────────────────
revoke all on function public.archive_client(uuid, uuid) from public;
revoke all on function public.restore_client(uuid, uuid) from public;
revoke all on function public.restore_lead(uuid, uuid) from public;
revoke all on function public.restore_job(uuid, uuid) from public;
revoke all on function public.list_archived_items(uuid) from public;

grant execute on function public.archive_client(uuid, uuid) to authenticated, service_role;
grant execute on function public.restore_client(uuid, uuid) to authenticated, service_role;
grant execute on function public.restore_lead(uuid, uuid) to authenticated, service_role;
grant execute on function public.restore_job(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_archived_items(uuid) to authenticated, service_role;

-- ── Backfill: set archived_at for existing soft-deleted records ─
update public.clients set archived_at = deleted_at, archived_by = deleted_by
where deleted_at is not null and archived_at is null;

update public.leads set archived_at = deleted_at, archived_by = deleted_by
where deleted_at is not null and archived_at is null;

update public.jobs set archived_at = deleted_at, archived_by = deleted_by
where deleted_at is not null and archived_at is null;

commit;
