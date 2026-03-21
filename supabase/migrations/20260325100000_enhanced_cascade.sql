/* ═══════════════════════════════════════════════════════════════
   Migration — Enhanced Archive/Delete Cascade
   - archive_client: also cancels pending automations, archives tasks, logs activity
   - soft_delete_client: enhanced with full cascade + activity log
   ═══════════════════════════════════════════════════════════════ */

-- ── Enhanced archive_client ──────────────────────────────────

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
  v_tasks integer := 0;
  v_automations integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can archive clients' using errcode = '42501';
  end if;

  -- Archive client
  update public.clients
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid
  where id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_client = row_count;

  -- Archive jobs
  update public.jobs
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid
  where client_id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_jobs = row_count;

  -- Archive leads
  update public.leads
  set deleted_at = now(), deleted_by = v_uid,
      archived_at = now(), archived_by = v_uid,
      status = 'archived'
  where org_id = p_org_id and deleted_at is null
    and (converted_to_client_id = p_client_id);
  get diagnostics v_leads = row_count;

  -- Archive pipeline deals
  update public.pipeline_deals pd
  set deleted_at = now(),
      archived_at = now(), archived_by = v_uid
  from public.leads l
  where pd.lead_id = l.id
    and l.converted_to_client_id = p_client_id
    and l.org_id = p_org_id
    and pd.deleted_at is null;

  -- Archive tasks linked to this client
  update public.tasks
  set status = 'cancelled'
  where org_id = p_org_id
    and entity_type = 'client'
    and entity_id = p_client_id
    and status in ('pending', 'in_progress');
  get diagnostics v_tasks = row_count;

  -- Cancel pending automation scheduled tasks for this client
  update public.automation_scheduled_tasks
  set status = 'cancelled', completed_at = now()
  where org_id = p_org_id
    and entity_type = 'client'
    and entity_id = p_client_id
    and status = 'pending';
  get diagnostics v_automations = row_count;

  -- Also cancel automation tasks for jobs of this client
  update public.automation_scheduled_tasks ast
  set status = 'cancelled', completed_at = now()
  from public.jobs j
  where ast.entity_type = 'job'
    and ast.entity_id = j.id
    and j.client_id = p_client_id
    and j.org_id = p_org_id
    and ast.status = 'pending';

  -- Also cancel automation tasks for invoices of this client
  update public.automation_scheduled_tasks ast
  set status = 'cancelled', completed_at = now()
  from public.invoices i
  where ast.entity_type = 'invoice'
    and ast.entity_id = i.id
    and i.client_id = p_client_id
    and i.org_id = p_org_id
    and ast.status = 'pending';

  -- Log activity
  insert into public.activity_log (org_id, entity_type, entity_id, event_type, actor_id, metadata)
  values (
    p_org_id, 'client', p_client_id, 'client_archived', v_uid,
    jsonb_build_object('jobs_archived', v_jobs, 'leads_archived', v_leads, 'tasks_cancelled', v_tasks, 'automations_cancelled', v_automations)
  );

  return jsonb_build_object(
    'client', v_client,
    'jobs', v_jobs,
    'leads', v_leads,
    'tasks', v_tasks,
    'automations', v_automations
  );
end;
$$;

-- ── Enhanced soft_delete_client ──────────────────────────────

create or replace function public.soft_delete_client(p_org_id uuid, p_client_id uuid)
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
  v_pipeline integer := 0;
  v_invoices integer := 0;
  v_tasks integer := 0;
  v_schedule integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.has_org_admin_role(v_uid, p_org_id) then
    raise exception 'Only owner/admin can delete clients' using errcode = '42501';
  end if;

  -- Soft delete client
  update public.clients
  set deleted_at = now(), deleted_by = v_uid
  where id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_client = row_count;

  if v_client = 0 then
    raise exception 'Client not found or already deleted' using errcode = 'P0002';
  end if;

  -- Soft delete jobs
  update public.jobs
  set deleted_at = now(), deleted_by = v_uid
  where client_id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_jobs = row_count;

  -- Soft delete leads
  update public.leads
  set deleted_at = now(), deleted_by = v_uid, status = 'archived'
  where org_id = p_org_id and deleted_at is null
    and converted_to_client_id = p_client_id;
  get diagnostics v_leads = row_count;

  -- Soft delete pipeline deals via leads
  update public.pipeline_deals pd
  set deleted_at = now()
  from public.leads l
  where pd.lead_id = l.id
    and l.converted_to_client_id = p_client_id
    and l.org_id = p_org_id
    and pd.deleted_at is null;
  get diagnostics v_pipeline = row_count;

  -- Soft delete invoices
  update public.invoices
  set deleted_at = now()
  where client_id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_invoices = row_count;

  -- Cancel tasks
  update public.tasks
  set status = 'cancelled'
  where org_id = p_org_id
    and entity_type = 'client' and entity_id = p_client_id
    and status in ('pending', 'in_progress');
  get diagnostics v_tasks = row_count;

  -- Cancel schedule events
  update public.schedule_events
  set deleted_at = now()
  where client_id = p_client_id and org_id = p_org_id and deleted_at is null;
  get diagnostics v_schedule = row_count;

  -- Cancel pending automation tasks
  update public.automation_scheduled_tasks
  set status = 'cancelled', completed_at = now()
  where org_id = p_org_id
    and entity_type = 'client' and entity_id = p_client_id
    and status = 'pending';

  -- Log activity
  insert into public.activity_log (org_id, entity_type, entity_id, event_type, actor_id, metadata)
  values (
    p_org_id, 'client', p_client_id, 'client_deleted', v_uid,
    jsonb_build_object('jobs', v_jobs, 'leads', v_leads, 'invoices', v_invoices, 'tasks', v_tasks, 'schedule_events', v_schedule)
  );

  return jsonb_build_object(
    'client', v_client,
    'jobs', v_jobs,
    'leads', v_leads,
    'pipeline_deals', v_pipeline,
    'invoices', v_invoices,
    'tasks', v_tasks,
    'schedule_events', v_schedule
  );
end;
$$;
