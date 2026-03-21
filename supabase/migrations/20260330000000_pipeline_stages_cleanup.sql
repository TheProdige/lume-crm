-- ============================================================
-- Migration: Pipeline stages cleanup
-- New stages: new, follow_up_1, follow_up_2, follow_up_3, closed, lost
-- Old stages removed: contacted, estimate_sent, follow_up, won, qualified, contact, quote_sent, archived
-- ============================================================

BEGIN;

-- ── 1. Migrate pipeline_deals.stage to new values ────────────

-- Legacy display-name values → new DB slugs
UPDATE public.pipeline_deals SET stage = 'new'          WHERE lower(trim(stage)) IN ('new', 'qualified');
UPDATE public.pipeline_deals SET stage = 'follow_up_1'  WHERE lower(trim(stage)) IN ('contacted', 'contact', 'follow-up', 'follow_up');
UPDATE public.pipeline_deals SET stage = 'follow_up_2'  WHERE lower(trim(stage)) IN ('estimate sent', 'estimate_sent', 'quote sent', 'quote_sent');
-- follow_up_3 has no legacy equivalent; skip
UPDATE public.pipeline_deals SET stage = 'closed'       WHERE lower(trim(stage)) IN ('closed', 'won');
UPDATE public.pipeline_deals SET stage = 'lost'         WHERE lower(trim(stage)) IN ('lost', 'archived');

-- Catch-all: any remaining invalid stages → new
UPDATE public.pipeline_deals
SET stage = 'new'
WHERE stage NOT IN ('new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost');

-- ── 2. Migrate leads.status to new values ─────────────────────

UPDATE public.leads SET status = 'new'          WHERE lower(trim(status)) IN ('new', 'qualified', 'lead');
UPDATE public.leads SET status = 'follow_up_1'  WHERE lower(trim(status)) IN ('contacted', 'contact', 'follow_up', 'follow-up', 'proposal', 'negotiation');
UPDATE public.leads SET status = 'follow_up_2'  WHERE lower(trim(status)) IN ('estimate_sent', 'quote_sent');
-- follow_up_3 has no legacy equivalent; skip
UPDATE public.leads SET status = 'closed'       WHERE lower(trim(status)) IN ('closed', 'won');
UPDATE public.leads SET status = 'lost'         WHERE lower(trim(status)) IN ('lost', 'archived');

-- Catch-all: any remaining invalid statuses → new
UPDATE public.leads
SET status = 'new'
WHERE status NOT IN ('new', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'closed', 'lost');

-- ── 3. Recreate set_deal_stage() with new stages ─────────────

CREATE OR REPLACE FUNCTION public.set_deal_stage(
  p_deal_id uuid,
  p_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_deal public.pipeline_deals%rowtype;
  v_stage text;
BEGIN
  v_stage := CASE lower(trim(p_stage))
    WHEN 'new'          THEN 'new'
    WHEN 'follow_up_1'  THEN 'follow_up_1'
    WHEN 'follow_up_2'  THEN 'follow_up_2'
    WHEN 'follow_up_3'  THEN 'follow_up_3'
    WHEN 'closed'       THEN 'closed'
    WHEN 'lost'         THEN 'lost'
    -- Legacy values that might still come through
    WHEN 'contacted'     THEN 'follow_up_1'
    WHEN 'contact'       THEN 'follow_up_1'
    WHEN 'estimate_sent' THEN 'follow_up_2'
    WHEN 'estimate sent' THEN 'follow_up_2'
    WHEN 'quote_sent'    THEN 'follow_up_2'
    WHEN 'follow_up'     THEN 'follow_up_1'
    WHEN 'follow-up'     THEN 'follow_up_1'
    WHEN 'won'           THEN 'closed'
    WHEN 'qualified'     THEN 'new'
    WHEN 'archived'      THEN 'lost'
    ELSE NULL
  END;

  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Invalid stage: %', p_stage;
  END IF;

  SELECT * INTO v_deal
  FROM public.pipeline_deals
  WHERE id = p_deal_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_deal.id IS NULL THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  UPDATE public.pipeline_deals
  SET stage = v_stage,
      lost_at = CASE
        WHEN v_stage = 'lost' THEN now()
        WHEN coalesce(v_deal.lost_at, NULL) IS NOT NULL THEN NULL
        ELSE lost_at
      END,
      updated_at = now()
  WHERE id = v_deal.id;

  RETURN (
    SELECT jsonb_build_object(
      'id', pd.id,
      'stage', pd.stage,
      'lost_at', pd.lost_at,
      'updated_at', pd.updated_at
    )
    FROM public.pipeline_deals pd
    WHERE pd.id = v_deal.id
  );
END;
$fn$;

-- ── 4. Recreate create_pipeline_deal() with new stages ───────

CREATE OR REPLACE FUNCTION public.create_pipeline_deal(
  p_lead_id uuid,
  p_title text,
  p_value numeric,
  p_stage text DEFAULT 'new',
  p_notes text DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lead public.leads%rowtype;
  v_stage text;
  v_deal_id uuid;
BEGIN
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  v_stage := CASE lower(trim(coalesce(p_stage, '')))
    WHEN 'new'          THEN 'new'
    WHEN 'follow_up_1'  THEN 'follow_up_1'
    WHEN 'follow_up_2'  THEN 'follow_up_2'
    WHEN 'follow_up_3'  THEN 'follow_up_3'
    WHEN 'closed'       THEN 'closed'
    WHEN 'lost'         THEN 'lost'
    -- Legacy values
    WHEN 'contacted'     THEN 'follow_up_1'
    WHEN 'contact'       THEN 'follow_up_1'
    WHEN 'estimate_sent' THEN 'follow_up_2'
    WHEN 'quote_sent'    THEN 'follow_up_2'
    WHEN 'follow_up'     THEN 'follow_up_1'
    WHEN 'won'           THEN 'closed'
    WHEN 'qualified'     THEN 'new'
    ELSE 'new'
  END;

  INSERT INTO public.pipeline_deals (
    org_id, created_by, lead_id, client_id, stage, value, title, notes, lost_at
  )
  VALUES (
    coalesce(v_lead.org_id, public.current_org_id()),
    coalesce(auth.uid(), v_lead.created_by),
    v_lead.id,
    v_lead.converted_to_client_id,
    v_stage,
    coalesce(p_value, 0),
    coalesce(nullif(trim(p_title), ''), 'New deal'),
    nullif(trim(p_notes), ''),
    CASE WHEN v_stage = 'lost' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_pipeline_deal(uuid, text, numeric, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_pipeline_deal(uuid, text, numeric, text, text, uuid) TO authenticated, service_role;

COMMIT;
