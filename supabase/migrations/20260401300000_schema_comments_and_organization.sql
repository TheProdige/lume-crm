/* ═══════════════════════════════════════════════════════════════
   Schema Comments & Organization

   Adds COMMENT ON TABLE for every table, grouped by domain.
   Visible in Supabase Schema Visualizer on hover.
   ═══════════════════════════════════════════════════════════════ */

-- ═══════════════════════════════════════════════════════════════
-- A. AUTH / IDENTITY
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.memberships IS
  '[A. Auth] User ↔ Org membership. PK: (user_id, org_id). Role: owner | admin | member.';

COMMENT ON TABLE public.orgs IS
  '[A. Auth] Organizations (tenants). Every data row is scoped to one org.';

COMMENT ON TABLE public.profiles IS
  '[A. Auth] User profiles — extends auth.users with display name, avatar, settings.';

COMMENT ON TABLE public.company_settings IS
  '[A. Auth] Per-org company info: name, logo, address, google_review_url, timezone.';

COMMENT ON TABLE public.user_settings IS
  '[A. Auth] Per-user preferences: theme, language, notifications prefs.';

-- ═══════════════════════════════════════════════════════════════
-- B. CRM CORE
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.leads IS
  '[B. CRM] Leads — potential customers. Linked to clients via client_id. Soft-delete via deleted_at.';

COMMENT ON TABLE public.clients IS
  '[B. CRM] Clients — active customers. Created from leads or directly. Soft-delete via deleted_at.';

COMMENT ON TABLE public.contacts IS
  '[B. CRM] Contacts — shared contact info (name, email, phone, address). Referenced by leads & clients.';

COMMENT ON TABLE public.pipeline_deals IS
  '[B. CRM] Pipeline cards — Kanban items. Linked to lead + job. Stages: new → follow_up_1/2/3 → closed | lost.';

COMMENT ON TABLE public.pipeline_stages IS
  '[B. CRM] Pipeline stage definitions (legacy — stages now stored as text on pipeline_deals.stage).';

COMMENT ON TABLE public.job_intents IS
  '[B. CRM] Job creation intents — emitted when a deal reaches a trigger stage (e.g. closed). Consumed to create jobs.';

COMMENT ON TABLE public.notes IS
  '[B. CRM] Notes attached to any entity (lead, client, job). Supports files, tags, checklists.';

COMMENT ON TABLE public.notes_files IS
  '[B. CRM] File attachments for notes.';

COMMENT ON TABLE public.notes_tags IS
  '[B. CRM] Tags for notes.';

COMMENT ON TABLE public.notes_checklist IS
  '[B. CRM] Checklist items within notes.';

COMMENT ON TABLE public.note_history IS
  '[B. CRM] Version history for notes — saved on each update.';

COMMENT ON TABLE public.note_boards IS
  '[B. CRM] Visual note boards — whiteboard-style canvases.';

COMMENT ON TABLE public.custom_columns IS
  '[B. CRM] User-defined custom fields for leads/clients/jobs.';

COMMENT ON TABLE public.custom_column_values IS
  '[B. CRM] Values for custom fields — linked to custom_columns + entity record.';

-- ═══════════════════════════════════════════════════════════════
-- C. OPERATIONS / JOBS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.jobs IS
  '[C. Ops] Jobs — work orders linked to clients. Statuses: unscheduled → scheduled → in_progress → completed | cancelled.';

COMMENT ON TABLE public.job_line_items IS
  '[C. Ops] Line items for jobs — services/products with qty and unit price.';

COMMENT ON TABLE public.teams IS
  '[C. Ops] Teams / crews — groups of technicians. Assigned to jobs and schedule events.';

COMMENT ON TABLE public.team_members IS
  '[C. Ops] Team membership — links users to teams.';

COMMENT ON TABLE public.schedule_events IS
  '[C. Ops] Calendar events — time slots for jobs. Linked to job + team. Primary cols: start_at, end_at.';

COMMENT ON TABLE public.tasks IS
  '[C. Ops] Internal tasks — to-dos assigned to users. Can be linked to any entity.';

COMMENT ON TABLE public.availabilities IS
  '[C. Ops] User availability — daily time slots. Used for scheduling.';

COMMENT ON TABLE public.team_availability IS
  '[C. Ops] Team weekly availability — recurring schedule per day of week.';

COMMENT ON TABLE public.team_date_slots IS
  '[C. Ops] Team date-specific slots — overrides for specific dates.';

COMMENT ON TABLE public.predefined_services IS
  '[C. Ops] Service catalog — predefined services with pricing. Used in job line items.';

-- ═══════════════════════════════════════════════════════════════
-- D. BILLING / FINANCIAL
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.invoices IS
  '[D. Billing] Invoices — linked to client + job. Statuses: draft → sent → paid | partial | void.';

COMMENT ON TABLE public.invoice_items IS
  '[D. Billing] Invoice line items — description, qty, unit_price_cents, line_total_cents.';

COMMENT ON TABLE public.invoice_sequences IS
  '[D. Billing] Auto-increment sequences for invoice numbering per org.';

COMMENT ON TABLE public.payments IS
  '[D. Billing] Payments — linked to invoices. Provider: stripe | paypal | cash | manual.';

COMMENT ON TABLE public.payment_providers IS
  '[D. Billing] Payment provider configurations per org (Stripe, PayPal).';

COMMENT ON TABLE public.payment_provider_settings IS
  '[D. Billing] Provider settings — key/value pairs for payment provider config.';

COMMENT ON TABLE public.payment_provider_secrets IS
  '[D. Billing] Provider secrets — encrypted API keys for payment providers.';

COMMENT ON TABLE public.payment_settings IS
  '[D. Billing] Org-level payment settings — tax rates, currency, terms.';

COMMENT ON TABLE public.invoice_templates IS
  '[D. Billing] Custom invoice PDF/email templates per org.';

-- ═══════════════════════════════════════════════════════════════
-- E. COMMUNICATION
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.notifications IS
  '[E. Comms] In-app notifications for users. Type: system | automation | manual.';

COMMENT ON TABLE public.email_templates IS
  '[E. Comms] Email templates — used for invoices, reminders, reviews. Per org.';

COMMENT ON TABLE public.conversations IS
  '[E. Comms] Message threads — linked to clients for communication tracking.';

COMMENT ON TABLE public.messages IS
  '[E. Comms] Individual messages within conversations.';

COMMENT ON TABLE public.communication_messages IS
  '[E. Comms] Unified communication log — SMS, email, calls. Provider-agnostic.';

COMMENT ON TABLE public.communication_channels IS
  '[E. Comms] Communication channel configs per org (SMS, email providers).';

COMMENT ON TABLE public.communication_settings IS
  '[E. Comms] Per-org communication preferences and defaults.';

-- ═══════════════════════════════════════════════════════════════
-- F. AUTOMATION / SYSTEM
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.automation_rules IS
  '[F. Auto] Event-driven automation rules — trigger_event + delay + actions. 21 presets per org.';

COMMENT ON TABLE public.automation_scheduled_tasks IS
  '[F. Auto] Delayed action queue — tasks scheduled by automation engine. Processed every 5 min.';

COMMENT ON TABLE public.automation_execution_logs IS
  '[F. Auto] Execution audit trail — logs every automation action with success/error/duration.';

COMMENT ON TABLE public.activity_log IS
  '[F. Auto] Unified activity log — all CRM events (lead created, invoice sent, job completed, etc.).';

COMMENT ON TABLE public.audit_events IS
  '[F. Auto] Audit trail — tracks data changes with before/after snapshots.';

COMMENT ON TABLE public.satisfaction_surveys IS
  '[F. Auto] Customer satisfaction surveys — generated after job completion. Token-based access.';

COMMENT ON TABLE public.review_requests IS
  '[F. Auto] Google review request tracking — sent via automation after positive survey.';

-- ═══════════════════════════════════════════════════════════════
-- G. VISUAL WORKFLOWS (separate module)
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.workflows IS
  '[G. Workflows] Visual workflow definitions — drag-and-drop builder. Separate from automation_rules.';

COMMENT ON TABLE public.workflow_nodes IS
  '[G. Workflows] Nodes in visual workflows — trigger, condition, action, delay.';

COMMENT ON TABLE public.workflow_edges IS
  '[G. Workflows] Connections between workflow nodes.';

COMMENT ON TABLE public.workflow_runs IS
  '[G. Workflows] Execution history for visual workflows.';

COMMENT ON TABLE public.workflow_logs IS
  '[G. Workflows] Detailed execution logs per node per run.';

-- ═══════════════════════════════════════════════════════════════
-- H. AI
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.ai_conversations IS
  '[H. AI] AI assistant conversation threads per user per org.';

COMMENT ON TABLE public.ai_messages IS
  '[H. AI] Messages within AI conversations — user and assistant turns.';

-- ═══════════════════════════════════════════════════════════════
-- I. LOCATION / GPS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.technician_locations IS
  '[I. GPS] Real-time technician GPS positions.';

COMMENT ON TABLE public.technician_device_mappings IS
  '[I. GPS] Device ↔ technician mapping for GPS tracking.';

COMMENT ON TABLE public.geofences IS
  '[I. GPS] Geofence zones around job sites.';

COMMENT ON TABLE public.proof_of_presence IS
  '[I. GPS] Proof-of-presence logs — technician entered geofence at job site.';

COMMENT ON TABLE public.gps_providers IS
  '[I. GPS] GPS provider configurations per org.';

-- ═══════════════════════════════════════════════════════════════
-- J. FILES / ATTACHMENTS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.attachments IS
  '[J. Files] File attachments — linked to any entity. Stored in Supabase Storage.';

-- ═══════════════════════════════════════════════════════════════
-- K. MISC / INTERNAL
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE public.client_link_backfill_ambiguous IS
  '[K. Internal] Tracking table for client linkage backfill — temporary migration data.';

COMMENT ON TABLE public.quote_views IS
  '[K. Internal] Quote/invoice view tracking — records when a client views their invoice link.';
