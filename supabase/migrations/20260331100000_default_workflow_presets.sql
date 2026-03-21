/* ═══════════════════════════════════════════════════════════════
   Migration — Default CRM workflow presets (7 workflows).

   These are the built-in automation rules every org gets:
   1. Job reminder — 1 week before
   2. Job reminder — 1 day before
   3. Quote follow-up — 1 day after sent
   4. Invoice reminder — 1 day after sent
   5. Invoice reminder — 3 days after sent
   6. Invoice reminder — 7 days after sent
   7. Invoice final reminder — 30 days after sent

   Uses the automation_rules engine with:
   - trigger_event → matches CRM event bus events
   - delay_seconds → negative = before event time, positive = after now
   - conditions → JSONB condition matching on event metadata
   - actions → array of action configs (send_sms, send_email, etc.)
   - is_preset = true, preset_key = unique identifier
   - execution_key dedup prevents duplicate sends
   ═══════════════════════════════════════════════════════════════ */

-- Replace the seed function to include the new 7 default workflows
CREATE OR REPLACE FUNCTION public.seed_automation_presets(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 1. JOB REMINDER — 1 WEEK BEFORE
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Trigger: appointment.created
  -- Delay: -604800 seconds (7 days before start_time)
  -- Stop: if event cancelled or deleted (built into engine)
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
    true,
    true,
    'job_reminder_7d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 2. JOB REMINDER — 1 DAY BEFORE
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    true,
    true,
    'job_reminder_1d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 3. QUOTE FOLLOW-UP — 1 DAY AFTER SENT
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Trigger: estimate.sent
  -- Delay: 86400 seconds (1 day after)
  -- Stop: if invoice status = paid/accepted/rejected/cancelled/void (built into engine)
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
    true,
    true,
    'quote_followup_1d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 4. INVOICE REMINDER — 1 DAY AFTER SENT
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Trigger: invoice.sent
  -- Delay: 86400 seconds (1 day)
  -- Stop: if invoice paid/cancelled/void (built into engine)
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
    true,
    true,
    'invoice_sent_reminder_1d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 5. INVOICE REMINDER — 3 DAYS AFTER SENT
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    true,
    true,
    'invoice_sent_reminder_3d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 6. INVOICE REMINDER — 7 DAYS AFTER SENT
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    true,
    true,
    'invoice_sent_reminder_7d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 7. INVOICE FINAL REMINDER — 30 DAYS AFTER SENT
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    true,
    true,
    'invoice_sent_reminder_30d'
  ) ON CONFLICT DO NOTHING;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Keep existing presets (appointment confirmation, google review, etc.)
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  -- Google Review (existing)
  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Google Review Request', 'Send satisfaction survey after job completion', 'job.completed', '{}', 7200,
    '[{"type":"request_review","config":{}}]'::jsonb, false, true, 'google_review')
  ON CONFLICT DO NOTHING;

  -- Appointment Confirmation (existing)
  INSERT INTO public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  VALUES (p_org_id, 'Appointment Confirmation', 'Confirm appointment immediately', 'appointment.created', '{}', 0,
    '[{"type":"send_sms","config":{"body":"Your appointment with [company_name] is confirmed for [appointment_date] at [appointment_time]. See you there!"}},{"type":"send_email","config":{"subject":"[company_name] - Appointment Confirmed","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Your appointment is confirmed:</p><ul><li><strong>Date:</strong> [appointment_date]</li><li><strong>Time:</strong> [appointment_time]</li><li><strong>Location:</strong> [appointment_address]</li></ul><p>See you soon!<br/>[company_name]</p></div>"}}]'::jsonb, false, true, 'appointment_confirmation')
  ON CONFLICT DO NOTHING;

  RETURN v_count;
END;
$$;

-- Re-seed all existing orgs with new presets
DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN SELECT id FROM public.orgs LOOP
    PERFORM public.seed_automation_presets(v_org.id);
  END LOOP;
END $$;
