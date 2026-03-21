/* ═══════════════════════════════════════════════════════════════
   Migration — Seed automation presets function.
   Creates a function that seeds preset automation rules for an org.
   Called when an org is created or when presets are initialized.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.seed_automation_presets(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Google Review
  insert into public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  values (p_org_id, 'Google Review Request', 'Send satisfaction survey after job completion', 'job.completed', '{}', 7200,
    '[{"type":"request_review","config":{}}]'::jsonb, false, true, 'google_review')
  on conflict do nothing;
  get diagnostics v_count = row_count;

  -- Estimate Follow-Up
  insert into public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  values (p_org_id, 'Estimate Follow-Up (3 days)', 'Follow-up 3 days after estimate sent', 'estimate.sent', '{}', 259200,
    '[{"type":"send_email","config":{"subject":"[company_name] - Following up on your estimate","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>We sent you an estimate a few days ago and wanted to follow up.</p><p>If you have any questions, please don''t hesitate to reach out.</p><p>Best regards,<br/>[company_name]</p></div>"}},{"type":"send_sms","config":{"body":"Hi [client_first_name], just following up on the estimate we sent. Let us know if you have any questions! - [company_name]"}},{"type":"log_activity","config":{"event_type":"follow_up_sent","metadata":{"type":"estimate_followup"}}}]'::jsonb, false, true, 'estimate_followup')
  on conflict do nothing;

  -- Appointment Confirmation
  insert into public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  values (p_org_id, 'Appointment Confirmation', 'Confirm appointment immediately', 'appointment.created', '{}', 0,
    '[{"type":"send_email","config":{"subject":"[company_name] - Appointment Confirmed","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Your appointment is confirmed:</p><ul><li><strong>Date:</strong> [appointment_date]</li><li><strong>Time:</strong> [appointment_time]</li><li><strong>Location:</strong> [appointment_address]</li></ul><p>See you soon!<br/>[company_name]</p></div>"}},{"type":"send_sms","config":{"body":"Your appointment with [company_name] is confirmed for [appointment_date] at [appointment_time]. See you there!"}}]'::jsonb, false, true, 'appointment_confirmation')
  on conflict do nothing;

  -- Invoice Reminders J+1, J+3, J+5, J+15, J+30
  insert into public.automation_rules (org_id, name, description, trigger_event, conditions, delay_seconds, actions, is_active, is_preset, preset_key)
  values
    (p_org_id, 'Invoice Reminder (J+1)', 'Reminder 1 day after due', 'invoice.overdue', '{"days_overdue":1}', 0,
     '[{"type":"send_email","config":{"subject":"[company_name] - Payment Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Just a friendly reminder that invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is past due.</p><p>Please arrange payment at your earliest convenience.</p><p>Thank you,<br/>[company_name]</p></div>"}},{"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_overdue":1}}}]'::jsonb, false, true, 'invoice_reminder_1d'),
    (p_org_id, 'Invoice Reminder (J+3)', 'Reminder 3 days after due', 'invoice.overdue', '{"days_overdue":3}', 0,
     '[{"type":"send_email","config":{"subject":"[company_name] - Payment Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Reminder that invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is past due.</p><p>Please arrange payment.</p><p>Thank you,<br/>[company_name]</p></div>"}},{"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_overdue":3}}}]'::jsonb, false, true, 'invoice_reminder_3d'),
    (p_org_id, 'Invoice Reminder (J+5)', 'Reminder 5 days after due', 'invoice.overdue', '{"days_overdue":5}', 0,
     '[{"type":"send_email","config":{"subject":"[company_name] - Payment Reminder: Invoice [invoice_number]","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is now 5 days past due.</p><p>Please arrange payment at your earliest convenience.</p><p>Thank you,<br/>[company_name]</p></div>"}},{"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_overdue":5}}}]'::jsonb, false, true, 'invoice_reminder_5d'),
    (p_org_id, 'Invoice Reminder (J+15)', 'Reminder 15 days after due', 'invoice.overdue', '{"days_overdue":15}', 0,
     '[{"type":"send_email","config":{"subject":"[company_name] - Urgent: Invoice [invoice_number] Past Due","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is now significantly past due.</p><p>Please arrange payment urgently.</p><p>Thank you,<br/>[company_name]</p></div>"}},{"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_overdue":15}}}]'::jsonb, false, true, 'invoice_reminder_15d'),
    (p_org_id, 'Invoice Reminder (J+30)', 'Final reminder 30 days after due', 'invoice.overdue', '{"days_overdue":30}', 0,
     '[{"type":"send_email","config":{"subject":"[company_name] - Urgent: Invoice [invoice_number] Past Due","body":"<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;\"><h2>Hi [client_first_name],</h2><p>Invoice <strong>[invoice_number]</strong> for <strong>[invoice_total]</strong> is now 30 days past due.</p><p>Please arrange payment immediately.</p><p>Thank you,<br/>[company_name]</p></div>"}},{"type":"create_notification","config":{"title":"Invoice [invoice_number] — 30 days overdue","body":"[client_name] has an invoice overdue for 30 days."}},{"type":"create_task","config":{"title":"Follow up: Invoice [invoice_number] — 30 days overdue","description":"Client [client_name] has not paid for 30 days."}},{"type":"log_activity","config":{"event_type":"invoice_reminded","metadata":{"days_overdue":30}}}]'::jsonb, false, true, 'invoice_reminder_30d')
  on conflict do nothing;

  return v_count;
end;
$$;

-- Seed presets for all existing orgs
do $$
declare
  v_org record;
begin
  for v_org in select id from public.orgs loop
    perform public.seed_automation_presets(v_org.id);
  end loop;
end $$;
