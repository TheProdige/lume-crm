/* ═══════════════════════════════════════════════════════════════
   Migration — Leads ↔ Clients Synchronization

   Goal: Every lead MUST have a linked client (client_id).
   - clients = authoritative identity source
   - leads = sales/pipeline extension of a client
   - jobs.client_id → clients.id (always)

   Changes:
   1. Add client_id column to leads (FK → clients)
   2. Backfill: create missing clients for orphan leads
   3. Add NOT NULL constraint after backfill
   4. Trigger: auto-sync lead changes → client
   5. Trigger: cascade client delete → lead delete
   6. Update soft_delete_client to cascade via client_id
   7. RPC helpers for frontend
   ═══════════════════════════════════════════════════════════════ */

-- ═══════════════════════════════════════════════════════════════
-- 1. ADD client_id COLUMN TO LEADS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id) WHERE client_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. BACKFILL: Create clients for leads that have no client_id
--    and no converted_to_client_id. Link existing converted ones.
-- ═══════════════════════════════════════════════════════════════

-- Step 2a: For leads that already have converted_to_client_id, copy it to client_id
UPDATE public.leads
SET client_id = converted_to_client_id
WHERE converted_to_client_id IS NOT NULL
  AND client_id IS NULL;

-- Step 2b: For leads without any client link, create a client record
-- Use a DO block for procedural logic
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
  v_existing_client_id uuid;
BEGIN
  FOR r IN
    SELECT id, org_id, created_by, first_name, last_name, email, phone, address, company
    FROM public.leads
    WHERE client_id IS NULL
      AND converted_to_client_id IS NULL
      AND deleted_at IS NULL
  LOOP
    v_existing_client_id := NULL;

    -- Try to find existing client by email (same org, not deleted)
    IF r.email IS NOT NULL AND trim(r.email) != '' THEN
      SELECT c.id INTO v_existing_client_id
      FROM public.clients c
      WHERE c.org_id = r.org_id
        AND lower(trim(c.email)) = lower(trim(r.email))
        AND c.deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_existing_client_id IS NOT NULL THEN
      -- Link to existing client
      UPDATE public.leads SET client_id = v_existing_client_id, converted_to_client_id = v_existing_client_id WHERE id = r.id;
    ELSE
      -- Create new client
      INSERT INTO public.clients (org_id, created_by, first_name, last_name, email, phone, address, company, status)
      VALUES (r.org_id, r.created_by, COALESCE(r.first_name, ''), COALESCE(r.last_name, ''), r.email, r.phone, r.address, r.company, 'lead')
      RETURNING id INTO v_client_id;

      UPDATE public.leads SET client_id = v_client_id, converted_to_client_id = v_client_id WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Step 2c: Also backfill soft-deleted leads (for referential integrity)
-- Only process leads whose org still exists (orphan orgs = skip)
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
BEGIN
  FOR r IN
    SELECT l.id, l.org_id, l.created_by, l.first_name, l.last_name, l.email, l.phone, l.address, l.company, l.converted_to_client_id
    FROM public.leads l
    INNER JOIN public.orgs o ON o.id = l.org_id
    WHERE l.client_id IS NULL
      AND l.deleted_at IS NOT NULL
  LOOP
    IF r.converted_to_client_id IS NOT NULL THEN
      UPDATE public.leads SET client_id = r.converted_to_client_id WHERE id = r.id;
    ELSE
      -- Create a placeholder client for orphan deleted leads
      INSERT INTO public.clients (org_id, created_by, first_name, last_name, email, phone, address, company, status, deleted_at)
      VALUES (r.org_id, r.created_by, COALESCE(r.first_name, ''), COALESCE(r.last_name, ''), r.email, r.phone, r.address, r.company, 'lead', now())
      RETURNING id INTO v_client_id;

      UPDATE public.leads SET client_id = v_client_id, converted_to_client_id = v_client_id WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Step 2d: Backfill jobs that have lead_id but no client_id
UPDATE public.jobs j
SET client_id = l.client_id
FROM public.leads l
WHERE j.lead_id = l.id
  AND j.client_id IS NULL
  AND l.client_id IS NOT NULL;

-- Step 2e: Now make client_id NOT NULL (all rows should be filled)
-- Remove soft-deleted leads that still have no client_id
-- (orphan org, corrupted data, etc. — safe to hard-delete since already soft-deleted)
DELETE FROM public.leads WHERE client_id IS NULL AND deleted_at IS NOT NULL;
-- Also remove leads whose org no longer exists (can't create clients for them)
DELETE FROM public.leads
WHERE client_id IS NULL
  AND org_id NOT IN (SELECT id FROM public.orgs);

-- For active leads still missing client_id, create a fallback
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
BEGIN
  FOR r IN
    SELECT id, org_id, created_by, first_name, last_name, email, phone, address, company
    FROM public.leads
    WHERE client_id IS NULL
  LOOP
    INSERT INTO public.clients (org_id, created_by, first_name, last_name, email, phone, address, company, status)
    VALUES (r.org_id, r.created_by, COALESCE(r.first_name, ''), COALESCE(r.last_name, ''), r.email, r.phone, r.address, r.company, 'lead')
    RETURNING id INTO v_client_id;

    UPDATE public.leads SET client_id = v_client_id, converted_to_client_id = v_client_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- Now enforce NOT NULL
ALTER TABLE public.leads ALTER COLUMN client_id SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. TRIGGER: Auto-sync lead data → linked client
--    When a lead's name/email/phone/address changes, update the client
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_lead_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Only sync if key identity fields changed
  IF (
    NEW.first_name IS DISTINCT FROM OLD.first_name OR
    NEW.last_name IS DISTINCT FROM OLD.last_name OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.phone IS DISTINCT FROM OLD.phone OR
    NEW.address IS DISTINCT FROM OLD.address OR
    NEW.company IS DISTINCT FROM OLD.company
  ) THEN
    UPDATE public.clients
    SET
      first_name = NEW.first_name,
      last_name = NEW.last_name,
      email = COALESCE(NEW.email, email),
      phone = COALESCE(NEW.phone, phone),
      address = COALESCE(NEW.address, address),
      company = COALESCE(NEW.company, company),
      updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_lead_to_client ON public.leads;
CREATE TRIGGER trg_sync_lead_to_client
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.client_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_lead_to_client();

-- ═══════════════════════════════════════════════════════════════
-- 4. TRIGGER: When client is soft-deleted, also soft-delete linked leads
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cascade_client_delete_to_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Only fire when deleted_at transitions from NULL to non-NULL (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Soft-delete all leads linked to this client
    UPDATE public.leads
    SET deleted_at = NEW.deleted_at,
        status = 'archived',
        updated_at = now()
    WHERE client_id = NEW.id
      AND deleted_at IS NULL;

    -- Also soft-delete their pipeline deals
    UPDATE public.pipeline_deals pd
    SET deleted_at = NEW.deleted_at,
        updated_at = now()
    FROM public.leads l
    WHERE pd.lead_id = l.id
      AND l.client_id = NEW.id
      AND pd.deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cascade_client_delete_to_leads ON public.clients;
CREATE TRIGGER trg_cascade_client_delete_to_leads
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_client_delete_to_leads();

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC: ensure_client_for_lead
--    Called when creating a lead — finds or creates the linked client
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ensure_client_for_lead(
  p_org_id uuid,
  p_created_by uuid,
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
BEGIN
  -- Try to find existing active client by email in the same org
  IF p_email IS NOT NULL AND trim(p_email) != '' THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE org_id = p_org_id
      AND lower(trim(email)) = lower(trim(p_email))
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_client_id IS NOT NULL THEN
    RETURN v_client_id;
  END IF;

  -- Create new client with status 'lead'
  INSERT INTO public.clients (
    org_id, created_by, first_name, last_name, email, phone, address, company, status
  ) VALUES (
    p_org_id, p_created_by,
    COALESCE(trim(p_first_name), ''),
    COALESCE(trim(p_last_name), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_company, '')), ''),
    'lead'
  )
  RETURNING id INTO v_client_id;

  RETURN v_client_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.ensure_client_for_lead(uuid, uuid, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_client_for_lead(uuid, uuid, text, text, text, text, text, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 6. RPC: resolve_client_id_for_lead
--    Given a lead_id, return the client_id (for job creation)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_client_id_for_lead(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.leads
  WHERE id = p_lead_id
    AND deleted_at IS NULL;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Lead % has no linked client', p_lead_id;
  END IF;

  RETURN v_client_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_client_id_for_lead(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_client_id_for_lead(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 7. Update soft_delete_client to use client_id on leads
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.soft_delete_client(p_org_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_now timestamptz := now();
  v_client integer := 0;
  v_jobs integer := 0;
  v_leads integer := 0;
  v_pipeline_deals integer := 0;
BEGIN
  -- Permission check
  IF v_uid = '00000000-0000-0000-0000-000000000000'::uuid THEN
    -- service_role call — allow
    NULL;
  ELSIF NOT public.has_org_admin_role(v_uid, p_org_id) THEN
    RAISE EXCEPTION 'Only owner/admin can delete clients' USING errcode = '42501';
  END IF;

  -- Soft-delete the client
  UPDATE public.clients
  SET deleted_at = v_now, updated_at = v_now
  WHERE id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_client = ROW_COUNT;

  -- Soft-delete linked jobs
  UPDATE public.jobs
  SET deleted_at = v_now, updated_at = v_now
  WHERE client_id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  -- Soft-delete linked leads (via client_id)
  UPDATE public.leads
  SET deleted_at = v_now, updated_at = v_now, status = 'archived'
  WHERE client_id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  -- Also catch leads linked via converted_to_client_id (legacy)
  UPDATE public.leads
  SET deleted_at = v_now, updated_at = v_now, status = 'archived'
  WHERE converted_to_client_id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL AND client_id != p_client_id;

  -- Soft-delete pipeline deals for those leads
  UPDATE public.pipeline_deals pd
  SET deleted_at = v_now, updated_at = v_now
  FROM public.leads l
  WHERE pd.lead_id = l.id
    AND (l.client_id = p_client_id OR l.converted_to_client_id = p_client_id)
    AND pd.org_id = p_org_id
    AND pd.deleted_at IS NULL;
  GET DIAGNOSTICS v_pipeline_deals = ROW_COUNT;

  RETURN jsonb_build_object(
    'client', v_client,
    'jobs', v_jobs,
    'leads', v_leads,
    'pipeline_deals', v_pipeline_deals,
    'other_rows', 0
  );
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════
-- 8. Update archive_client to use client_id
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.archive_client(p_org_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_client integer := 0;
  v_jobs integer := 0;
  v_leads integer := 0;
  v_tasks integer := 0;
  v_automations integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;
  IF NOT public.has_org_admin_role(v_uid, p_org_id) THEN
    RAISE EXCEPTION 'Only owner/admin can archive clients' USING errcode = '42501';
  END IF;

  -- Archive client
  UPDATE public.clients
  SET deleted_at = v_now, updated_at = v_now
  WHERE id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_client = ROW_COUNT;

  -- Archive jobs
  UPDATE public.jobs
  SET deleted_at = v_now, updated_at = v_now
  WHERE client_id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  -- Archive leads (via client_id — the new authoritative link)
  UPDATE public.leads
  SET deleted_at = v_now, updated_at = v_now, status = 'archived'
  WHERE client_id = p_client_id AND org_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  -- Archive pipeline deals linked to those leads
  UPDATE public.pipeline_deals pd
  SET deleted_at = v_now, updated_at = v_now
  FROM public.leads l
  WHERE pd.lead_id = l.id
    AND l.client_id = p_client_id
    AND l.org_id = p_org_id
    AND pd.deleted_at IS NULL;

  -- Cancel tasks for this client
  UPDATE public.tasks
  SET status = 'cancelled'
  WHERE org_id = p_org_id
    AND entity_type = 'client'
    AND entity_id = p_client_id
    AND status IN ('pending', 'in_progress');
  GET DIAGNOSTICS v_tasks = ROW_COUNT;

  -- Cancel pending automations
  UPDATE public.automation_scheduled_tasks
  SET status = 'cancelled', completed_at = v_now
  WHERE org_id = p_org_id
    AND entity_type = 'client'
    AND entity_id = p_client_id
    AND status = 'pending';
  GET DIAGNOSTICS v_automations = ROW_COUNT;

  RETURN jsonb_build_object(
    'client', v_client,
    'jobs', v_jobs,
    'leads', v_leads,
    'tasks', v_tasks,
    'automations', v_automations
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 9. Update delete_client_cascade to use client_id
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_client_cascade(
  p_org_id uuid,
  p_client_id uuid,
  p_deleted_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := coalesce(p_deleted_by, auth.uid());
  v_client integer := 0;
  v_jobs integer := 0;
  v_leads integer := 0;
  v_pipeline_deals integer := 0;
  v_invoices integer := 0;
  v_invoice_items integer := 0;
  v_payments integer := 0;
  v_schedule_events integer := 0;
  v_job_line_items integer := 0;
BEGIN
  -- Delete schedule events for client's jobs
  DELETE FROM public.schedule_events
  WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = p_client_id AND org_id = p_org_id);
  GET DIAGNOSTICS v_schedule_events = ROW_COUNT;

  -- Delete job line items
  DELETE FROM public.job_line_items
  WHERE job_id IN (SELECT id FROM public.jobs WHERE client_id = p_client_id AND org_id = p_org_id);
  GET DIAGNOSTICS v_job_line_items = ROW_COUNT;

  -- Delete payments
  DELETE FROM public.payments
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE client_id = p_client_id AND org_id = p_org_id);
  GET DIAGNOSTICS v_payments = ROW_COUNT;

  -- Delete invoice items
  DELETE FROM public.invoice_items
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE client_id = p_client_id AND org_id = p_org_id);
  GET DIAGNOSTICS v_invoice_items = ROW_COUNT;

  -- Delete invoices
  DELETE FROM public.invoices WHERE client_id = p_client_id AND org_id = p_org_id;
  GET DIAGNOSTICS v_invoices = ROW_COUNT;

  -- Delete pipeline deals for leads linked to this client
  DELETE FROM public.pipeline_deals
  WHERE lead_id IN (SELECT id FROM public.leads WHERE client_id = p_client_id AND org_id = p_org_id);
  GET DIAGNOSTICS v_pipeline_deals = ROW_COUNT;

  -- Delete leads (via client_id)
  DELETE FROM public.leads WHERE client_id = p_client_id AND org_id = p_org_id;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  -- Delete jobs
  DELETE FROM public.jobs WHERE client_id = p_client_id AND org_id = p_org_id;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  -- Delete client
  DELETE FROM public.clients WHERE id = p_client_id AND org_id = p_org_id;
  GET DIAGNOSTICS v_client = ROW_COUNT;

  RETURN jsonb_build_object(
    'client', v_client,
    'jobs', v_jobs,
    'leads', v_leads,
    'pipeline_deals', v_pipeline_deals,
    'invoices', v_invoices,
    'invoice_items', v_invoice_items,
    'payments', v_payments,
    'schedule_events', v_schedule_events,
    'job_line_items', v_job_line_items
  );
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════
-- 10. Update create_job_from_intent to always resolve client_id
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_job_from_intent(
  p_intent_id uuid,
  p_lead_id uuid,
  p_title text,
  p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_estimated_minutes integer DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_timezone text DEFAULT 'America/Montreal',
  p_force_create_another boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_intent public.job_intents%rowtype;
  v_lead public.leads%rowtype;
  v_client_id uuid;
  v_job_id uuid;
  v_end_at timestamptz;
  v_status text;
BEGIN
  -- Validate intent
  SELECT * INTO v_intent
  FROM public.job_intents
  WHERE id = p_intent_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'Intent not found';
  END IF;

  IF v_intent.status != 'pending' AND NOT p_force_create_another THEN
    RAISE EXCEPTION 'Intent already consumed';
  END IF;

  -- Get lead
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  -- Resolve client_id — ALWAYS use client_id from lead
  v_client_id := v_lead.client_id;
  IF v_client_id IS NULL THEN
    v_client_id := v_lead.converted_to_client_id;
  END IF;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Lead has no linked client. Cannot create job.';
  END IF;

  -- Calculate end time
  v_end_at := NULL;
  IF p_start_at IS NOT NULL AND p_estimated_minutes IS NOT NULL THEN
    v_end_at := p_start_at + (p_estimated_minutes || ' minutes')::interval;
  END IF;

  v_status := CASE WHEN p_start_at IS NOT NULL THEN 'scheduled' ELSE 'draft' END;

  -- Create job
  INSERT INTO public.jobs (
    org_id, created_by, client_id, lead_id, title, property_address, notes,
    scheduled_at, end_at, status
  ) VALUES (
    v_lead.org_id, v_uid, v_client_id, v_lead.id,
    COALESCE(NULLIF(trim(p_title), ''), 'New Job'),
    COALESCE(NULLIF(trim(p_address), ''), v_lead.address, ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    p_start_at, v_end_at, v_status
  )
  RETURNING id INTO v_job_id;

  -- Create schedule event if scheduled
  IF p_start_at IS NOT NULL AND v_end_at IS NOT NULL THEN
    INSERT INTO public.schedule_events (
      org_id, created_by, job_id, start_time, end_time, timezone, status
    ) VALUES (
      v_lead.org_id, v_uid, v_job_id, p_start_at, v_end_at,
      COALESCE(p_timezone, 'America/Montreal'), 'scheduled'
    );
  END IF;

  -- Consume intent
  UPDATE public.job_intents
  SET status = 'consumed', consumed_at = now()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object(
    'job_id', v_job_id,
    'client_id', v_client_id,
    'lead_id', v_lead.id,
    'status', v_status
  );
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════
-- 11. Update clients_active view to include is_lead flag
-- ═══════════════════════════════════════════════════════════════

-- First check if it's a view or table
DO $$
BEGIN
  -- Drop old view if exists, recreate with lead flag
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'clients_active' AND schemaname = 'public') THEN
    DROP VIEW IF EXISTS public.clients_active;
    CREATE VIEW public.clients_active AS
    SELECT c.*,
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.client_id = c.id AND l.deleted_at IS NULL
      ) AS is_lead
    FROM public.clients c
    WHERE c.deleted_at IS NULL;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 12. RPC: create_lead_with_client
--     Bypasses PostgREST column cache — inserts lead + links client in one call
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_lead_with_client(
  p_org_id uuid,
  p_created_by uuid,
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_value numeric DEFAULT 0,
  p_status text DEFAULT 'new'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lead_id uuid;
BEGIN
  INSERT INTO public.leads (
    org_id, created_by, client_id, converted_to_client_id,
    first_name, last_name, email, phone, address, title, company, notes, value, status
  ) VALUES (
    p_org_id, p_created_by, p_client_id, p_client_id,
    COALESCE(trim(p_first_name), ''),
    COALESCE(trim(p_last_name), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_title, '')), ''),
    NULLIF(trim(COALESCE(p_company, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    COALESCE(p_value, 0),
    COALESCE(p_status, 'new')
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_lead_with_client(uuid, uuid, uuid, text, text, text, text, text, text, text, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_lead_with_client(uuid, uuid, uuid, text, text, text, text, text, text, text, text, numeric, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 13. Reload PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
