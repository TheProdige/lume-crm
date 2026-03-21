# Database — Lume CRM

## Conventions
- Every table has `org_id uuid NOT NULL` — all queries must be org-scoped
- Soft deletes: `deleted_at timestamptz DEFAULT NULL` — never `DELETE` rows
- Active views: `leads_active`, `clients_active` — always filter `deleted_at IS NULL`
- Timestamps: `created_at`, `updated_at` (auto-updated via triggers)
- UUIDs: `gen_random_uuid()` as default PK
- RLS enabled on all tables — policies use `has_org_membership(auth.uid(), org_id)`

## Core Entities

### `orgs`
Top-level tenant. All data belongs to an org.
- `id`, `name`, `slug`, `created_at`

### `memberships`
Links users to orgs with roles.
- `org_id → orgs`, `user_id → auth.users`
- `role`: `owner | admin | member`

### `leads`
Potential customers before conversion.
- `org_id`, `first_name`, `last_name`, `email`, `phone`, `address`
- `status`: `new | contacted | estimate_sent | follow_up | won | closed | archived | lost`
- `converted_to_client_id → clients` (set when lead becomes a client)
- `deleted_at` — soft delete
- View: `leads_active` (WHERE deleted_at IS NULL)

### `clients`
Converted or direct customers.
- `org_id`, `first_name`, `last_name`, `email`, `phone`, `address`, `status`
- `deleted_at` — soft delete
- View: `clients_active`

### `pipeline_deals`
Kanban cards linking leads to the sales pipeline.
- `org_id`, `lead_id → leads`, `client_id → clients`, `job_id → jobs`
- `stage`: `New | Contacted | Estimate Sent | Follow-Up | Won | Closed | Lost`
- `value`, `title`, `notes`
- `deleted_at` — soft delete
- Stage changes trigger `sync_lead_stage_from_deal()` trigger

### `jobs`
Service jobs assigned to clients/teams.
- `org_id`, `client_id → clients`, `lead_id → leads`, `team_id → teams`
- `job_number` (auto-incremented per org), `title`, `status`, `property_address`
- `total_cents`, `currency`, `tax_lines jsonb`
- `latitude`, `longitude`, `geocode_status`
- `scheduled_at`, `end_at`, `deleted_at`

### `invoices`
Financial documents tied to jobs or clients.
- `org_id`, `client_id`, `job_id → jobs`
- `invoice_number`, `status`: `draft | sent | paid | overdue | void`
- `total_cents`, `balance_cents`, `currency`
- `due_date`, `sent_at`, `paid_at`

### `payments`
Payment records (Stripe, PayPal, manual).
- `org_id`, `invoice_id → invoices`, `client_id`, `job_id`
- `provider`: `stripe | paypal | manual`
- `amount_cents`, `currency`, `status`: `succeeded | pending | failed | refunded`
- `provider_payment_id`, `provider_event_id`

### `schedule_events`
Scheduled time blocks for jobs.
- `org_id`, `job_id → jobs`, `team_id → teams`
- `start_time`, `end_time`, `status`, `notes`
- `deleted_at`

### `teams`
Field teams / crew groups.
- `org_id`, `name`
- Related: `team_members` (user → team mappings)

### `email_templates`
Reusable email templates per org.
- `org_id`, `type`: `invoice_sent | invoice_reminder | quote_sent | review_request | generic`
- `subject`, `body` (HTML), `variables jsonb`, `is_active`, `is_default`

### `automations` / `workflows`
Trigger-action automation rules.
- `org_id`, `trigger`, `conditions jsonb`, `actions jsonb`

### `notes`
Free-form notes attached to any entity.
- `org_id`, `entity_type`, `entity_id`, `content`, `created_by`

### `tasks`
Action items linked to leads/jobs.
- `org_id`, `lead_id`, `job_id`, `title`, `due_date`, `completed`

### `company_settings`
Per-org configuration.
- `org_id` (1:1 with orgs)
- `review_enabled`, `review_template_id`, `review_widget_settings jsonb`
- Payment gateway keys, branding, etc.

## Key RPCs (Supabase Functions)
| RPC | Purpose |
|---|---|
| `soft_delete_lead(p_org_id, p_lead_id)` | Soft-deletes lead + its pipeline_deals |
| `delete_lead_and_optional_client(...)` | Full cascade delete with client option |
| `create_pipeline_deal(...)` | Creates deal + optional job atomically |
| `set_deal_stage(p_deal_id, p_stage)` | Updates stage + syncs lead status |
| `create_invoice_from_job(...)` | Creates invoice from job data |
| `get_available_slots(...)` | Returns availability slots for scheduling |
| `current_org_id()` | Returns calling user's org_id |
| `has_org_membership(p_user, p_org)` | RLS helper |
| `has_org_admin_role(p_user, p_org)` | Admin check for destructive ops |
