/* ═══════════════════════════════════════════════════════════════
   Migration — Auto-log activity via database triggers.
   For entities created/updated directly via Supabase client (not API).
   ═══════════════════════════════════════════════════════════════ */

-- ── Log when a schedule_event (appointment) is created ───────

create or replace function public.log_appointment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (org_id, entity_type, entity_id, event_type, actor_id, metadata)
  values (
    new.org_id,
    'schedule_event',
    new.id,
    'appointment_created',
    coalesce(new.created_by, auth.uid()),
    jsonb_build_object(
      'title', coalesce(new.title, ''),
      'start_time', coalesce(new.start_time::text, ''),
      'client_id', coalesce(new.client_id::text, '')
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_log_appointment_created on public.schedule_events;
create trigger trg_log_appointment_created
  after insert on public.schedule_events
  for each row execute function public.log_appointment_created();

-- ── Log when a job status changes to completed ───────────────

create or replace function public.log_job_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    -- Log any status change
    insert into public.activity_log (org_id, entity_type, entity_id, event_type, actor_id, metadata)
    values (
      new.org_id,
      'job',
      new.id,
      case when new.status = 'completed' then 'job_completed' else 'status_changed' end,
      auth.uid(),
      jsonb_build_object('old_status', coalesce(old.status, ''), 'new_status', coalesce(new.status, ''), 'title', coalesce(new.title, ''))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_job_status_change on public.jobs;
create trigger trg_log_job_status_change
  after update on public.jobs
  for each row execute function public.log_job_completed();

-- ── Log when an invoice is created ───────────────────────────

create or replace function public.log_invoice_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (org_id, entity_type, entity_id, event_type, actor_id, metadata)
  values (
    new.org_id,
    'invoice',
    new.id,
    'invoice_created',
    auth.uid(),
    jsonb_build_object('invoice_number', coalesce(new.invoice_number, ''), 'total_cents', coalesce(new.total_cents, 0))
  );
  return new;
end;
$$;

drop trigger if exists trg_log_invoice_created on public.invoices;
create trigger trg_log_invoice_created
  after insert on public.invoices
  for each row execute function public.log_invoice_created();
