-- ============================================================
-- MIGRATION: 20260405200000_schema_comments.sql
-- Schema documentation & organization for Supabase visualizer
-- Idempotent: safe to re-run
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- GROUP 1: AUTH & IDENTITY
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.profiles IS '[Auth] User profiles linked to auth.users';

-- ══════════════════════════════════════════════════════════════
-- GROUP 2: ORGANIZATIONS
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.company_settings IS '[Org] Organization company settings (name, logo, address)';
COMMENT ON TABLE public.teams IS '[Org] Teams within an organization';
COMMENT ON TABLE public.team_members IS '[Org] Team member assignments';
COMMENT ON TABLE public.team_availability IS '[Org] Weekly team availability windows';
COMMENT ON TABLE public.team_date_slots IS '[Org] Date-specific team availability overrides';

-- ══════════════════════════════════════════════════════════════
-- GROUP 3: CRM CORE
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.leads IS '[CRM] Prospect/lead records';
COMMENT ON TABLE public.clients IS '[CRM] Customer/client records (converted leads)';
COMMENT ON TABLE public.contacts IS '[CRM] Contact directory (source of truth for contact info)';
COMMENT ON TABLE public.pipeline_stages IS '[CRM] Custom pipeline stage definitions per org';
COMMENT ON TABLE public.pipeline_deals IS '[CRM] Sales pipeline deals (lead to job progression)';
COMMENT ON TABLE public.job_intents IS '[CRM] Lead-to-job trigger intents on pipeline stage change';
COMMENT ON TABLE public.tags IS '[CRM] Tags for categorizing entities';
COMMENT ON TABLE public.client_tags IS '[CRM] Client-tag associations';

-- ══════════════════════════════════════════════════════════════
-- GROUP 4: OPERATIONS / JOBS
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.jobs IS '[Jobs] Work orders / service jobs';
COMMENT ON TABLE public.job_line_items IS '[Jobs] Line items on a job (services, materials)';
COMMENT ON TABLE public.job_recurrence_rules IS '[Jobs] Recurring job schedule rules';
COMMENT ON TABLE public.job_templates IS '[Jobs] Job templates for quick creation';
COMMENT ON TABLE public.schedule_events IS '[Jobs] Calendar events tied to jobs';
COMMENT ON TABLE public.predefined_services IS '[Jobs] Service catalog (predefined products/services)';

-- ══════════════════════════════════════════════════════════════
-- GROUP 5: INVOICING
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.invoices IS '[Invoicing] Invoice records (draft to sent to paid)';
COMMENT ON TABLE public.invoice_items IS '[Invoicing] Line items on invoices';
COMMENT ON TABLE public.invoice_templates IS '[Invoicing] Invoice template library';
COMMENT ON TABLE public.quote_views IS '[Invoicing] Quote/invoice view tracking (analytics)';

-- ══════════════════════════════════════════════════════════════
-- GROUP 6: PAYMENTS (LUME PAYMENTS)
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.payments IS '[Payments] Financial transaction records';
COMMENT ON TABLE public.payment_requests IS '[Payments] Payment request links (public_token to invoice)';
COMMENT ON TABLE public.connected_accounts IS '[Payments] Stripe Connect accounts per organization';
COMMENT ON TABLE public.webhook_events IS '[Payments] Stripe/PayPal webhook event log (audit trail)';

-- ══════════════════════════════════════════════════════════════
-- GROUP 7: MESSAGING & NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.messages IS '[Messaging] SMS message history (Twilio)';
COMMENT ON TABLE public.communication_messages IS '[Messaging] Unified communication log (email + SMS)';
COMMENT ON TABLE public.communication_channels IS '[Messaging] Communication channel configs per org';
COMMENT ON TABLE public.communication_settings IS '[Messaging] Communication preferences';
COMMENT ON TABLE public.notifications IS '[Messaging] In-app notification records';
COMMENT ON TABLE public.email_templates IS '[Messaging] Email template library';
COMMENT ON TABLE public.satisfaction_surveys IS '[Messaging] Client satisfaction survey records';
COMMENT ON TABLE public.review_requests IS '[Messaging] Review request tracking';

-- ══════════════════════════════════════════════════════════════
-- GROUP 8: AUTOMATION & WORKFLOWS
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.automation_rules IS '[Automation] Event-driven automation rule definitions';
COMMENT ON TABLE public.automation_execution_logs IS '[Automation] Automation run logs';
COMMENT ON TABLE public.automation_scheduled_tasks IS '[Automation] Scheduled automation tasks (delayed actions)';
COMMENT ON TABLE public.workflows IS '[Workflow] Visual workflow definitions';
COMMENT ON TABLE public.workflow_nodes IS '[Workflow] Nodes in workflow graph';
COMMENT ON TABLE public.workflow_edges IS '[Workflow] Edges connecting workflow nodes';
COMMENT ON TABLE public.workflow_runs IS '[Workflow] Workflow execution history';
COMMENT ON TABLE public.workflow_logs IS '[Workflow] Workflow execution logs';

-- ══════════════════════════════════════════════════════════════
-- GROUP 9: AI & ASSISTANT
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.ai_conversations IS '[AI] AI chat conversation sessions';
COMMENT ON TABLE public.ai_messages IS '[AI] AI conversation messages';
COMMENT ON TABLE public.ai_message_files IS '[AI] Files attached to AI messages';
COMMENT ON TABLE public.ai_tool_calls IS '[AI] AI tool call execution records';
COMMENT ON TABLE public.agent_chat_sessions IS '[AI] AI agent chat sessions';

-- ══════════════════════════════════════════════════════════════
-- GROUP 10: NOTES & COLLABORATION
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.note_boards IS '[Notes] Collaborative note boards';
COMMENT ON TABLE public.note_items IS '[Notes] Items on note boards (cards, stickies)';
COMMENT ON TABLE public.note_connections IS '[Notes] Connections between note items';
COMMENT ON TABLE public.note_entity_links IS '[Notes] Links between notes and CRM entities';
COMMENT ON TABLE public.note_history IS '[Notes] Note revision history';
COMMENT ON TABLE public.board_members IS '[Notes] Board membership/collaboration';
COMMENT ON TABLE public.board_comments IS '[Notes] Comments on board items';
COMMENT ON TABLE public.board_drawings IS '[Notes] Freehand drawings on boards';
COMMENT ON TABLE public.board_votes IS '[Notes] Voting on board items';

-- ══════════════════════════════════════════════════════════════
-- GROUP 11: SYSTEM & AUDIT
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.activity_log IS '[System] Activity event log (all entity changes)';
COMMENT ON TABLE public.audit_events IS '[System] Audit trail for sensitive operations';
COMMENT ON TABLE public.app_connections IS '[System] Third-party app integrations (Slack, QB, etc.)';
COMMENT ON TABLE public.archived_records IS '[System] Archived/deleted record storage';
COMMENT ON TABLE public.integration_audit_logs IS '[System] Integration sync audit logs';
COMMENT ON TABLE public.integration_oauth_states IS '[System] OAuth state tokens for integrations';
COMMENT ON TABLE public.rate_limits IS '[System] Rate limiting state';
COMMENT ON TABLE public.time_entries IS '[System] Timesheet time entries';
COMMENT ON TABLE public.entity_comments IS '[System] Comments on any entity';
COMMENT ON TABLE public.entity_tags IS '[System] Tags on any entity';

-- ══════════════════════════════════════════════════════════════
-- GROUP 12: FIELD SERVICE / LOCATION
-- ══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.geofences IS '[Location] Geofence definitions';
COMMENT ON TABLE public.technician_locations IS '[Location] Real-time technician GPS positions';
COMMENT ON TABLE public.technician_device_mappings IS '[Location] Technician device assignments';
COMMENT ON TABLE public.gps_providers IS '[Location] GPS provider configurations';
COMMENT ON TABLE public.proof_of_presence IS '[Location] Proof of presence records (check-in/out)';

-- ══════════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════════
COMMENT ON VIEW public.leads_active IS '[View] Active leads (WHERE deleted_at IS NULL)';
COMMENT ON VIEW public.clients_active IS '[View] Active clients (WHERE deleted_at IS NULL)';
COMMENT ON VIEW public.jobs_active IS '[View] Active jobs (WHERE deleted_at IS NULL)';
COMMENT ON VIEW public.pipeline_deals_active IS '[View] Active pipeline deals (WHERE deleted_at IS NULL)';
COMMENT ON VIEW public.schedule_events_active IS '[View] Active schedule events';
COMMENT ON VIEW public.team_availability_active IS '[View] Active team availability';

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
