-- ============================================================
-- MEGA FIX: Security, Performance & Linter Compliance
-- Fixes ~940 issues from supabase db advisors
-- ============================================================

begin;

-- ============================================================
-- 1. Fix SECURITY DEFINER views -> SECURITY INVOKER (12 ERRORs)
-- ============================================================

DROP VIEW IF EXISTS public.clients_active;
CREATE VIEW public.clients_active WITH (security_invoker = true) AS SELECT id, org_id, first_name, last_name, company, email, phone, address, status, created_at, updated_at, deleted_at, contact_id, created_by, deleted_by, fts_vector, notes, archived_at, archived_by, (EXISTS (SELECT 1 FROM leads l WHERE l.client_id = c.id AND l.deleted_at IS NULL)) AS is_lead FROM clients c WHERE deleted_at IS NULL;
GRANT SELECT ON public.clients_active TO authenticated, anon;

DROP VIEW IF EXISTS public.jobs_active;
CREATE VIEW public.jobs_active WITH (security_invoker = true) AS SELECT id, org_id, job_number, title, client_id, client_name, property_address, scheduled_at, status, total_cents, currency, job_type, notes, invoice_url, attachments, created_at, updated_at, description, deleted_at, total_amount, created_by, deal_id, lead_id, team_id, address, latitude, longitude, geocoded_at, geocode_status, deleted_by, end_at, completed_at, closed_at, start_at, subtotal, tax_lines, tax_total, total, billing_split, fts_vector, salesperson_id, requires_invoicing FROM jobs WHERE deleted_at IS NULL;
GRANT SELECT ON public.jobs_active TO authenticated, anon;

DROP VIEW IF EXISTS public.leads_active;
CREATE VIEW public.leads_active WITH (security_invoker = true) AS SELECT id, created_at, first_name, last_name, email, company, value, status, tags, user_id, stage_id, org_id, created_by, assigned_to, title, phone, source, notes, archived_at, deleted_at, updated_at, schedule, assigned_team, line_items, description, converted_to_client_id, contact_id, address, deleted_by, stage, lost_at, closed_at, converted_job_id, converted_at, client_id, fts_vector FROM leads WHERE deleted_at IS NULL;
GRANT SELECT ON public.leads_active TO authenticated, anon;

DROP VIEW IF EXISTS public.leads_open;
CREATE VIEW public.leads_open WITH (security_invoker = true) AS SELECT id, created_at, first_name, last_name, email, company, value, status, tags, user_id, stage_id, org_id, created_by, assigned_to, title, phone, source, notes, archived_at, deleted_at, updated_at FROM leads WHERE deleted_at IS NULL AND archived_at IS NULL;
GRANT SELECT ON public.leads_open TO authenticated, anon;

DROP VIEW IF EXISTS public.pipeline_deals_active;
CREATE VIEW public.pipeline_deals_active WITH (security_invoker = true) AS SELECT id, org_id, lead_id, stage_id, value_cents, currency, probability, created_at, updated_at, deleted_at, value, created_by, job_id, stage, title, notes, client_id, lost_at, deleted_by FROM pipeline_deals WHERE deleted_at IS NULL;
GRANT SELECT ON public.pipeline_deals_active TO authenticated, anon;

DROP VIEW IF EXISTS public.pipeline_deals_visible;
CREATE VIEW public.pipeline_deals_visible WITH (security_invoker = true) AS SELECT id, org_id, lead_id, stage_id, value_cents, currency, probability, created_at, updated_at, deleted_at, value, created_by, job_id, stage, title, notes, client_id, lost_at, deleted_by, archived_at, archived_by, won_at FROM pipeline_deals pd WHERE deleted_at IS NULL AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM leads l WHERE l.id = pd.lead_id AND l.deleted_at IS NULL)) AND (client_id IS NULL OR EXISTS (SELECT 1 FROM clients c WHERE c.id = pd.client_id AND c.deleted_at IS NULL)) AND (stage <> 'closed' OR won_at IS NULL OR won_at > (now() - interval '2 days')) AND (stage <> 'lost' OR lost_at IS NULL OR lost_at > (now() - interval '15 days'));
GRANT SELECT ON public.pipeline_deals_visible TO authenticated, anon;

DROP VIEW IF EXISTS public.schedule_events_active;
CREATE VIEW public.schedule_events_active WITH (security_invoker = true) AS SELECT id, org_id, job_id, title, start_time, end_time, assigned_user, notes, created_at, updated_at, deleted_at, status, created_by, timezone, team_id, start_at, end_at FROM schedule_events WHERE deleted_at IS NULL;
GRANT SELECT ON public.schedule_events_active TO authenticated, anon;

DROP VIEW IF EXISTS public.team_availability_active;
CREATE VIEW public.team_availability_active WITH (security_invoker = true) AS SELECT id, org_id, team_id, weekday, start_minute, end_minute, timezone, created_at, updated_at, deleted_at FROM team_availability WHERE deleted_at IS NULL;
GRANT SELECT ON public.team_availability_active TO authenticated, anon;

DROP VIEW IF EXISTS public.v_client_portfolio;
CREATE VIEW public.v_client_portfolio WITH (security_invoker = true) AS SELECT c.id AS client_id, c.org_id, c.first_name, c.last_name, c.company, c.email, c.phone, c.status, c.created_at,
COALESCE(job_stats.total_jobs, 0) AS total_jobs, COALESCE(job_stats.active_jobs, 0) AS active_jobs, COALESCE(job_stats.completed_jobs, 0) AS completed_jobs, COALESCE(job_stats.total_revenue_cents, 0::bigint) AS total_revenue_cents, job_stats.last_job_date,
COALESCE(inv_stats.total_invoices, 0) AS total_invoices, COALESCE(inv_stats.unpaid_cents, 0::bigint) AS unpaid_cents, COALESCE(inv_stats.paid_cents, 0::bigint) AS paid_cents, COALESCE(inv_stats.overdue_invoices, 0) AS overdue_invoices,
COALESCE(lead_stats.total_leads, 0) AS total_leads, COALESCE(lead_stats.open_leads, 0) AS open_leads
FROM clients c
LEFT JOIN LATERAL (SELECT count(*)::integer AS total_jobs, count(*) FILTER (WHERE j.status = ANY(ARRAY['scheduled','in_progress']))::integer AS active_jobs, count(*) FILTER (WHERE j.status = 'completed')::integer AS completed_jobs, sum(COALESCE(j.total_cents,0)) AS total_revenue_cents, max(j.created_at) AS last_job_date FROM jobs j WHERE j.client_id = c.id AND j.deleted_at IS NULL) job_stats ON true
LEFT JOIN LATERAL (SELECT count(*)::integer AS total_invoices, sum(CASE WHEN i.status = ANY(ARRAY['sent','partial']) THEN i.balance_cents ELSE 0 END) AS unpaid_cents, sum(CASE WHEN i.status = 'paid' THEN i.total_cents ELSE 0 END) AS paid_cents, count(*) FILTER (WHERE i.status = ANY(ARRAY['sent','partial']) AND i.due_date < CURRENT_DATE)::integer AS overdue_invoices FROM invoices i WHERE i.client_id = c.id AND i.deleted_at IS NULL) inv_stats ON true
LEFT JOIN LATERAL (SELECT count(*)::integer AS total_leads, count(*) FILTER (WHERE l.stage <> ALL(ARRAY['closed','lost']))::integer AS open_leads FROM leads l WHERE l.client_id = c.id AND l.deleted_at IS NULL) lead_stats ON true
WHERE c.deleted_at IS NULL;
GRANT SELECT ON public.v_client_portfolio TO authenticated, anon;

DROP VIEW IF EXISTS public.v_job_full;
CREATE VIEW public.v_job_full WITH (security_invoker = true) AS SELECT j.id AS job_id, j.org_id, j.job_number, j.title AS job_title, j.status AS job_status, j.job_type, j.address, j.total_cents, j.currency, j.scheduled_at, j.start_at AS job_start_at, j.end_at AS job_end_at, j.completed_at, j.notes AS job_notes, j.created_at AS job_created_at,
c.id AS client_id, c.first_name AS client_first_name, c.last_name AS client_last_name, c.company AS client_company, c.email AS client_email, c.phone AS client_phone, c.status AS client_status,
l.id AS lead_id, l.first_name AS lead_first_name, l.last_name AS lead_last_name, l.stage AS lead_stage, l.value AS lead_value, l.source AS lead_source,
t.id AS team_id, t.name AS team_name, t.color_hex AS team_color,
inv.id AS invoice_id, inv.invoice_number, inv.status AS invoice_status, inv.total_cents AS invoice_total_cents, inv.balance_cents AS invoice_balance_cents, inv.due_date AS invoice_due_date,
se.id AS schedule_event_id, se.start_at AS schedule_start_at, se.end_at AS schedule_end_at, se.status AS schedule_status
FROM jobs j
LEFT JOIN clients c ON c.id = j.client_id AND c.deleted_at IS NULL
LEFT JOIN leads l ON l.id = j.lead_id AND l.deleted_at IS NULL
LEFT JOIN teams t ON t.id = j.team_id AND t.deleted_at IS NULL
LEFT JOIN LATERAL (SELECT i.id, i.org_id, i.created_by, i.client_id, i.invoice_number, i.status, i.subject, i.issued_at, i.due_date, i.subtotal_cents, i.tax_cents, i.total_cents, i.paid_cents, i.balance_cents, i.paid_at, i.created_at, i.updated_at, i.deleted_at, i.job_id, i.public_token, i.currency, i.sent_at, i.deleted_by, i.subtotal, i.tax_total, i.total FROM invoices i WHERE i.job_id = j.id AND i.deleted_at IS NULL ORDER BY i.created_at DESC LIMIT 1) inv ON true
LEFT JOIN LATERAL (SELECT s.id, s.org_id, s.job_id, s.title, s.start_time, s.end_time, s.assigned_user, s.notes, s.created_at, s.updated_at, s.deleted_at, s.status, s.created_by, s.timezone, s.team_id, s.start_at, s.end_at FROM schedule_events s WHERE s.job_id = j.id AND s.deleted_at IS NULL ORDER BY s.start_at DESC LIMIT 1) se ON true
WHERE j.deleted_at IS NULL;
GRANT SELECT ON public.v_job_full TO authenticated, anon;

DROP VIEW IF EXISTS public.v_pipeline_overview;
CREATE VIEW public.v_pipeline_overview WITH (security_invoker = true) AS SELECT d.id AS deal_id, d.org_id, d.stage, d.title AS deal_title, d.value_cents, d.probability, d.created_at AS deal_created_at, d.lost_at,
l.id AS lead_id, (l.first_name || ' ' || l.last_name) AS lead_name, l.email AS lead_email, l.stage AS lead_stage, l.source AS lead_source,
c.id AS client_id, (c.first_name || ' ' || c.last_name) AS client_name, c.company AS client_company,
j.id AS job_id, j.job_number, j.status AS job_status, j.total_cents AS job_total_cents
FROM pipeline_deals d
LEFT JOIN leads l ON l.id = d.lead_id AND l.deleted_at IS NULL
LEFT JOIN clients c ON c.id = d.client_id AND c.deleted_at IS NULL
LEFT JOIN jobs j ON j.id = d.job_id AND j.deleted_at IS NULL
WHERE d.deleted_at IS NULL;
GRANT SELECT ON public.v_pipeline_overview TO authenticated, anon;

DROP VIEW IF EXISTS public.v_revenue_analytics;
CREATE VIEW public.v_revenue_analytics WITH (security_invoker = true) AS SELECT p.org_id, (date_trunc('month', p.payment_date AT TIME ZONE 'America/Toronto'))::date AS month, p.currency, p.method, count(*)::integer AS payment_count, sum(p.amount_cents) AS total_cents, avg(p.amount_cents)::integer AS avg_cents, c.id AS client_id, (c.first_name || ' ' || c.last_name) AS client_name, c.company AS client_company
FROM payments p LEFT JOIN clients c ON c.id = p.client_id AND c.deleted_at IS NULL
WHERE p.deleted_at IS NULL AND p.status = 'succeeded'
GROUP BY p.org_id, (date_trunc('month', p.payment_date AT TIME ZONE 'America/Toronto'))::date, p.currency, p.method, c.id, c.first_name, c.last_name, c.company;
GRANT SELECT ON public.v_revenue_analytics TO authenticated, anon;

DROP VIEW IF EXISTS public.v_schedule_calendar;
CREATE VIEW public.v_schedule_calendar WITH (security_invoker = true) AS SELECT se.id AS event_id, se.org_id, se.start_at, se.end_at, se.status AS event_status, se.notes AS event_notes, se.timezone,
j.id AS job_id, j.job_number, j.title AS job_title, j.status AS job_status, j.address AS job_address,
c.id AS client_id, (c.first_name || ' ' || c.last_name) AS client_name, c.phone AS client_phone,
t.id AS team_id, t.name AS team_name, t.color_hex AS team_color
FROM schedule_events se
LEFT JOIN jobs j ON j.id = se.job_id AND j.deleted_at IS NULL
LEFT JOIN clients c ON c.id = j.client_id AND c.deleted_at IS NULL
LEFT JOIN teams t ON t.id = se.team_id AND t.deleted_at IS NULL
WHERE se.deleted_at IS NULL;
GRANT SELECT ON public.v_schedule_calendar TO authenticated, anon;

-- ============================================================
-- 2. Enable RLS on unprotected tables (4 ERRORs)
-- ============================================================

ALTER TABLE public.client_link_backfill_ambiguous ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- client_link_backfill_ambiguous: org-scoped
CREATE POLICY client_link_backfill_select ON public.client_link_backfill_ambiguous FOR SELECT USING (has_org_membership((select auth.uid()), org_id));

-- rate_limits: users can see their own entries
CREATE POLICY rate_limits_select ON public.rate_limits FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY rate_limits_insert ON public.rate_limits FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- agent_chat_sessions: no org_id, service role only (RLS with no policies)

-- currency_rates: read-only for authenticated
CREATE POLICY currency_rates_select ON public.currency_rates FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Fix lead_lists: RLS enabled but no policies
-- ============================================================

CREATE POLICY lead_lists_select ON public.lead_lists FOR SELECT USING (EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_lists.lead_id AND has_org_membership((select auth.uid()), l.org_id)));
CREATE POLICY lead_lists_insert ON public.lead_lists FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_lists.lead_id AND has_org_membership((select auth.uid()), l.org_id)));
CREATE POLICY lead_lists_delete ON public.lead_lists FOR DELETE USING (EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_lists.lead_id AND has_org_membership((select auth.uid()), l.org_id)));

-- ============================================================
-- 4. Fix always-true RLS policies (2 WARNs)
-- ============================================================

-- quote_views insert for anon is intentionally true (public invoice viewing)
-- webhook_events: restrict to service_role only
DROP POLICY IF EXISTS "webhook_events_service_all" ON public.webhook_events;
-- RLS enabled + no policy = only service_role can access

-- ============================================================
-- 5. Fix function search_path (47 WARNs)
-- ============================================================

ALTER FUNCTION public.update_conversation_on_message() SET search_path = public;
ALTER FUNCTION public.ai_set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_connected_accounts_updated_at() SET search_path = public;
ALTER FUNCTION public.set_payment_requests_updated_at() SET search_path = public;
ALTER FUNCTION public.build_client_fts_vector(r clients) SET search_path = public;
ALTER FUNCTION public.build_lead_fts_vector(r leads) SET search_path = public;
ALTER FUNCTION public.build_job_fts_vector(r jobs) SET search_path = public;
ALTER FUNCTION public.build_invoice_fts_vector(r invoices) SET search_path = public;
ALTER FUNCTION public.trg_clients_fts_update() SET search_path = public;
ALTER FUNCTION public.trg_leads_fts_update() SET search_path = public;
ALTER FUNCTION public.trg_jobs_fts_update() SET search_path = public;
ALTER FUNCTION public.trg_invoices_fts_update() SET search_path = public;
ALTER FUNCTION public.ai_on_message_insert() SET search_path = public;
ALTER FUNCTION public.ai_enforce_org_scope() SET search_path = public;
ALTER FUNCTION public.rpc_ai_recent_conversations(p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.payments_sync_dates_and_update() SET search_path = public;
ALTER FUNCTION public.search_fts(p_org_id uuid, p_query text, p_entity_type text, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.has_object_permission(p_user_id uuid, p_org_id uuid, p_entity_type text, p_entity_id uuid, p_required_level text) SET search_path = public;
ALTER FUNCTION public.grant_object_permission(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_user_id uuid, p_permission text) SET search_path = public;
ALTER FUNCTION public.revoke_object_permission(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.audit_log_trigger() SET search_path = public;
ALTER FUNCTION public.get_audit_log(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_action text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.automation_job_completed() SET search_path = public;
ALTER FUNCTION public.automation_invoice_overdue_check() SET search_path = public;
ALTER FUNCTION public.automation_lead_stage_change() SET search_path = public;
ALTER FUNCTION public.archive_record(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_reason text, p_hard_delete boolean) SET search_path = public;
ALTER FUNCTION public.restore_archived_record(p_org_id uuid, p_entity_type text, p_entity_id uuid) SET search_path = public;
ALTER FUNCTION public.batch_soft_delete(p_org_id uuid, p_entity_type text, p_entity_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.batch_restore(p_org_id uuid, p_entity_type text, p_entity_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.convert_currency(p_amount_cents integer, p_from_currency text, p_to_currency text, p_date date) SET search_path = public;
ALTER FUNCTION public.rpc_revenue_by_currency(p_org_id uuid, p_from date, p_to date) SET search_path = public;
ALTER FUNCTION public.generate_invoice_from_template(p_org_id uuid, p_template_id uuid, p_client_id uuid, p_job_id uuid, p_items jsonb, p_due_days integer) SET search_path = public;
ALTER FUNCTION public.rpc_ceo_dashboard(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.rpc_team_workload(p_org_id uuid, p_from date, p_to date) SET search_path = public;
ALTER FUNCTION public.find_duplicate_clients(p_org_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_threshold real) SET search_path = public;
ALTER FUNCTION public.get_entity_activity(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_limit integer) SET search_path = public;
ALTER FUNCTION public.format_montreal_date(ts timestamp with time zone, fmt text) SET search_path = public;
ALTER FUNCTION public.business_days_between(p_start date, p_end date) SET search_path = public;
ALTER FUNCTION public.purge_old_soft_deletes(p_org_id uuid, p_days integer) SET search_path = public;
ALTER FUNCTION public.rpc_database_stats(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.check_rate_limit(p_action text, p_max_per_minute integer) SET search_path = public;
ALTER FUNCTION public.update_comm_updated_at() SET search_path = public;
ALTER FUNCTION public.payments_sync_legacy_dates() SET search_path = public;
ALTER FUNCTION public.get_job_kpis(p_org_id uuid, p_status text, p_job_type text, p_q text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION app.current_org_id() SET search_path = public, app;

-- ============================================================
-- 6. Drop duplicate indexes (33 WARNs)
-- ============================================================

DROP INDEX IF EXISTS public.idx_clients_org_created_at_desc;
DROP INDEX IF EXISTS public.idx_clients_org_deleted_at;
DROP INDEX IF EXISTS public.idx_clients_name_trgm_dashboard;
DROP INDEX IF EXISTS public.idx_clients_search_name_trgm;
DROP INDEX IF EXISTS public.idx_invoices_org_issued_at_insights;
DROP INDEX IF EXISTS public.invoices_org_job_idx;
DROP INDEX IF EXISTS public.idx_invoices_org_status_insights;
DROP INDEX IF EXISTS public.idx_invoices_org_status_payments;
DROP INDEX IF EXISTS public.invoices_org_status_idx;
DROP INDEX IF EXISTS public.uq_invoices_org_job_active;
DROP INDEX IF EXISTS public.idx_jobs_org_created_at_desc;
DROP INDEX IF EXISTS public.jobs_org_deleted_idx;
DROP INDEX IF EXISTS public.idx_jobs_org_lead_id_insights;
DROP INDEX IF EXISTS public.jobs_org_scheduled_idx;
DROP INDEX IF EXISTS public.jobs_org_status_idx;
DROP INDEX IF EXISTS public.jobs_status_idx;
DROP INDEX IF EXISTS public.leads_org_archived_at_idx;
DROP INDEX IF EXISTS public.leads_org_assigned_to_idx;
DROP INDEX IF EXISTS public.idx_leads_org_created_at_desc;
DROP INDEX IF EXISTS public.leads_org_created_at_desc_idx;
DROP INDEX IF EXISTS public.idx_leads_org_created_at_insights;
DROP INDEX IF EXISTS public.leads_org_deleted_idx;
DROP INDEX IF EXISTS public.leads_org_status_idx;
DROP INDEX IF EXISTS public.leads_search_trgm_idx;
DROP INDEX IF EXISTS public.uq_leads_org_email;
DROP INDEX IF EXISTS public.uq_leads_org_email_active;
DROP INDEX IF EXISTS public.idx_notifications_org;
DROP INDEX IF EXISTS public.notifications_org_created_idx;
DROP INDEX IF EXISTS public.idx_payments_client_id_module;
DROP INDEX IF EXISTS public.idx_payments_invoice_id_module;
DROP INDEX IF EXISTS public.idx_payments_org_id_module;
DROP INDEX IF EXISTS public.idx_payments_payment_date_module;
DROP INDEX IF EXISTS public.idx_pipeline_deals_org_deleted_idx;
DROP INDEX IF EXISTS public.idx_pipeline_deals_org_lead_id;
DROP INDEX IF EXISTS public.idx_pipeline_deals_org_stage_id;
DROP INDEX IF EXISTS public.schedule_events_job_idx;
DROP INDEX IF EXISTS public.idx_schedule_events_org_assigned_user;
DROP INDEX IF EXISTS public.idx_schedule_events_org_start_time;
DROP INDEX IF EXISTS public.schedule_events_job_active_uidx;

-- ============================================================
-- 7. Add indexes for unindexed foreign keys (74 INFOs)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON public.activity_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_by ON public.ai_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_by ON public.ai_messages (created_by);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_created_by ON public.ai_tool_calls (created_by);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message_id ON public.ai_tool_calls (message_id);
CREATE INDEX IF NOT EXISTS idx_app_connections_connected_by ON public.app_connections (connected_by);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_scheduled_task_id ON public.automation_execution_logs (scheduled_task_id);
CREATE INDEX IF NOT EXISTS idx_automation_scheduled_tasks_automation_rule_id ON public.automation_scheduled_tasks (automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_team_id ON public.availabilities (team_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_parent_id ON public.board_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_user_id ON public.board_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_board_drawings_created_by ON public.board_drawings (created_by);
CREATE INDEX IF NOT EXISTS idx_board_votes_item_id ON public.board_votes (item_id);
CREATE INDEX IF NOT EXISTS idx_board_votes_user_id ON public.board_votes (user_id);
CREATE INDEX IF NOT EXISTS idx_communication_channels_user_id ON public.communication_channels (user_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_channel_id ON public.communication_messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_user_id ON public.communication_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_communication_settings_default_sms_channel_id ON public.communication_settings (default_sms_channel_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_created_by ON public.company_settings (created_by);
CREATE INDEX IF NOT EXISTS idx_company_settings_org_id ON public.company_settings (org_id);
CREATE INDEX IF NOT EXISTS idx_custom_column_values_org_id ON public.custom_column_values (org_id);
CREATE INDEX IF NOT EXISTS idx_director_creative_directions_created_by ON public.director_creative_directions (created_by);
CREATE INDEX IF NOT EXISTS idx_director_creative_directions_style_dna_id ON public.director_creative_directions (style_dna_id);
CREATE INDEX IF NOT EXISTS idx_director_edges_source_node_id ON public.director_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_director_edges_target_node_id ON public.director_edges (target_node_id);
CREATE INDEX IF NOT EXISTS idx_director_flows_created_by ON public.director_flows (created_by);
CREATE INDEX IF NOT EXISTS idx_director_flows_updated_by ON public.director_flows (updated_by);
CREATE INDEX IF NOT EXISTS idx_director_generations_created_by ON public.director_generations (created_by);
CREATE INDEX IF NOT EXISTS idx_director_generations_run_id ON public.director_generations (run_id);
CREATE INDEX IF NOT EXISTS idx_director_runs_triggered_by ON public.director_runs (triggered_by);
CREATE INDEX IF NOT EXISTS idx_director_style_dna_created_by ON public.director_style_dna (created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON public.email_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_entity_comments_author_id ON public.entity_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_user_id ON public.integration_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_integration_oauth_states_org_id ON public.integration_oauth_states (org_id);
CREATE INDEX IF NOT EXISTS idx_integration_oauth_states_user_id ON public.integration_oauth_states (user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_template_id ON public.invoices (template_id);
CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice_id ON public.invoices (parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_intents_deal_id ON public.job_intents (deal_id);
CREATE INDEX IF NOT EXISTS idx_job_recurrence_rules_org_id ON public.job_recurrence_rules (org_id);
CREATE INDEX IF NOT EXISTS idx_job_templates_created_by ON public.job_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_team_id ON public.jobs (team_id);
CREATE INDEX IF NOT EXISTS idx_lead_lists_list_id ON public.lead_lists (list_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_client_id ON public.leads (converted_to_client_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages (client_id);
CREATE INDEX IF NOT EXISTS idx_note_boards_archived_by ON public.note_boards (archived_by);
CREATE INDEX IF NOT EXISTS idx_note_boards_created_by ON public.note_boards (created_by);
CREATE INDEX IF NOT EXISTS idx_note_connections_source_id ON public.note_connections (source_id);
CREATE INDEX IF NOT EXISTS idx_note_connections_target_id ON public.note_connections (target_id);
CREATE INDEX IF NOT EXISTS idx_note_history_edited_by ON public.note_history (edited_by);
CREATE INDEX IF NOT EXISTS idx_note_items_created_by ON public.note_items (created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes (created_by);
CREATE INDEX IF NOT EXISTS idx_object_permissions_granted_by ON public.object_permissions (granted_by);
CREATE INDEX IF NOT EXISTS idx_object_permissions_user_id ON public.object_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payments (job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage_id ON public.pipeline_deals (stage_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines (user_id);
CREATE INDEX IF NOT EXISTS idx_quote_views_client_id ON public.quote_views (client_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_email_template_id ON public.review_requests (email_template_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_job_id ON public.review_requests (job_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_survey_id ON public.review_requests (survey_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_client_id ON public.satisfaction_surveys (client_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_job_id ON public.satisfaction_surveys (job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_team_id ON public.schedule_events (team_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks (lead_id);
CREATE INDEX IF NOT EXISTS idx_team_date_slots_org_id ON public.team_date_slots (org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_technician_device_mappings_provider_id ON public.technician_device_mappings (provider_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source_id ON public.workflow_edges (source_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target_id ON public.workflow_edges (target_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_node_id ON public.workflow_logs (node_id);

-- ============================================================
-- 8. Fix auth.uid() -> (select auth.uid()) in RLS (398 WARNs)
-- ============================================================

DROP POLICY IF EXISTS "activity_log_insert_org" ON public.activity_log;
CREATE POLICY "activity_log_insert_org" ON public.activity_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "activity_log_select_org" ON public.activity_log;
CREATE POLICY "activity_log_select_org" ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations AS PERMISSIVE FOR DELETE TO public USING (((org_id = current_org_id()) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "app_connections_delete" ON public.app_connections;
CREATE POLICY "app_connections_delete" ON public.app_connections AS PERMISSIVE FOR DELETE TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = 'owner'::text)))));
DROP POLICY IF EXISTS "app_connections_delete_org" ON public.app_connections;
CREATE POLICY "app_connections_delete_org" ON public.app_connections AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "app_connections_insert" ON public.app_connections;
CREATE POLICY "app_connections_insert" ON public.app_connections AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "app_connections_insert_org" ON public.app_connections;
CREATE POLICY "app_connections_insert_org" ON public.app_connections AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "app_connections_select" ON public.app_connections;
CREATE POLICY "app_connections_select" ON public.app_connections AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "app_connections_select_org" ON public.app_connections;
CREATE POLICY "app_connections_select_org" ON public.app_connections AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "app_connections_update" ON public.app_connections;
CREATE POLICY "app_connections_update" ON public.app_connections AS PERMISSIVE FOR UPDATE TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "app_connections_update_org" ON public.app_connections;
CREATE POLICY "app_connections_update_org" ON public.app_connections AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "archived_records_admin_manage" ON public.archived_records;
CREATE POLICY "archived_records_admin_manage" ON public.archived_records AS PERMISSIVE FOR ALL TO public USING (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "archived_records_org_select" ON public.archived_records;
CREATE POLICY "archived_records_org_select" ON public.archived_records AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "audit_events_insert_org" ON public.audit_events;
CREATE POLICY "audit_events_insert_org" ON public.audit_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "audit_events_select_org" ON public.audit_events;
CREATE POLICY "audit_events_select_org" ON public.audit_events AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_execution_logs_delete_org" ON public.automation_execution_logs;
CREATE POLICY "automation_execution_logs_delete_org" ON public.automation_execution_logs AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_execution_logs_insert_org" ON public.automation_execution_logs;
CREATE POLICY "automation_execution_logs_insert_org" ON public.automation_execution_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_execution_logs_select_org" ON public.automation_execution_logs;
CREATE POLICY "automation_execution_logs_select_org" ON public.automation_execution_logs AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_execution_logs_update_org" ON public.automation_execution_logs;
CREATE POLICY "automation_execution_logs_update_org" ON public.automation_execution_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "execution_logs_select_org" ON public.automation_execution_logs;
CREATE POLICY "execution_logs_select_org" ON public.automation_execution_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automation_exec_org_select" ON public.automation_executions;
CREATE POLICY "automation_exec_org_select" ON public.automation_executions AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_rules_delete_org" ON public.automation_rules;
CREATE POLICY "automation_rules_delete_org" ON public.automation_rules AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automation_rules_insert_org" ON public.automation_rules;
CREATE POLICY "automation_rules_insert_org" ON public.automation_rules AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automation_rules_select_org" ON public.automation_rules;
CREATE POLICY "automation_rules_select_org" ON public.automation_rules AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automation_rules_update_org" ON public.automation_rules;
CREATE POLICY "automation_rules_update_org" ON public.automation_rules AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automation_scheduled_tasks_delete_org" ON public.automation_scheduled_tasks;
CREATE POLICY "automation_scheduled_tasks_delete_org" ON public.automation_scheduled_tasks AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_scheduled_tasks_insert_org" ON public.automation_scheduled_tasks;
CREATE POLICY "automation_scheduled_tasks_insert_org" ON public.automation_scheduled_tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_scheduled_tasks_select_org" ON public.automation_scheduled_tasks;
CREATE POLICY "automation_scheduled_tasks_select_org" ON public.automation_scheduled_tasks AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "automation_scheduled_tasks_update_org" ON public.automation_scheduled_tasks;
CREATE POLICY "automation_scheduled_tasks_update_org" ON public.automation_scheduled_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "scheduled_tasks_select_org" ON public.automation_scheduled_tasks;
CREATE POLICY "scheduled_tasks_select_org" ON public.automation_scheduled_tasks AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "automations_delete_org" ON public.automations;
CREATE POLICY "automations_delete_org" ON public.automations AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = automations.org_id))));
DROP POLICY IF EXISTS "automations_insert_org" ON public.automations;
CREATE POLICY "automations_insert_org" ON public.automations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = automations.org_id))));
DROP POLICY IF EXISTS "automations_select_org" ON public.automations;
CREATE POLICY "automations_select_org" ON public.automations AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = automations.org_id))));
DROP POLICY IF EXISTS "automations_update_org" ON public.automations;
CREATE POLICY "automations_update_org" ON public.automations AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = automations.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = automations.org_id))));
DROP POLICY IF EXISTS "availabilities_delete_org" ON public.availabilities;
CREATE POLICY "availabilities_delete_org" ON public.availabilities AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "availabilities_insert_org" ON public.availabilities;
CREATE POLICY "availabilities_insert_org" ON public.availabilities AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "availabilities_select_org" ON public.availabilities;
CREATE POLICY "availabilities_select_org" ON public.availabilities AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "availabilities_update_org" ON public.availabilities;
CREATE POLICY "availabilities_update_org" ON public.availabilities AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "board_comments_delete" ON public.board_comments;
CREATE POLICY "board_comments_delete" ON public.board_comments AS PERMISSIVE FOR DELETE TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "board_comments_insert" ON public.board_comments;
CREATE POLICY "board_comments_insert" ON public.board_comments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_comments.board_id)))));
DROP POLICY IF EXISTS "board_comments_select" ON public.board_comments;
CREATE POLICY "board_comments_select" ON public.board_comments AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_comments.board_id))));
DROP POLICY IF EXISTS "board_comments_update" ON public.board_comments;
CREATE POLICY "board_comments_update" ON public.board_comments AS PERMISSIVE FOR UPDATE TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "board_drawings_delete" ON public.board_drawings;
CREATE POLICY "board_drawings_delete" ON public.board_drawings AS PERMISSIVE FOR DELETE TO public USING (((select auth.uid()) = created_by));
DROP POLICY IF EXISTS "board_drawings_insert" ON public.board_drawings;
CREATE POLICY "board_drawings_insert" ON public.board_drawings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_drawings.board_id)))));
DROP POLICY IF EXISTS "board_drawings_select" ON public.board_drawings;
CREATE POLICY "board_drawings_select" ON public.board_drawings AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_drawings.board_id))));
DROP POLICY IF EXISTS "board_members_delete" ON public.board_members;
CREATE POLICY "board_members_delete" ON public.board_members AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM board_members bm
  WHERE ((bm.board_id = board_members.board_id) AND (bm.user_id = (select auth.uid())) AND (bm.role = 'owner'::text)))));
DROP POLICY IF EXISTS "board_members_insert" ON public.board_members;
CREATE POLICY "board_members_insert" ON public.board_members AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM board_members bm
  WHERE ((bm.board_id = board_members.board_id) AND (bm.user_id = (select auth.uid())) AND (bm.role = 'owner'::text)))));
DROP POLICY IF EXISTS "board_members_select" ON public.board_members;
CREATE POLICY "board_members_select" ON public.board_members AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_members.board_id))));
DROP POLICY IF EXISTS "board_votes_delete" ON public.board_votes;
CREATE POLICY "board_votes_delete" ON public.board_votes AS PERMISSIVE FOR DELETE TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "board_votes_insert" ON public.board_votes;
CREATE POLICY "board_votes_insert" ON public.board_votes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_votes.board_id)))));
DROP POLICY IF EXISTS "board_votes_select" ON public.board_votes;
CREATE POLICY "board_votes_select" ON public.board_votes AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (note_boards nb
     JOIN memberships m ON (((m.org_id = nb.org_id) AND (m.user_id = (select auth.uid())))))
  WHERE (nb.id = board_votes.board_id))));
DROP POLICY IF EXISTS "client_tags_delete" ON public.client_tags;
CREATE POLICY "client_tags_delete" ON public.client_tags AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN memberships m ON ((m.org_id = c.org_id)))
  WHERE ((c.id = client_tags.client_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "client_tags_insert" ON public.client_tags;
CREATE POLICY "client_tags_insert" ON public.client_tags AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN memberships m ON ((m.org_id = c.org_id)))
  WHERE ((c.id = client_tags.client_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "client_tags_select" ON public.client_tags;
CREATE POLICY "client_tags_select" ON public.client_tags AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN memberships m ON ((m.org_id = c.org_id)))
  WHERE ((c.id = client_tags.client_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "clients_delete_org" ON public.clients;
CREATE POLICY "clients_delete_org" ON public.clients AS PERMISSIVE FOR DELETE TO authenticated USING ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "clients_insert_fix" ON public.clients;
CREATE POLICY "clients_insert_fix" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = clients.org_id)))));
DROP POLICY IF EXISTS "clients_insert_org" ON public.clients;
CREATE POLICY "clients_insert_org" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "clients_select_fix" ON public.clients;
CREATE POLICY "clients_select_fix" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = clients.org_id)))));
DROP POLICY IF EXISTS "clients_select_org" ON public.clients;
CREATE POLICY "clients_select_org" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "clients_select_org_member" ON public.clients;
CREATE POLICY "clients_select_org_member" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "clients_update_fix" ON public.clients;
CREATE POLICY "clients_update_fix" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = clients.org_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = clients.org_id)))));
DROP POLICY IF EXISTS "clients_update_org" ON public.clients;
CREATE POLICY "clients_update_org" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "clients_write_org_admin" ON public.clients;
CREATE POLICY "clients_write_org_admin" ON public.clients AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "comm_channels_org_access" ON public.communication_channels;
CREATE POLICY "comm_channels_org_access" ON public.communication_channels AS PERMISSIVE FOR ALL TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "comm_messages_org_access" ON public.communication_messages;
CREATE POLICY "comm_messages_org_access" ON public.communication_messages AS PERMISSIVE FOR ALL TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "comm_settings_org_access" ON public.communication_settings;
CREATE POLICY "comm_settings_org_access" ON public.communication_settings AS PERMISSIVE FOR ALL TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "company_settings_delete_org" ON public.company_settings;
CREATE POLICY "company_settings_delete_org" ON public.company_settings AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = company_settings.org_id))));
DROP POLICY IF EXISTS "company_settings_insert_org" ON public.company_settings;
CREATE POLICY "company_settings_insert_org" ON public.company_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = company_settings.org_id))));
DROP POLICY IF EXISTS "company_settings_select_org" ON public.company_settings;
CREATE POLICY "company_settings_select_org" ON public.company_settings AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = company_settings.org_id))));
DROP POLICY IF EXISTS "company_settings_update_org" ON public.company_settings;
CREATE POLICY "company_settings_update_org" ON public.company_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = company_settings.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = company_settings.org_id))));
DROP POLICY IF EXISTS "connected_accounts_delete_org" ON public.connected_accounts;
CREATE POLICY "connected_accounts_delete_org" ON public.connected_accounts AS PERMISSIVE FOR DELETE TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = connected_accounts.org_id))))));
DROP POLICY IF EXISTS "connected_accounts_insert_org" ON public.connected_accounts;
CREATE POLICY "connected_accounts_insert_org" ON public.connected_accounts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = connected_accounts.org_id))))));
DROP POLICY IF EXISTS "connected_accounts_select_org" ON public.connected_accounts;
CREATE POLICY "connected_accounts_select_org" ON public.connected_accounts AS PERMISSIVE FOR SELECT TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = connected_accounts.org_id))))));
DROP POLICY IF EXISTS "connected_accounts_update_org" ON public.connected_accounts;
CREATE POLICY "connected_accounts_update_org" ON public.connected_accounts AS PERMISSIVE FOR UPDATE TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = connected_accounts.org_id))))));
DROP POLICY IF EXISTS "contacts_delete_org" ON public.contacts;
CREATE POLICY "contacts_delete_org" ON public.contacts AS PERMISSIVE FOR DELETE TO authenticated USING (((org_id IS NOT NULL) AND (org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "contacts_insert_org" ON public.contacts;
CREATE POLICY "contacts_insert_org" ON public.contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "contacts_select_org" ON public.contacts;
CREATE POLICY "contacts_select_org" ON public.contacts AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "contacts_update_org" ON public.contacts;
CREATE POLICY "contacts_update_org" ON public.contacts AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "conversations_delete_org" ON public.conversations;
CREATE POLICY "conversations_delete_org" ON public.conversations AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = conversations.org_id))));
DROP POLICY IF EXISTS "conversations_insert_org" ON public.conversations;
CREATE POLICY "conversations_insert_org" ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = conversations.org_id))));
DROP POLICY IF EXISTS "conversations_select_org" ON public.conversations;
CREATE POLICY "conversations_select_org" ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = conversations.org_id))));
DROP POLICY IF EXISTS "conversations_update_org" ON public.conversations;
CREATE POLICY "conversations_update_org" ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = conversations.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = conversations.org_id))));
DROP POLICY IF EXISTS "custom_column_values_delete" ON public.custom_column_values;
CREATE POLICY "custom_column_values_delete" ON public.custom_column_values AS PERMISSIVE FOR DELETE TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_column_values_delete_org" ON public.custom_column_values;
CREATE POLICY "custom_column_values_delete_org" ON public.custom_column_values AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_column_values_insert" ON public.custom_column_values;
CREATE POLICY "custom_column_values_insert" ON public.custom_column_values AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_column_values_insert_org" ON public.custom_column_values;
CREATE POLICY "custom_column_values_insert_org" ON public.custom_column_values AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_column_values_select" ON public.custom_column_values;
CREATE POLICY "custom_column_values_select" ON public.custom_column_values AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_column_values_select_org" ON public.custom_column_values;
CREATE POLICY "custom_column_values_select_org" ON public.custom_column_values AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_column_values_update" ON public.custom_column_values;
CREATE POLICY "custom_column_values_update" ON public.custom_column_values AS PERMISSIVE FOR UPDATE TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_column_values_update_org" ON public.custom_column_values;
CREATE POLICY "custom_column_values_update_org" ON public.custom_column_values AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_columns_delete" ON public.custom_columns;
CREATE POLICY "custom_columns_delete" ON public.custom_columns AS PERMISSIVE FOR DELETE TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_columns_delete_org" ON public.custom_columns;
CREATE POLICY "custom_columns_delete_org" ON public.custom_columns AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_columns_insert" ON public.custom_columns;
CREATE POLICY "custom_columns_insert" ON public.custom_columns AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_columns_insert_org" ON public.custom_columns;
CREATE POLICY "custom_columns_insert_org" ON public.custom_columns AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_columns_select" ON public.custom_columns;
CREATE POLICY "custom_columns_select" ON public.custom_columns AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_columns_select_org" ON public.custom_columns;
CREATE POLICY "custom_columns_select_org" ON public.custom_columns AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "custom_columns_update" ON public.custom_columns;
CREATE POLICY "custom_columns_update" ON public.custom_columns AS PERMISSIVE FOR UPDATE TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "custom_columns_update_org" ON public.custom_columns;
CREATE POLICY "custom_columns_update_org" ON public.custom_columns AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_creative_directions_delete" ON public.director_creative_directions;
CREATE POLICY "director_creative_directions_delete" ON public.director_creative_directions AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_creative_directions_insert" ON public.director_creative_directions;
CREATE POLICY "director_creative_directions_insert" ON public.director_creative_directions AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_creative_directions_select" ON public.director_creative_directions;
CREATE POLICY "director_creative_directions_select" ON public.director_creative_directions AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_creative_directions_update" ON public.director_creative_directions;
CREATE POLICY "director_creative_directions_update" ON public.director_creative_directions AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_edges_delete" ON public.director_edges;
CREATE POLICY "director_edges_delete" ON public.director_edges AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_edges_insert" ON public.director_edges;
CREATE POLICY "director_edges_insert" ON public.director_edges AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_edges_select" ON public.director_edges;
CREATE POLICY "director_edges_select" ON public.director_edges AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_edges_update" ON public.director_edges;
CREATE POLICY "director_edges_update" ON public.director_edges AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flow_links_delete" ON public.director_flow_links;
CREATE POLICY "director_flow_links_delete" ON public.director_flow_links AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flow_links_insert" ON public.director_flow_links;
CREATE POLICY "director_flow_links_insert" ON public.director_flow_links AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flow_links_select" ON public.director_flow_links;
CREATE POLICY "director_flow_links_select" ON public.director_flow_links AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flow_links_update" ON public.director_flow_links;
CREATE POLICY "director_flow_links_update" ON public.director_flow_links AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flows_delete" ON public.director_flows;
CREATE POLICY "director_flows_delete" ON public.director_flows AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flows_insert" ON public.director_flows;
CREATE POLICY "director_flows_insert" ON public.director_flows AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flows_select" ON public.director_flows;
CREATE POLICY "director_flows_select" ON public.director_flows AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_flows_update" ON public.director_flows;
CREATE POLICY "director_flows_update" ON public.director_flows AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_generations_delete" ON public.director_generations;
CREATE POLICY "director_generations_delete" ON public.director_generations AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_generations_insert" ON public.director_generations;
CREATE POLICY "director_generations_insert" ON public.director_generations AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_generations_select" ON public.director_generations;
CREATE POLICY "director_generations_select" ON public.director_generations AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_generations_update" ON public.director_generations;
CREATE POLICY "director_generations_update" ON public.director_generations AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_nodes_delete" ON public.director_nodes;
CREATE POLICY "director_nodes_delete" ON public.director_nodes AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_nodes_insert" ON public.director_nodes;
CREATE POLICY "director_nodes_insert" ON public.director_nodes AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_nodes_select" ON public.director_nodes;
CREATE POLICY "director_nodes_select" ON public.director_nodes AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_nodes_update" ON public.director_nodes;
CREATE POLICY "director_nodes_update" ON public.director_nodes AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_run_steps_delete" ON public.director_run_steps;
CREATE POLICY "director_run_steps_delete" ON public.director_run_steps AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_run_steps_insert" ON public.director_run_steps;
CREATE POLICY "director_run_steps_insert" ON public.director_run_steps AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_run_steps_select" ON public.director_run_steps;
CREATE POLICY "director_run_steps_select" ON public.director_run_steps AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_run_steps_update" ON public.director_run_steps;
CREATE POLICY "director_run_steps_update" ON public.director_run_steps AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_runs_delete" ON public.director_runs;
CREATE POLICY "director_runs_delete" ON public.director_runs AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_runs_insert" ON public.director_runs;
CREATE POLICY "director_runs_insert" ON public.director_runs AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_runs_select" ON public.director_runs;
CREATE POLICY "director_runs_select" ON public.director_runs AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_runs_update" ON public.director_runs;
CREATE POLICY "director_runs_update" ON public.director_runs AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_style_dna_delete" ON public.director_style_dna;
CREATE POLICY "director_style_dna_delete" ON public.director_style_dna AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_style_dna_insert" ON public.director_style_dna;
CREATE POLICY "director_style_dna_insert" ON public.director_style_dna AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_style_dna_select" ON public.director_style_dna;
CREATE POLICY "director_style_dna_select" ON public.director_style_dna AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_style_dna_update" ON public.director_style_dna;
CREATE POLICY "director_style_dna_update" ON public.director_style_dna AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_templates_delete" ON public.director_templates;
CREATE POLICY "director_templates_delete" ON public.director_templates AS PERMISSIVE FOR DELETE TO public USING ((((org_id IS NULL) AND ((select auth.uid()) IS NOT NULL)) OR ((org_id IS NOT NULL) AND has_org_membership((select auth.uid()), org_id))));
DROP POLICY IF EXISTS "director_templates_insert" ON public.director_templates;
CREATE POLICY "director_templates_insert" ON public.director_templates AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((org_id IS NULL) AND ((select auth.uid()) IS NOT NULL)) OR ((org_id IS NOT NULL) AND has_org_membership((select auth.uid()), org_id))));
DROP POLICY IF EXISTS "director_templates_select_global" ON public.director_templates;
CREATE POLICY "director_templates_select_global" ON public.director_templates AS PERMISSIVE FOR SELECT TO public USING (((org_id IS NULL) AND ((select auth.uid()) IS NOT NULL)));
DROP POLICY IF EXISTS "director_templates_select_org" ON public.director_templates;
CREATE POLICY "director_templates_select_org" ON public.director_templates AS PERMISSIVE FOR SELECT TO public USING (((org_id IS NOT NULL) AND has_org_membership((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "director_templates_update" ON public.director_templates;
CREATE POLICY "director_templates_update" ON public.director_templates AS PERMISSIVE FOR UPDATE TO public USING ((((org_id IS NULL) AND ((select auth.uid()) IS NOT NULL)) OR ((org_id IS NOT NULL) AND has_org_membership((select auth.uid()), org_id)))) WITH CHECK ((((org_id IS NULL) AND ((select auth.uid()) IS NOT NULL)) OR ((org_id IS NOT NULL) AND has_org_membership((select auth.uid()), org_id))));
DROP POLICY IF EXISTS "director_usage_events_insert" ON public.director_usage_events;
CREATE POLICY "director_usage_events_insert" ON public.director_usage_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "director_usage_events_select" ON public.director_usage_events;
CREATE POLICY "director_usage_events_select" ON public.director_usage_events AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "email_templates_delete_org" ON public.email_templates;
CREATE POLICY "email_templates_delete_org" ON public.email_templates AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "email_templates_insert_org" ON public.email_templates;
CREATE POLICY "email_templates_insert_org" ON public.email_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "email_templates_select_org" ON public.email_templates;
CREATE POLICY "email_templates_select_org" ON public.email_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "email_templates_update_org" ON public.email_templates;
CREATE POLICY "email_templates_update_org" ON public.email_templates AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "entity_comments_author_update" ON public.entity_comments;
CREATE POLICY "entity_comments_author_update" ON public.entity_comments AS PERMISSIVE FOR UPDATE TO public USING (((author_id = (select auth.uid())) OR has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "entity_comments_org_insert" ON public.entity_comments;
CREATE POLICY "entity_comments_org_insert" ON public.entity_comments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (author_id = (select auth.uid()))));
DROP POLICY IF EXISTS "entity_comments_org_select" ON public.entity_comments;
CREATE POLICY "entity_comments_org_select" ON public.entity_comments AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "entity_tags_org_manage" ON public.entity_tags;
CREATE POLICY "entity_tags_org_manage" ON public.entity_tags AS PERMISSIVE FOR ALL TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "entity_tags_org_select" ON public.entity_tags;
CREATE POLICY "entity_tags_org_select" ON public.entity_tags AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "geofences_org" ON public.geofences;
CREATE POLICY "geofences_org" ON public.geofences AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "gps_providers_org" ON public.gps_providers;
CREATE POLICY "gps_providers_org" ON public.gps_providers AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "audit_logs_insert_own_org" ON public.integration_audit_logs;
CREATE POLICY "audit_logs_insert_own_org" ON public.integration_audit_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "audit_logs_select_own_org" ON public.integration_audit_logs;
CREATE POLICY "audit_logs_select_own_org" ON public.integration_audit_logs AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "integration_audit_logs_delete_org" ON public.integration_audit_logs;
CREATE POLICY "integration_audit_logs_delete_org" ON public.integration_audit_logs AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_audit_logs_insert_org" ON public.integration_audit_logs;
CREATE POLICY "integration_audit_logs_insert_org" ON public.integration_audit_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_audit_logs_select_org" ON public.integration_audit_logs;
CREATE POLICY "integration_audit_logs_select_org" ON public.integration_audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_audit_logs_update_org" ON public.integration_audit_logs;
CREATE POLICY "integration_audit_logs_update_org" ON public.integration_audit_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_oauth_states_delete_org" ON public.integration_oauth_states;
CREATE POLICY "integration_oauth_states_delete_org" ON public.integration_oauth_states AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_oauth_states_insert_org" ON public.integration_oauth_states;
CREATE POLICY "integration_oauth_states_insert_org" ON public.integration_oauth_states AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_oauth_states_select_org" ON public.integration_oauth_states;
CREATE POLICY "integration_oauth_states_select_org" ON public.integration_oauth_states AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "integration_oauth_states_update_org" ON public.integration_oauth_states;
CREATE POLICY "integration_oauth_states_update_org" ON public.integration_oauth_states AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "oauth_states_insert_own_org" ON public.integration_oauth_states;
CREATE POLICY "oauth_states_insert_own_org" ON public.integration_oauth_states AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "oauth_states_select_own_org" ON public.integration_oauth_states;
CREATE POLICY "oauth_states_select_own_org" ON public.integration_oauth_states AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "invoice_items_delete_org" ON public.invoice_items;
CREATE POLICY "invoice_items_delete_org" ON public.invoice_items AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_items_insert_org" ON public.invoice_items;
CREATE POLICY "invoice_items_insert_org" ON public.invoice_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_items_select_org" ON public.invoice_items;
CREATE POLICY "invoice_items_select_org" ON public.invoice_items AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_items_select_org_member" ON public.invoice_items;
CREATE POLICY "invoice_items_select_org_member" ON public.invoice_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = invoice_items.invoice_id) AND (i.deleted_at IS NULL) AND crm_is_org_member(i.org_id, (select auth.uid()))))));
DROP POLICY IF EXISTS "invoice_items_update_org" ON public.invoice_items;
CREATE POLICY "invoice_items_update_org" ON public.invoice_items AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_items_write_org_admin" ON public.invoice_items;
CREATE POLICY "invoice_items_write_org_admin" ON public.invoice_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = invoice_items.invoice_id) AND crm_is_org_admin(i.org_id, (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = invoice_items.invoice_id) AND crm_is_org_admin(i.org_id, (select auth.uid()))))));
DROP POLICY IF EXISTS "ise_insert_org" ON public.invoice_send_events;
CREATE POLICY "ise_insert_org" ON public.invoice_send_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "ise_select_org" ON public.invoice_send_events;
CREATE POLICY "ise_select_org" ON public.invoice_send_events AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_sequences_select_org" ON public.invoice_sequences;
CREATE POLICY "invoice_sequences_select_org" ON public.invoice_sequences AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "invoice_sequences_update_only" ON public.invoice_sequences;
CREATE POLICY "invoice_sequences_update_only" ON public.invoice_sequences AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "invoice_sequences_upsert_org" ON public.invoice_sequences;
CREATE POLICY "invoice_sequences_upsert_org" ON public.invoice_sequences AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "invoice_templates_delete_org" ON public.invoice_templates;
CREATE POLICY "invoice_templates_delete_org" ON public.invoice_templates AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_templates_insert_org" ON public.invoice_templates;
CREATE POLICY "invoice_templates_insert_org" ON public.invoice_templates AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_templates_select_org" ON public.invoice_templates;
CREATE POLICY "invoice_templates_select_org" ON public.invoice_templates AS PERMISSIVE FOR SELECT TO public USING ((has_org_membership((select auth.uid()), org_id) OR ((org_id IS NULL) AND (is_system_template = true))));
DROP POLICY IF EXISTS "invoice_templates_select_org_member" ON public.invoice_templates;
CREATE POLICY "invoice_templates_select_org_member" ON public.invoice_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "invoice_templates_update_org" ON public.invoice_templates;
CREATE POLICY "invoice_templates_update_org" ON public.invoice_templates AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoice_templates_write_org_admin" ON public.invoice_templates;
CREATE POLICY "invoice_templates_write_org_admin" ON public.invoice_templates AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "invoices_delete_org" ON public.invoices;
CREATE POLICY "invoices_delete_org" ON public.invoices AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "invoices_insert_org" ON public.invoices;
CREATE POLICY "invoices_insert_org" ON public.invoices AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = invoices.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "invoices_select_org" ON public.invoices;
CREATE POLICY "invoices_select_org" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = invoices.org_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "invoices_select_org_member" ON public.invoices;
CREATE POLICY "invoices_select_org_member" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "invoices_update_org" ON public.invoices;
CREATE POLICY "invoices_update_org" ON public.invoices AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = invoices.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = invoices.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "invoices_write_org_admin" ON public.invoices;
CREATE POLICY "invoices_write_org_admin" ON public.invoices AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "job_intents_delete_org" ON public.job_intents;
CREATE POLICY "job_intents_delete_org" ON public.job_intents AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_intents_insert_org" ON public.job_intents;
CREATE POLICY "job_intents_insert_org" ON public.job_intents AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_intents_select_org" ON public.job_intents;
CREATE POLICY "job_intents_select_org" ON public.job_intents AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_intents_update_org" ON public.job_intents;
CREATE POLICY "job_intents_update_org" ON public.job_intents AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_line_items_delete_org" ON public.job_line_items;
CREATE POLICY "job_line_items_delete_org" ON public.job_line_items AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_line_items_insert_org" ON public.job_line_items;
CREATE POLICY "job_line_items_insert_org" ON public.job_line_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "job_line_items_select" ON public.job_line_items;
CREATE POLICY "job_line_items_select" ON public.job_line_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM jobs j
  WHERE ((j.id = job_line_items.job_id) AND (j.deleted_at IS NULL) AND (EXISTS ( SELECT 1
           FROM memberships m
          WHERE ((m.org_id = j.org_id) AND (m.user_id = (select auth.uid())))))))));
DROP POLICY IF EXISTS "job_line_items_select_org" ON public.job_line_items;
CREATE POLICY "job_line_items_select_org" ON public.job_line_items AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_line_items_update_org" ON public.job_line_items;
CREATE POLICY "job_line_items_update_org" ON public.job_line_items AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_line_items_write" ON public.job_line_items;
CREATE POLICY "job_line_items_write" ON public.job_line_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM jobs j
  WHERE ((j.id = job_line_items.job_id) AND (EXISTS ( SELECT 1
           FROM memberships m
          WHERE ((m.org_id = j.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM jobs j
  WHERE ((j.id = job_line_items.job_id) AND (EXISTS ( SELECT 1
           FROM memberships m
          WHERE ((m.org_id = j.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))));
DROP POLICY IF EXISTS "job_recurrence_org" ON public.job_recurrence_rules;
CREATE POLICY "job_recurrence_org" ON public.job_recurrence_rules AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = job_recurrence_rules.org_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "job_recurrence_rules_delete_org" ON public.job_recurrence_rules;
CREATE POLICY "job_recurrence_rules_delete_org" ON public.job_recurrence_rules AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_recurrence_rules_insert_org" ON public.job_recurrence_rules;
CREATE POLICY "job_recurrence_rules_insert_org" ON public.job_recurrence_rules AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_recurrence_rules_select_org" ON public.job_recurrence_rules;
CREATE POLICY "job_recurrence_rules_select_org" ON public.job_recurrence_rules AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_recurrence_rules_update_org" ON public.job_recurrence_rules;
CREATE POLICY "job_recurrence_rules_update_org" ON public.job_recurrence_rules AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_templates_delete_org" ON public.job_templates;
CREATE POLICY "job_templates_delete_org" ON public.job_templates AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_templates_insert_org" ON public.job_templates;
CREATE POLICY "job_templates_insert_org" ON public.job_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_templates_org" ON public.job_templates;
CREATE POLICY "job_templates_org" ON public.job_templates AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = job_templates.org_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "job_templates_select_org" ON public.job_templates;
CREATE POLICY "job_templates_select_org" ON public.job_templates AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "job_templates_update_org" ON public.job_templates;
CREATE POLICY "job_templates_update_org" ON public.job_templates AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
CREATE POLICY "jobs_delete" ON public.jobs AS PERMISSIVE FOR DELETE TO public USING (((select auth.uid()) = org_id));
DROP POLICY IF EXISTS "jobs_delete_org" ON public.jobs;
CREATE POLICY "jobs_delete_org" ON public.jobs AS PERMISSIVE FOR DELETE TO authenticated USING ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
CREATE POLICY "jobs_insert" ON public.jobs AS PERMISSIVE FOR INSERT TO public WITH CHECK (((select auth.uid()) = org_id));
DROP POLICY IF EXISTS "jobs_insert_org" ON public.jobs;
CREATE POLICY "jobs_insert_org" ON public.jobs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs AS PERMISSIVE FOR SELECT TO public USING (((select auth.uid()) = org_id));
DROP POLICY IF EXISTS "jobs_select_org" ON public.jobs;
CREATE POLICY "jobs_select_org" ON public.jobs AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "jobs_select_org_member" ON public.jobs;
CREATE POLICY "jobs_select_org_member" ON public.jobs AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
CREATE POLICY "jobs_update" ON public.jobs AS PERMISSIVE FOR UPDATE TO public USING (((select auth.uid()) = org_id));
DROP POLICY IF EXISTS "jobs_update_org" ON public.jobs;
CREATE POLICY "jobs_update_org" ON public.jobs AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_admin_role((select auth.uid()), org_id)) WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "jobs_write_org_admin" ON public.jobs;
CREATE POLICY "jobs_write_org_admin" ON public.jobs AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "leads_delete_org" ON public.leads;
CREATE POLICY "leads_delete_org" ON public.leads AS PERMISSIVE FOR DELETE TO authenticated USING ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "leads_insert_org" ON public.leads;
CREATE POLICY "leads_insert_org" ON public.leads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "leads_select_org" ON public.leads;
CREATE POLICY "leads_select_org" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "leads_select_org_member" ON public.leads;
CREATE POLICY "leads_select_org_member" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "leads_update_org" ON public.leads;
CREATE POLICY "leads_update_org" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id))) WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "leads_write_org_admin" ON public.leads;
CREATE POLICY "leads_write_org_admin" ON public.leads AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "Own data only" ON public.lists;
CREATE POLICY "Own data only" ON public.lists AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "memberships_delete_org" ON public.memberships;
CREATE POLICY "memberships_delete_org" ON public.memberships AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT user_org_ids((select auth.uid())) AS user_org_ids)));
DROP POLICY IF EXISTS "memberships_insert_org" ON public.memberships;
CREATE POLICY "memberships_insert_org" ON public.memberships AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT user_org_ids((select auth.uid())) AS user_org_ids)));
DROP POLICY IF EXISTS "memberships_insert_owner_bootstrap" ON public.memberships;
CREATE POLICY "memberships_insert_owner_bootstrap" ON public.memberships AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = (select auth.uid())) AND (role = 'owner'::text) AND (EXISTS ( SELECT 1
   FROM orgs o
  WHERE ((o.id = memberships.org_id) AND (COALESCE(o.created_by, (select auth.uid())) = (select auth.uid()))))) AND (NOT (EXISTS ( SELECT 1
   FROM memberships m
  WHERE (m.org_id = memberships.org_id))))));
DROP POLICY IF EXISTS "memberships_select_own_org" ON public.memberships;
CREATE POLICY "memberships_select_own_org" ON public.memberships AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT user_org_ids((select auth.uid())) AS user_org_ids)));
DROP POLICY IF EXISTS "memberships_select_self_or_admin" ON public.memberships;
CREATE POLICY "memberships_select_self_or_admin" ON public.memberships AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = (select auth.uid())) OR has_org_role((select auth.uid()), org_id, ARRAY['owner'::text, 'admin'::text])));
DROP POLICY IF EXISTS "memberships_update_org" ON public.memberships;
CREATE POLICY "memberships_update_org" ON public.memberships AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT user_org_ids((select auth.uid())) AS user_org_ids))) WITH CHECK ((org_id IN ( SELECT user_org_ids((select auth.uid())) AS user_org_ids)));
DROP POLICY IF EXISTS "messages_delete_org" ON public.messages;
CREATE POLICY "messages_delete_org" ON public.messages AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = messages.org_id))));
DROP POLICY IF EXISTS "messages_insert_org" ON public.messages;
CREATE POLICY "messages_insert_org" ON public.messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = messages.org_id))));
DROP POLICY IF EXISTS "messages_select_org" ON public.messages;
CREATE POLICY "messages_select_org" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = messages.org_id))));
DROP POLICY IF EXISTS "messages_update_org" ON public.messages;
CREATE POLICY "messages_update_org" ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = messages.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = messages.org_id))));
DROP POLICY IF EXISTS "note_boards_delete" ON public.note_boards;
CREATE POLICY "note_boards_delete" ON public.note_boards AS PERMISSIVE FOR DELETE TO public USING ((created_by = (select auth.uid())));
DROP POLICY IF EXISTS "note_boards_delete_org" ON public.note_boards;
CREATE POLICY "note_boards_delete_org" ON public.note_boards AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "note_boards_insert" ON public.note_boards;
CREATE POLICY "note_boards_insert" ON public.note_boards AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "note_boards_insert_org" ON public.note_boards;
CREATE POLICY "note_boards_insert_org" ON public.note_boards AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "note_boards_select" ON public.note_boards;
CREATE POLICY "note_boards_select" ON public.note_boards AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "note_boards_select_org" ON public.note_boards;
CREATE POLICY "note_boards_select_org" ON public.note_boards AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "note_boards_update" ON public.note_boards;
CREATE POLICY "note_boards_update" ON public.note_boards AS PERMISSIVE FOR UPDATE TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "note_boards_update_org" ON public.note_boards;
CREATE POLICY "note_boards_update_org" ON public.note_boards AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "note_connections_delete" ON public.note_connections;
CREATE POLICY "note_connections_delete" ON public.note_connections AS PERMISSIVE FOR DELETE TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_connections_insert" ON public.note_connections;
CREATE POLICY "note_connections_insert" ON public.note_connections AS PERMISSIVE FOR INSERT TO public WITH CHECK ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_connections_select" ON public.note_connections;
CREATE POLICY "note_connections_select" ON public.note_connections AS PERMISSIVE FOR SELECT TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_connections_update" ON public.note_connections;
CREATE POLICY "note_connections_update" ON public.note_connections AS PERMISSIVE FOR UPDATE TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_entity_links_delete" ON public.note_entity_links;
CREATE POLICY "note_entity_links_delete" ON public.note_entity_links AS PERMISSIVE FOR DELETE TO public USING ((item_id IN ( SELECT ni.id
   FROM (note_items ni
     JOIN note_boards nb ON ((nb.id = ni.board_id)))
  WHERE (nb.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_entity_links_insert" ON public.note_entity_links;
CREATE POLICY "note_entity_links_insert" ON public.note_entity_links AS PERMISSIVE FOR INSERT TO public WITH CHECK ((item_id IN ( SELECT ni.id
   FROM (note_items ni
     JOIN note_boards nb ON ((nb.id = ni.board_id)))
  WHERE (nb.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_entity_links_select" ON public.note_entity_links;
CREATE POLICY "note_entity_links_select" ON public.note_entity_links AS PERMISSIVE FOR SELECT TO public USING ((item_id IN ( SELECT ni.id
   FROM (note_items ni
     JOIN note_boards nb ON ((nb.id = ni.board_id)))
  WHERE (nb.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_history_insert" ON public.note_history;
CREATE POLICY "note_history_insert" ON public.note_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_history_select" ON public.note_history;
CREATE POLICY "note_history_select" ON public.note_history AS PERMISSIVE FOR SELECT TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_items_delete" ON public.note_items;
CREATE POLICY "note_items_delete" ON public.note_items AS PERMISSIVE FOR DELETE TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_items_insert" ON public.note_items;
CREATE POLICY "note_items_insert" ON public.note_items AS PERMISSIVE FOR INSERT TO public WITH CHECK ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_items_select" ON public.note_items;
CREATE POLICY "note_items_select" ON public.note_items AS PERMISSIVE FOR SELECT TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "note_items_update" ON public.note_items;
CREATE POLICY "note_items_update" ON public.note_items AS PERMISSIVE FOR UPDATE TO public USING ((board_id IN ( SELECT note_boards.id
   FROM note_boards
  WHERE (note_boards.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_delete_org" ON public.notes;
CREATE POLICY "notes_delete_org" ON public.notes AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "notes_insert_org" ON public.notes;
CREATE POLICY "notes_insert_org" ON public.notes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "notes_select_org" ON public.notes;
CREATE POLICY "notes_select_org" ON public.notes AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "notes_update_org" ON public.notes;
CREATE POLICY "notes_update_org" ON public.notes AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid()))))) WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "notes_checklist_delete" ON public.notes_checklist;
CREATE POLICY "notes_checklist_delete" ON public.notes_checklist AS PERMISSIVE FOR DELETE TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_checklist_insert" ON public.notes_checklist;
CREATE POLICY "notes_checklist_insert" ON public.notes_checklist AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_checklist_select" ON public.notes_checklist;
CREATE POLICY "notes_checklist_select" ON public.notes_checklist AS PERMISSIVE FOR SELECT TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_checklist_update" ON public.notes_checklist;
CREATE POLICY "notes_checklist_update" ON public.notes_checklist AS PERMISSIVE FOR UPDATE TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_files_delete" ON public.notes_files;
CREATE POLICY "notes_files_delete" ON public.notes_files AS PERMISSIVE FOR DELETE TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_files_insert" ON public.notes_files;
CREATE POLICY "notes_files_insert" ON public.notes_files AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_files_select" ON public.notes_files;
CREATE POLICY "notes_files_select" ON public.notes_files AS PERMISSIVE FOR SELECT TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_tags_delete" ON public.notes_tags;
CREATE POLICY "notes_tags_delete" ON public.notes_tags AS PERMISSIVE FOR DELETE TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_tags_insert" ON public.notes_tags;
CREATE POLICY "notes_tags_insert" ON public.notes_tags AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notes_tags_select" ON public.notes_tags;
CREATE POLICY "notes_tags_select" ON public.notes_tags AS PERMISSIVE FOR SELECT TO authenticated USING ((note_id IN ( SELECT notes.id
   FROM notes
  WHERE (notes.org_id IN ( SELECT m.org_id
           FROM memberships m
          WHERE (m.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "notifications_delete_org" ON public.notifications;
CREATE POLICY "notifications_delete_org" ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "notifications_insert_org" ON public.notifications;
CREATE POLICY "notifications_insert_org" ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = notifications.org_id))));
DROP POLICY IF EXISTS "notifications_select_org" ON public.notifications;
CREATE POLICY "notifications_select_org" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = notifications.org_id))));
DROP POLICY IF EXISTS "notifications_select_org_member" ON public.notifications;
CREATE POLICY "notifications_select_org_member" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING (crm_is_org_member(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "notifications_update_org" ON public.notifications;
CREATE POLICY "notifications_update_org" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = notifications.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = notifications.org_id))));
DROP POLICY IF EXISTS "notifications_write_org_admin" ON public.notifications;
CREATE POLICY "notifications_write_org_admin" ON public.notifications AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "object_permissions_admin_manage" ON public.object_permissions;
CREATE POLICY "object_permissions_admin_manage" ON public.object_permissions AS PERMISSIVE FOR ALL TO public USING (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "object_permissions_org_select" ON public.object_permissions;
CREATE POLICY "object_permissions_org_select" ON public.object_permissions AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_billing_settings_insert_admin" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_insert_admin" ON public.org_billing_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_billing_settings_select" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_select" ON public.org_billing_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = org_billing_settings.org_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "org_billing_settings_select_org" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_select_org" ON public.org_billing_settings AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_billing_settings_select_org_member" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_select_org_member" ON public.org_billing_settings AS PERMISSIVE FOR SELECT TO authenticated USING (crm_is_org_member(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "org_billing_settings_update_admin" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_update_admin" ON public.org_billing_settings AS PERMISSIVE FOR UPDATE TO public USING (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_billing_settings_write" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_write" ON public.org_billing_settings AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = org_billing_settings.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = org_billing_settings.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "org_billing_settings_write_org_admin" ON public.org_billing_settings;
CREATE POLICY "org_billing_settings_write_org_admin" ON public.org_billing_settings AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "org_credit_balances_delete" ON public.org_credit_balances;
CREATE POLICY "org_credit_balances_delete" ON public.org_credit_balances AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_balances_insert" ON public.org_credit_balances;
CREATE POLICY "org_credit_balances_insert" ON public.org_credit_balances AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_balances_select" ON public.org_credit_balances;
CREATE POLICY "org_credit_balances_select" ON public.org_credit_balances AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_balances_update" ON public.org_credit_balances;
CREATE POLICY "org_credit_balances_update" ON public.org_credit_balances AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_transactions_delete" ON public.org_credit_transactions;
CREATE POLICY "org_credit_transactions_delete" ON public.org_credit_transactions AS PERMISSIVE FOR DELETE TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_transactions_insert" ON public.org_credit_transactions;
CREATE POLICY "org_credit_transactions_insert" ON public.org_credit_transactions AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_transactions_select" ON public.org_credit_transactions;
CREATE POLICY "org_credit_transactions_select" ON public.org_credit_transactions AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "org_credit_transactions_update" ON public.org_credit_transactions;
CREATE POLICY "org_credit_transactions_update" ON public.org_credit_transactions AS PERMISSIVE FOR UPDATE TO public USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "orgs_delete_owner" ON public.orgs;
CREATE POLICY "orgs_delete_owner" ON public.orgs AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_role((select auth.uid()), id, ARRAY['owner'::text]));
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.orgs;
CREATE POLICY "orgs_insert_authenticated" ON public.orgs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "orgs_select_member" ON public.orgs;
CREATE POLICY "orgs_select_member" ON public.orgs AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), id));
DROP POLICY IF EXISTS "orgs_update_admin" ON public.orgs;
CREATE POLICY "orgs_update_admin" ON public.orgs AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_role((select auth.uid()), id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (has_org_role((select auth.uid()), id, ARRAY['owner'::text, 'admin'::text]));
DROP POLICY IF EXISTS "payment_provider_settings_delete_org" ON public.payment_provider_settings;
CREATE POLICY "payment_provider_settings_delete_org" ON public.payment_provider_settings AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_provider_settings_insert_org" ON public.payment_provider_settings;
CREATE POLICY "payment_provider_settings_insert_org" ON public.payment_provider_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_provider_settings_select_org" ON public.payment_provider_settings;
CREATE POLICY "payment_provider_settings_select_org" ON public.payment_provider_settings AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_provider_settings_update_org" ON public.payment_provider_settings;
CREATE POLICY "payment_provider_settings_update_org" ON public.payment_provider_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_admin_role((select auth.uid()), org_id)) WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pps_delete_admin" ON public.payment_provider_settings;
CREATE POLICY "pps_delete_admin" ON public.payment_provider_settings AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pps_insert_admin" ON public.payment_provider_settings;
CREATE POLICY "pps_insert_admin" ON public.payment_provider_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pps_select_member" ON public.payment_provider_settings;
CREATE POLICY "pps_select_member" ON public.payment_provider_settings AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pps_select_org" ON public.payment_provider_settings;
CREATE POLICY "pps_select_org" ON public.payment_provider_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = payment_provider_settings.org_id) AND (m.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "pps_update_admin" ON public.payment_provider_settings;
CREATE POLICY "pps_update_admin" ON public.payment_provider_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_admin_role((select auth.uid()), org_id)) WITH CHECK (has_org_admin_role((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pps_update_org" ON public.payment_provider_settings;
CREATE POLICY "pps_update_org" ON public.payment_provider_settings AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = payment_provider_settings.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.org_id = payment_provider_settings.org_id) AND (m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
DROP POLICY IF EXISTS "payment_providers_delete_org" ON public.payment_providers;
CREATE POLICY "payment_providers_delete_org" ON public.payment_providers AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_providers_insert_org" ON public.payment_providers;
CREATE POLICY "payment_providers_insert_org" ON public.payment_providers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_providers_select_org" ON public.payment_providers;
CREATE POLICY "payment_providers_select_org" ON public.payment_providers AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_providers_update_org" ON public.payment_providers;
CREATE POLICY "payment_providers_update_org" ON public.payment_providers AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payment_requests_delete_org" ON public.payment_requests;
CREATE POLICY "payment_requests_delete_org" ON public.payment_requests AS PERMISSIVE FOR DELETE TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = payment_requests.org_id))))));
DROP POLICY IF EXISTS "payment_requests_insert_org" ON public.payment_requests;
CREATE POLICY "payment_requests_insert_org" ON public.payment_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = payment_requests.org_id))))));
DROP POLICY IF EXISTS "payment_requests_select_org" ON public.payment_requests;
CREATE POLICY "payment_requests_select_org" ON public.payment_requests AS PERMISSIVE FOR SELECT TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = payment_requests.org_id))))));
DROP POLICY IF EXISTS "payment_requests_update_org" ON public.payment_requests;
CREATE POLICY "payment_requests_update_org" ON public.payment_requests AS PERMISSIVE FOR UPDATE TO public USING (((org_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.org_id = payment_requests.org_id))))));
DROP POLICY IF EXISTS "payments_delete_org" ON public.payments;
CREATE POLICY "payments_delete_org" ON public.payments AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payments_insert_org" ON public.payments;
CREATE POLICY "payments_insert_org" ON public.payments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payments_select_org" ON public.payments;
CREATE POLICY "payments_select_org" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payments_select_org_member" ON public.payments;
CREATE POLICY "payments_select_org_member" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated USING (crm_is_org_member(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "payments_update_org" ON public.payments;
CREATE POLICY "payments_update_org" ON public.payments AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "payments_write_org_admin" ON public.payments;
CREATE POLICY "payments_write_org_admin" ON public.payments AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "pipeline_deals_delete_org" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_delete_org" ON public.pipeline_deals AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_deals_insert_org" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_insert_org" ON public.pipeline_deals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "pipeline_deals_select_org" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_select_org" ON public.pipeline_deals AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_deals_update_org" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_update_org" ON public.pipeline_deals AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_stages_delete_org" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_delete_org" ON public.pipeline_stages AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_stages_insert_org" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_insert_org" ON public.pipeline_stages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_stages_select_org" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select_org" ON public.pipeline_stages AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "pipeline_stages_update_org" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_update_org" ON public.pipeline_stages AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "Own data only" ON public.pipelines;
CREATE POLICY "Own data only" ON public.pipelines AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "predefined_services_delete_org" ON public.predefined_services;
CREATE POLICY "predefined_services_delete_org" ON public.predefined_services AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = predefined_services.org_id))));
DROP POLICY IF EXISTS "predefined_services_insert_org" ON public.predefined_services;
CREATE POLICY "predefined_services_insert_org" ON public.predefined_services AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = predefined_services.org_id))));
DROP POLICY IF EXISTS "predefined_services_select_org" ON public.predefined_services;
CREATE POLICY "predefined_services_select_org" ON public.predefined_services AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = predefined_services.org_id))));
DROP POLICY IF EXISTS "predefined_services_update_org" ON public.predefined_services;
CREATE POLICY "predefined_services_update_org" ON public.predefined_services AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = predefined_services.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = predefined_services.org_id))));
DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles;
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "Own data only" ON public.profiles;
CREATE POLICY "Own data only" ON public.profiles AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((id = (select auth.uid())));
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM (memberships m1
     JOIN memberships m2 ON ((m1.org_id = m2.org_id)))
  WHERE ((m1.user_id = (select auth.uid())) AND (m2.user_id = profiles.id))))));
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((id = (select auth.uid()))) WITH CHECK ((id = (select auth.uid())));
DROP POLICY IF EXISTS "pop_org" ON public.proof_of_presence;
CREATE POLICY "pop_org" ON public.proof_of_presence AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "quote_views_delete_org" ON public.quote_views;
CREATE POLICY "quote_views_delete_org" ON public.quote_views AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = quote_views.invoice_id) AND ((select auth.uid()) IN ( SELECT memberships.user_id
           FROM memberships
          WHERE (memberships.org_id = i.org_id)))))));
DROP POLICY IF EXISTS "quote_views_insert_org" ON public.quote_views;
CREATE POLICY "quote_views_insert_org" ON public.quote_views AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = quote_views.invoice_id) AND ((select auth.uid()) IN ( SELECT memberships.user_id
           FROM memberships
          WHERE (memberships.org_id = i.org_id)))))));
DROP POLICY IF EXISTS "quote_views_select_org" ON public.quote_views;
CREATE POLICY "quote_views_select_org" ON public.quote_views AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = quote_views.invoice_id) AND ((select auth.uid()) IN ( SELECT memberships.user_id
           FROM memberships
          WHERE (memberships.org_id = i.org_id)))))));
DROP POLICY IF EXISTS "quote_views_update_org" ON public.quote_views;
CREATE POLICY "quote_views_update_org" ON public.quote_views AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = quote_views.invoice_id) AND ((select auth.uid()) IN ( SELECT memberships.user_id
           FROM memberships
          WHERE (memberships.org_id = i.org_id))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = quote_views.invoice_id) AND ((select auth.uid()) IN ( SELECT memberships.user_id
           FROM memberships
          WHERE (memberships.org_id = i.org_id)))))));
DROP POLICY IF EXISTS "review_requests_select_org" ON public.review_requests;
CREATE POLICY "review_requests_select_org" ON public.review_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "surveys_select_org" ON public.satisfaction_surveys;
CREATE POLICY "surveys_select_org" ON public.satisfaction_surveys AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "schedule_events_delete_org" ON public.schedule_events;
CREATE POLICY "schedule_events_delete_org" ON public.schedule_events AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "schedule_events_insert_org" ON public.schedule_events;
CREATE POLICY "schedule_events_insert_org" ON public.schedule_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "schedule_events_select_org" ON public.schedule_events;
CREATE POLICY "schedule_events_select_org" ON public.schedule_events AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "schedule_events_select_org_member" ON public.schedule_events;
CREATE POLICY "schedule_events_select_org_member" ON public.schedule_events AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_is_org_member(org_id, (select auth.uid())) AND (deleted_at IS NULL)));
DROP POLICY IF EXISTS "schedule_events_update_org" ON public.schedule_events;
CREATE POLICY "schedule_events_update_org" ON public.schedule_events AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "schedule_events_write_org_admin" ON public.schedule_events;
CREATE POLICY "schedule_events_write_org_admin" ON public.schedule_events AS PERMISSIVE FOR ALL TO authenticated USING (crm_is_org_admin(org_id, (select auth.uid()))) WITH CHECK (crm_is_org_admin(org_id, (select auth.uid())));
DROP POLICY IF EXISTS "Own data only" ON public.subscriptions;
CREATE POLICY "Own data only" ON public.subscriptions AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "tags_org_manage" ON public.tags;
CREATE POLICY "tags_org_manage" ON public.tags AS PERMISSIVE FOR ALL TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "tags_org_select" ON public.tags;
CREATE POLICY "tags_org_select" ON public.tags AS PERMISSIVE FOR SELECT TO public USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "Les utilisateurs peuvent tout faire sur leurs tÃ¢ches" ON public.tasks;
CREATE POLICY "Les utilisateurs peuvent tout faire sur leurs tÃ¢ches" ON public.tasks AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Own data only" ON public.tasks;
CREATE POLICY "Own data only" ON public.tasks AS PERMISSIVE FOR ALL TO public USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "tasks_delete_org" ON public.tasks;
CREATE POLICY "tasks_delete_org" ON public.tasks AS PERMISSIVE FOR DELETE TO authenticated USING ((has_org_membership((select auth.uid()), org_id) AND has_org_admin_role((select auth.uid()), org_id)));
DROP POLICY IF EXISTS "tasks_insert_org" ON public.tasks;
CREATE POLICY "tasks_insert_org" ON public.tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_org_membership((select auth.uid()), org_id) AND (COALESCE(user_id, (select auth.uid())) = (select auth.uid()))));
DROP POLICY IF EXISTS "tasks_select_org" ON public.tasks;
CREATE POLICY "tasks_select_org" ON public.tasks AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "tasks_update_org" ON public.tasks;
CREATE POLICY "tasks_update_org" ON public.tasks AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "team_availability_org_read" ON public.team_availability;
CREATE POLICY "team_availability_org_read" ON public.team_availability AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_availability_org_write" ON public.team_availability;
CREATE POLICY "team_availability_org_write" ON public.team_availability AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_date_slots_delete" ON public.team_date_slots;
CREATE POLICY "team_date_slots_delete" ON public.team_date_slots AS PERMISSIVE FOR DELETE TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_date_slots_delete_org" ON public.team_date_slots;
CREATE POLICY "team_date_slots_delete_org" ON public.team_date_slots AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "team_date_slots_insert" ON public.team_date_slots;
CREATE POLICY "team_date_slots_insert" ON public.team_date_slots AS PERMISSIVE FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_date_slots_insert_org" ON public.team_date_slots;
CREATE POLICY "team_date_slots_insert_org" ON public.team_date_slots AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "team_date_slots_select" ON public.team_date_slots;
CREATE POLICY "team_date_slots_select" ON public.team_date_slots AS PERMISSIVE FOR SELECT TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_date_slots_select_org" ON public.team_date_slots;
CREATE POLICY "team_date_slots_select_org" ON public.team_date_slots AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "team_date_slots_update" ON public.team_date_slots;
CREATE POLICY "team_date_slots_update" ON public.team_date_slots AS PERMISSIVE FOR UPDATE TO public USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "team_date_slots_update_org" ON public.team_date_slots;
CREATE POLICY "team_date_slots_update_org" ON public.team_date_slots AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "Users can delete team members" ON public.team_members;
CREATE POLICY "Users can delete team members" ON public.team_members AS PERMISSIVE FOR DELETE TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "Users can update team members" ON public.team_members;
CREATE POLICY "Users can update team members" ON public.team_members AS PERMISSIVE FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
CREATE POLICY "Users can view team members" ON public.team_members AS PERMISSIVE FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "team_members_insert_org" ON public.team_members;
CREATE POLICY "team_members_insert_org" ON public.team_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "teams_delete_org" ON public.teams;
CREATE POLICY "teams_delete_org" ON public.teams AS PERMISSIVE FOR DELETE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "teams_insert_org" ON public.teams;
CREATE POLICY "teams_insert_org" ON public.teams AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "teams_select_org" ON public.teams;
CREATE POLICY "teams_select_org" ON public.teams AS PERMISSIVE FOR SELECT TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "teams_update_org" ON public.teams;
CREATE POLICY "teams_update_org" ON public.teams AS PERMISSIVE FOR UPDATE TO authenticated USING ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid()))))) WITH CHECK ((org_id IN ( SELECT m.org_id
   FROM memberships m
  WHERE (m.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "tech_device_map_org" ON public.technician_device_mappings;
CREATE POLICY "tech_device_map_org" ON public.technician_device_mappings AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "tech_locations_org" ON public.technician_locations;
CREATE POLICY "tech_locations_org" ON public.technician_locations AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "time_entries_delete_org" ON public.time_entries;
CREATE POLICY "time_entries_delete_org" ON public.time_entries AS PERMISSIVE FOR DELETE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = time_entries.org_id))));
DROP POLICY IF EXISTS "time_entries_insert_org" ON public.time_entries;
CREATE POLICY "time_entries_insert_org" ON public.time_entries AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = time_entries.org_id))));
DROP POLICY IF EXISTS "time_entries_select_org" ON public.time_entries;
CREATE POLICY "time_entries_select_org" ON public.time_entries AS PERMISSIVE FOR SELECT TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = time_entries.org_id))));
DROP POLICY IF EXISTS "time_entries_update_org" ON public.time_entries;
CREATE POLICY "time_entries_update_org" ON public.time_entries AS PERMISSIVE FOR UPDATE TO authenticated USING (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = time_entries.org_id)))) WITH CHECK (((select auth.uid()) IN ( SELECT memberships.user_id
   FROM memberships
  WHERE (memberships.org_id = time_entries.org_id))));
DROP POLICY IF EXISTS "workflow_edges_org" ON public.workflow_edges;
CREATE POLICY "workflow_edges_org" ON public.workflow_edges AS PERMISSIVE FOR ALL TO public USING ((workflow_id IN ( SELECT workflows.id
   FROM workflows
  WHERE (workflows.org_id IN ( SELECT memberships.org_id
           FROM memberships
          WHERE (memberships.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "workflow_logs_org" ON public.workflow_logs;
CREATE POLICY "workflow_logs_org" ON public.workflow_logs AS PERMISSIVE FOR ALL TO public USING ((run_id IN ( SELECT workflow_runs.id
   FROM workflow_runs
  WHERE (workflow_runs.org_id IN ( SELECT memberships.org_id
           FROM memberships
          WHERE (memberships.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "workflow_nodes_org" ON public.workflow_nodes;
CREATE POLICY "workflow_nodes_org" ON public.workflow_nodes AS PERMISSIVE FOR ALL TO public USING ((workflow_id IN ( SELECT workflows.id
   FROM workflows
  WHERE (workflows.org_id IN ( SELECT memberships.org_id
           FROM memberships
          WHERE (memberships.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "workflow_runs_delete_org" ON public.workflow_runs;
CREATE POLICY "workflow_runs_delete_org" ON public.workflow_runs AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflow_runs_insert_org" ON public.workflow_runs;
CREATE POLICY "workflow_runs_insert_org" ON public.workflow_runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflow_runs_org" ON public.workflow_runs;
CREATE POLICY "workflow_runs_org" ON public.workflow_runs AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "workflow_runs_select_org" ON public.workflow_runs;
CREATE POLICY "workflow_runs_select_org" ON public.workflow_runs AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflow_runs_update_org" ON public.workflow_runs;
CREATE POLICY "workflow_runs_update_org" ON public.workflow_runs AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflows_delete_org" ON public.workflows;
CREATE POLICY "workflows_delete_org" ON public.workflows AS PERMISSIVE FOR DELETE TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflows_insert_org" ON public.workflows;
CREATE POLICY "workflows_insert_org" ON public.workflows AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflows_org" ON public.workflows;
CREATE POLICY "workflows_org" ON public.workflows AS PERMISSIVE FOR ALL TO public USING ((org_id IN ( SELECT memberships.org_id
   FROM memberships
  WHERE (memberships.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "workflows_select_org" ON public.workflows;
CREATE POLICY "workflows_select_org" ON public.workflows AS PERMISSIVE FOR SELECT TO authenticated USING (has_org_membership((select auth.uid()), org_id));
DROP POLICY IF EXISTS "workflows_update_org" ON public.workflows;
CREATE POLICY "workflows_update_org" ON public.workflows AS PERMISSIVE FOR UPDATE TO authenticated USING (has_org_membership((select auth.uid()), org_id)) WITH CHECK (has_org_membership((select auth.uid()), org_id));

commit;