/* ═══════════════════════════════════════════════════════════════
   Migration — Deduplicate automation rule presets & add UNIQUE constraint.

   Problem: seed_automation_presets() used ON CONFLICT DO NOTHING but
   there was NO unique constraint on (org_id, preset_key), so every
   call created new duplicate rows.

   Fix:
   1. Delete duplicate preset rows (keep the newest per org+preset_key)
   2. Add a partial UNIQUE index on (org_id, preset_key) WHERE preset_key IS NOT NULL
   3. Rewrite seed_automation_presets() to use ON CONFLICT … DO UPDATE
   ═══════════════════════════════════════════════════════════════ */

-- ═══════════════════════════════════════════════════════════════
-- 1. CLEANUP: Remove duplicate presets, keeping the newest per (org_id, preset_key)
-- ═══════════════════════════════════════════════════════════════

-- First, reassign any execution logs / scheduled tasks from duplicates
-- to the kept row (newest by created_at) so we don't lose history.
WITH kept AS (
  SELECT DISTINCT ON (org_id, preset_key)
    id, org_id, preset_key
  FROM public.automation_rules
  WHERE preset_key IS NOT NULL
  ORDER BY org_id, preset_key, created_at DESC
),
dupes AS (
  SELECT ar.id AS dupe_id, k.id AS keep_id
  FROM public.automation_rules ar
  JOIN kept k ON k.org_id = ar.org_id AND k.preset_key = ar.preset_key
  WHERE ar.preset_key IS NOT NULL
    AND ar.id <> k.id
)
UPDATE public.automation_execution_logs el
SET automation_rule_id = d.keep_id
FROM dupes d
WHERE el.automation_rule_id = d.dupe_id;

-- Reassign scheduled tasks
WITH kept AS (
  SELECT DISTINCT ON (org_id, preset_key)
    id, org_id, preset_key
  FROM public.automation_rules
  WHERE preset_key IS NOT NULL
  ORDER BY org_id, preset_key, created_at DESC
),
dupes AS (
  SELECT ar.id AS dupe_id, k.id AS keep_id
  FROM public.automation_rules ar
  JOIN kept k ON k.org_id = ar.org_id AND k.preset_key = ar.preset_key
  WHERE ar.preset_key IS NOT NULL
    AND ar.id <> k.id
)
UPDATE public.automation_scheduled_tasks st
SET automation_rule_id = d.keep_id
FROM dupes d
WHERE st.automation_rule_id = d.dupe_id;

-- Now delete the duplicates
WITH kept AS (
  SELECT DISTINCT ON (org_id, preset_key)
    id
  FROM public.automation_rules
  WHERE preset_key IS NOT NULL
  ORDER BY org_id, preset_key, created_at DESC
)
DELETE FROM public.automation_rules
WHERE preset_key IS NOT NULL
  AND id NOT IN (SELECT id FROM kept);

-- ═══════════════════════════════════════════════════════════════
-- 2. ADD UNIQUE CONSTRAINT (partial — only for rows with a preset_key)
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rules_org_preset
  ON public.automation_rules (org_id, preset_key)
  WHERE preset_key IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. REWRITE seed_automation_presets() — idempotent upsert
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.seed_automation_presets(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN

  -- ── 1. JOB REMINDER — 1 WEEK BEFORE ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Job Reminder — 1 Week Before',
    'Send SMS + email reminder 1 week before a scheduled job',
    'appointment.created',
    '{}'::jsonb,
    -604800,
    '[
      {"type":"send_sms","config":{"body":"Hi [client_first_name], this is a reminder that your appointment is scheduled for [appointment_date]. Reply if you have any questions. — [company_name]"}},
      {"type":"send_email","config":{"subject":"[company_name] — Appointment Reminder","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>This is a reminder that your appointment is scheduled for <strong>[appointment_date]</strong> at <strong>[appointment_time]</strong>.</p><p>If you have any questions or need to reschedule, please reply to this email or call us.</p><p>See you soon!<br/>[company_name]</p></div>"}},
      {"type":"log_activity","config":{"event_type":"reminder_sent","metadata":{"type":"job_reminder_7d"}}}
    ]'::jsonb,
    true, true, 'job_reminder_7d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 2. JOB REMINDER — 1 DAY BEFORE ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Job Reminder — 1 Day Before',
    'Send SMS + email reminder 1 day before a scheduled job',
    'appointment.created',
    '{}'::jsonb,
    -86400,
    '[
      {"type":"send_sms","config":{"body":"Reminder: your appointment is scheduled for tomorrow, [appointment_date]. Please reply if you need anything. — [company_name]"}},
      {"type":"send_email","config":{"subject":"[company_name] — Your appointment is tomorrow","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Just a reminder that your appointment is <strong>tomorrow</strong>, [appointment_date] at [appointment_time].</p><p>Please let us know if anything changes.</p><p>See you then!<br/>[company_name]</p></div>"}},
      {"type":"log_activity","config":{"event_type":"reminder_sent","metadata":{"type":"job_reminder_1d"}}}
    ]'::jsonb,
    true, true, 'job_reminder_1d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 3. QUOTE FOLLOW-UP — 1 DAY AFTER SENT ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Quote Follow-Up — 1 Day After Sent',
    'Follow up on an estimate 1 day after sending it',
    'estimate.sent',
    '{}'::jsonb,
    86400,
    '[
      {"type":"send_sms","config":{"body":"Hi [client_first_name], just following up on the quote we sent yesterday. Let us know if you have any questions! — [company_name]"}},
      {"type":"send_email","config":{"subject":"[company_name] — Following up on your estimate","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>We sent you an estimate recently and wanted to follow up.</p><p>If you have any questions or would like to proceed, please don''t hesitate to reach out.</p><p>Best regards,<br/>[company_name]</p></div>"}},
      {"type":"log_activity","config":{"event_type":"follow_up_sent","metadata":{"type":"quote_followup_1d"}}}
    ]'::jsonb,
    true, true, 'quote_followup_1d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 4. INVOICE REMINDER — 1 DAY AFTER SENT ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Invoice Reminder — 1 Day After Sent',
    'Gentle reminder 1 day after invoice is sent',
    'invoice.sent',
    '{}'::jsonb,
    86400,
    '[
      {"type":"send_email","config":{"subject":"[company_name] — Payment Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Just a friendly reminder that invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is awaiting payment.</p><p>If you''ve already sent payment, please disregard this message.</p><p>Thank you,<br/>[company_name]</p></div>"}},
      {"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_after_sent":1}}}
    ]'::jsonb,
    true, true, 'invoice_sent_reminder_1d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 5. INVOICE REMINDER — 3 DAYS AFTER SENT ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Invoice Reminder — 3 Days After Sent',
    'Follow-up reminder 3 days after invoice is sent',
    'invoice.sent',
    '{}'::jsonb,
    259200,
    '[
      {"type":"send_email","config":{"subject":"[company_name] — Payment Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>This is a reminder that invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> remains unpaid.</p><p>Please arrange payment at your earliest convenience.</p><p>Thank you,<br/>[company_name]</p></div>"}},
      {"type":"send_sms","config":{"body":"Hi [client_first_name], a reminder that invoice [invoice_number] for [invoice_total] is awaiting payment. Please let us know if you have any questions. — [company_name]"}},
      {"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_after_sent":3}}}
    ]'::jsonb,
    true, true, 'invoice_sent_reminder_3d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 6. INVOICE REMINDER — 7 DAYS AFTER SENT ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Invoice Reminder — 7 Days After Sent',
    'Stronger reminder 7 days after invoice is sent',
    'invoice.sent',
    '{}'::jsonb,
    604800,
    '[
      {"type":"send_email","config":{"subject":"[company_name] — Invoice [invoice_number] Still Unpaid","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> was sent 7 days ago and remains unpaid.</p><p>Please arrange payment as soon as possible. If you have any questions, don''t hesitate to contact us.</p><p>Thank you,<br/>[company_name]</p></div>"}},
      {"type":"send_sms","config":{"body":"Hi [client_first_name], invoice [invoice_number] for [invoice_total] is now 7 days unpaid. Please arrange payment or contact us if needed. — [company_name]"}},
      {"type":"create_notification","config":{"title":"Invoice [invoice_number] — 7 days unpaid","body":"[client_name] has not paid invoice [invoice_number] after 7 days."}},
      {"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_after_sent":7}}}
    ]'::jsonb,
    true, true, 'invoice_sent_reminder_7d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 7. INVOICE FINAL REMINDER — 30 DAYS AFTER SENT ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Invoice Final Reminder — 30 Days After Sent',
    'Final reminder 30 days after invoice is sent — requests urgent action',
    'invoice.sent',
    '{}'::jsonb,
    2592000,
    '[
      {"type":"send_email","config":{"subject":"[company_name] — Final Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is still outstanding after 30 days.</p><p>Please review and arrange payment as soon as possible. If there is an issue, please contact us so we can resolve it together.</p><p>Thank you,<br/>[company_name]</p></div>"}},
      {"type":"send_sms","config":{"body":"Hi [client_first_name], invoice [invoice_number] is still outstanding after 30 days. Please review it and contact us if anything needs clarification. — [company_name]"}},
      {"type":"create_notification","config":{"title":"Invoice [invoice_number] — 30 days outstanding","body":"[client_name] has an invoice outstanding for 30 days. Immediate follow-up required."}},
      {"type":"create_task","config":{"title":"Follow up: Invoice [invoice_number] — 30 days outstanding","description":"Client [client_name] has not paid invoice [invoice_number] after 30 days. Contact them directly."}},
      {"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_after_sent":30,"final_reminder":true}}}
    ]'::jsonb,
    true, true, 'invoice_sent_reminder_30d'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 8. GOOGLE REVIEW REQUEST ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Google Review Request',
    'Send satisfaction survey after job completion',
    'job.completed', '{}', 7200,
    '[{"type":"request_review","config":{}}]'::jsonb,
    false, true, 'google_review'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 9. APPOINTMENT CONFIRMATION ──
  INSERT INTO public.automation_rules (
    org_id, name, description, trigger_event, conditions,
    delay_seconds, actions, is_active, is_preset, preset_key
  ) VALUES (
    p_org_id,
    'Appointment Confirmation',
    'Confirm appointment immediately',
    'appointment.created', '{}', 0,
    '[{"type":"send_sms","config":{"body":"Your appointment with [company_name] is confirmed for [appointment_date] at [appointment_time]. See you there!"}},{"type":"send_email","config":{"subject":"[company_name] - Appointment Confirmed","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Your appointment is confirmed:</p><ul><li><strong>Date:</strong> [appointment_date]</li><li><strong>Time:</strong> [appointment_time]</li><li><strong>Location:</strong> [appointment_address]</li></ul><p>See you soon!<br/>[company_name]</p></div>"}}]'::jsonb,
    false, true, 'appointment_confirmation'
  ) ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        actions = EXCLUDED.actions,
        updated_at = now();
  v_count := v_count + 1;

  -- ── 10-20: Optional presets (inactive by default) ──

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Thank You — After Job Completed', 'Send thank-you message after job completion', 'job.completed', '{}', 3600,
    '[{"type":"send_sms","config":{"body":"Hi [client_first_name], thank you for choosing [company_name]! We hope you are satisfied. — [company_name]"}},{"type":"send_email","config":{"subject":"[company_name] — Thank you!","body":"<p>Hi [client_first_name],</p><p>Thank you for choosing <b>[company_name]</b>!</p><p>Best regards,<br/>[company_name]</p>"}},{"type":"log_activity","config":{"event_type":"thank_you_sent","metadata":{"type":"post_job"}}}]'::jsonb,
    false, true, 'thank_you_after_job')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Cross-Sell Follow-Up — 30 Days After Job', 'Reconnect with client 30 days after job', 'job.completed', '{}', 2592000,
    '[{"type":"send_email","config":{"subject":"[company_name] — How is everything going?","body":"<p>Hi [client_first_name],</p><p>A month since your last service. Need any additional services?</p><p>[company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], a month since your last service with [company_name]. Need anything else? We are here!"}},{"type":"log_activity","config":{"event_type":"cross_sell_sent","metadata":{"type":"30d_followup"}}}]'::jsonb,
    false, true, 'cross_sell_30d')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Welcome New Lead', 'Instant welcome message to new leads', 'lead.created', '{}', 0,
    '[{"type":"send_sms","config":{"body":"Hi [client_first_name], thank you for your interest! We will be in touch shortly. — [company_name]"}},{"type":"send_email","config":{"subject":"[company_name] — Welcome!","body":"<p>Hi [client_first_name],</p><p>Thank you for reaching out to <b>[company_name]</b>! We will get back to you shortly.</p><p>[company_name]</p>"}},{"type":"log_activity","config":{"event_type":"welcome_sent","metadata":{"type":"new_lead"}}}]'::jsonb,
    false, true, 'welcome_new_lead')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Stale Lead Alert — 7 Days', 'Alert when lead has no activity for 7 days', 'lead.created', '{}', 604800,
    '[{"type":"create_notification","config":{"title":"Stale lead: [client_name]","body":"Lead [client_name] has had no activity for 7 days."}},{"type":"create_task","config":{"title":"Follow up stale lead: [client_name]","description":"Lead [client_name] created 7 days ago with no progress."}},{"type":"log_activity","config":{"event_type":"stale_lead_alert","metadata":{"days":7}}}]'::jsonb,
    false, true, 'stale_lead_7d')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Lost Lead Re-engagement — 90 Days', 'Re-engage lost leads after 90 days', 'lead.status_changed', '{"new_status":"lost"}', 7776000,
    '[{"type":"send_email","config":{"subject":"[company_name] — Still interested?","body":"<p>Hi [client_first_name],</p><p>It has been a while! If your needs have changed, we would love to reconnect.</p><p>[company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], still need help? [company_name] is here for you. Reply anytime."}},{"type":"log_activity","config":{"event_type":"reengagement_sent","metadata":{"type":"lost_lead_90d"}}}]'::jsonb,
    false, true, 'lost_lead_reengagement')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Client Anniversary — 1 Year', 'Celebrate 1-year anniversary with client', 'job.completed', '{}', 31536000,
    '[{"type":"send_email","config":{"subject":"[company_name] — Happy Anniversary!","body":"<p>Hi [client_first_name],</p><p>A year since your last service! Thank you for being a valued client.</p><p>[company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], a year since we worked together! Thank you for choosing [company_name]!"}},{"type":"log_activity","config":{"event_type":"anniversary_sent","metadata":{"type":"1_year"}}}]'::jsonb,
    false, true, 'client_anniversary')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Seasonal Reminder — 6 Months After Job', 'Seasonal check-up reminder', 'job.completed', '{}', 15552000,
    '[{"type":"send_email","config":{"subject":"[company_name] — Time for a check-up?","body":"<p>Hi [client_first_name],</p><p>6 months since your last service. Time for a seasonal check-up?</p><p>Reply to schedule! — [company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], 6 months since your last service! Time for a check-up? Reply to schedule. — [company_name]"}},{"type":"log_activity","config":{"event_type":"seasonal_reminder_sent","metadata":{"type":"6_month"}}}]'::jsonb,
    false, true, 'seasonal_reminder_6m')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'No-Show Follow-Up', 'Follow up when client misses appointment', 'appointment.cancelled', '{}', 3600,
    '[{"type":"send_sms","config":{"body":"Hi [client_first_name], we missed you today! Want to reschedule? Reply or call us. — [company_name]"}},{"type":"send_email","config":{"subject":"[company_name] — Missed Appointment","body":"<p>Hi [client_first_name],</p><p>We noticed you could not make your appointment. Want to reschedule? Just reply!</p><p>[company_name]</p>"}},{"type":"log_activity","config":{"event_type":"no_show_followup","metadata":{"type":"reschedule_request"}}}]'::jsonb,
    false, true, 'no_show_followup')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Post-Appointment Satisfaction Check', 'Quick satisfaction survey after service', 'job.completed', '{}', 3600,
    '[{"type":"send_sms","config":{"body":"Hi [client_first_name], how was your experience with [company_name] today? Reply 1-5 (5=excellent). Thank you!"}},{"type":"log_activity","config":{"event_type":"satisfaction_check_sent","metadata":{"type":"post_appointment"}}}]'::jsonb,
    false, true, 'post_appointment_survey')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Payment Confirmation — Thank You', 'Thank client for payment', 'invoice.paid', '{}', 0,
    '[{"type":"send_email","config":{"subject":"[company_name] — Payment Received!","body":"<p>Hi [client_first_name],</p><p>Payment received for invoice <b>[invoice_number]</b>. Thank you!</p><p>[company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], payment received for invoice [invoice_number]. Thank you! — [company_name]"}},{"type":"log_activity","config":{"event_type":"payment_confirmed","metadata":{"type":"payment_thanks"}}}]'::jsonb,
    false, true, 'payment_confirmation')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Deposit Received Confirmation', 'Confirm deposit and project start', 'invoice.paid', '{"payment_type":"deposit"}', 0,
    '[{"type":"send_email","config":{"subject":"[company_name] — Deposit Received!","body":"<p>Hi [client_first_name],</p><p>Deposit received for <b>[invoice_number]</b>. Your project is confirmed!</p><p>[company_name]</p>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], deposit received for [invoice_number]. Project confirmed! — [company_name]"}},{"type":"create_notification","config":{"title":"Deposit received: [client_name]","body":"Deposit for [invoice_number] confirmed. Schedule the job."}},{"type":"log_activity","config":{"event_type":"deposit_confirmed","metadata":{"type":"deposit_received"}}}]'::jsonb,
    false, true, 'deposit_received')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  -- Estimate follow-up (from workflowPresets)
  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Estimate Follow-Up', 'Follow up on sent estimates', 'estimate.sent', '{}', 172800,
    '[{"type":"send_email","config":{"subject":"[company_name] — Following up on your estimate","body":"<p>Hi [client_first_name],</p><p>Just checking in about the estimate we sent. Let us know if you have questions!</p><p>[company_name]</p>"}},{"type":"log_activity","config":{"event_type":"estimate_followup","metadata":{"type":"estimate_2d"}}}]'::jsonb,
    false, true, 'estimate_followup')
  ON CONFLICT (org_id, preset_key) WHERE preset_key IS NOT NULL DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, actions = EXCLUDED.actions, updated_at = now();

  RETURN v_count;
END;
$$;

-- Re-seed all orgs (now safe — upserts, never duplicates)
DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN SELECT id FROM public.orgs LOOP
    PERFORM public.seed_automation_presets(v_org.id);
  END LOOP;
END $$;
