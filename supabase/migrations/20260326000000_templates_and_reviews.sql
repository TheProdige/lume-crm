/* ═══════════════════════════════════════════════════════════════
   Migration — Invoice Templates, Email Templates, Review Requests
   1. invoice_templates
   2. email_templates
   3. review_requests (tracking)
   4. company_settings additions (review widget settings)
   5. Seed default email templates
   ═══════════════════════════════════════════════════════════════ */

-- ═══════════════════════════════════════════════════════════════
-- 1. INVOICE TEMPLATES
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.invoice_templates (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  created_by      uuid references auth.users(id),
  name            text not null,
  title           text default '',
  description     text default '',
  line_items      jsonb not null default '[]',
  taxes           jsonb not null default '[]',
  payment_terms   text default '',
  client_note     text default '',
  branding        jsonb not null default '{}',
  payment_methods jsonb not null default '{}',
  email_subject   text default '',
  email_body      text default '',
  is_default      boolean not null default false,
  archived_at     timestamptz default null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_invoice_templates_org
  on public.invoice_templates(org_id) where archived_at is null;

alter table public.invoice_templates enable row level security;

drop policy if exists "invoice_templates_select_org" on public.invoice_templates;
create policy "invoice_templates_select_org" on public.invoice_templates
  for select to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "invoice_templates_insert_org" on public.invoice_templates;
create policy "invoice_templates_insert_org" on public.invoice_templates
  for insert to authenticated
  with check (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "invoice_templates_update_org" on public.invoice_templates;
create policy "invoice_templates_update_org" on public.invoice_templates
  for update to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "invoice_templates_delete_org" on public.invoice_templates;
create policy "invoice_templates_delete_org" on public.invoice_templates
  for delete to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "invoice_templates_service" on public.invoice_templates;
create policy "invoice_templates_service" on public.invoice_templates
  for all to service_role
  using (true) with check (true);

-- updated_at trigger
create or replace function public.set_invoice_templates_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_invoice_templates_updated on public.invoice_templates;
create trigger trg_invoice_templates_updated
  before update on public.invoice_templates
  for each row execute function public.set_invoice_templates_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 2. EMAIL TEMPLATES
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  created_by      uuid references auth.users(id),
  name            text not null,
  type            text not null default 'generic'
                  check (type in ('invoice_sent', 'invoice_reminder', 'quote_sent', 'review_request', 'generic')),
  subject         text not null default '',
  body            text not null default '',
  variables       jsonb not null default '[]',
  is_active       boolean not null default true,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_email_templates_org
  on public.email_templates(org_id);
create index if not exists idx_email_templates_type
  on public.email_templates(org_id, type) where is_active = true;

alter table public.email_templates enable row level security;

drop policy if exists "email_templates_select_org" on public.email_templates;
create policy "email_templates_select_org" on public.email_templates
  for select to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "email_templates_insert_org" on public.email_templates;
create policy "email_templates_insert_org" on public.email_templates
  for insert to authenticated
  with check (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "email_templates_update_org" on public.email_templates;
create policy "email_templates_update_org" on public.email_templates
  for update to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "email_templates_delete_org" on public.email_templates;
create policy "email_templates_delete_org" on public.email_templates
  for delete to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "email_templates_service" on public.email_templates;
create policy "email_templates_service" on public.email_templates
  for all to service_role
  using (true) with check (true);

-- updated_at trigger
create or replace function public.set_email_templates_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_email_templates_updated on public.email_templates;
create trigger trg_email_templates_updated
  before update on public.email_templates
  for each row execute function public.set_email_templates_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. REVIEW REQUESTS (tracking)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.review_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  job_id          uuid references public.jobs(id) on delete set null,
  survey_id       uuid references public.satisfaction_surveys(id) on delete set null,
  email_template_id uuid references public.email_templates(id) on delete set null,
  subject_sent    text default null,
  status          text not null default 'pending'
                  check (status in ('pending', 'sent', 'clicked', 'submitted', 'failed')),
  sent_at         timestamptz default null,
  clicked_at      timestamptz default null,
  submitted_at    timestamptz default null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_review_requests_org
  on public.review_requests(org_id, created_at desc);
create index if not exists idx_review_requests_client
  on public.review_requests(client_id, created_at desc);
-- Anti-duplicate: prevent sending review to same client within 7 days
create unique index if not exists idx_review_requests_dedup
  on public.review_requests(org_id, client_id, (sent_at::date))
  where status in ('sent', 'clicked', 'submitted');

alter table public.review_requests enable row level security;

drop policy if exists "review_requests_select_org" on public.review_requests;
create policy "review_requests_select_org" on public.review_requests
  for select to authenticated
  using (org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid()));

drop policy if exists "review_requests_service" on public.review_requests;
create policy "review_requests_service" on public.review_requests
  for all to service_role
  using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. COMPANY SETTINGS ADDITIONS
-- ═══════════════════════════════════════════════════════════════

do $$ begin
  -- google_review_url already added in previous migration, but ensure it exists
  alter table public.company_settings add column if not exists google_review_url text default null;
  alter table public.company_settings add column if not exists review_enabled boolean not null default false;
  alter table public.company_settings add column if not exists review_template_id uuid default null;
  alter table public.company_settings add column if not exists review_widget_settings jsonb not null default '{"theme":"light","filter":"all","layout":"cards","max_display":6}';
exception when others then null;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 5. SEED DEFAULT EMAIL TEMPLATES (per-org function)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.seed_email_templates(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Invoice Sent
  insert into public.email_templates (org_id, name, type, subject, body, variables, is_active, is_default)
  values (p_org_id,
    'Invoice Sent (Default)',
    'invoice_sent',
    'Invoice {invoice_number} — {invoice_amount}',
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2>Hello {client_name},</h2>
      <p>Please find below the details for your invoice.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600;">Invoice #</td><td style="padding:8px;border:1px solid #ddd;">{invoice_number}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600;">Amount</td><td style="padding:8px;border:1px solid #ddd;">{invoice_amount}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600;">Due Date</td><td style="padding:8px;border:1px solid #ddd;">{due_date}</td></tr>
      </table>
      <p style="text-align:center;margin:30px 0;">
        <a href="{payment_link}" style="background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">View Invoice</a>
      </p>
      <p>Thank you,<br/>{company_name}</p>
    </div>',
    '["client_name","company_name","invoice_number","invoice_amount","due_date","payment_link"]'::jsonb,
    true, true)
  on conflict do nothing;
  get diagnostics v_count = row_count;

  -- Invoice Reminder
  insert into public.email_templates (org_id, name, type, subject, body, variables, is_active, is_default)
  values (p_org_id,
    'Invoice Reminder (Default)',
    'invoice_reminder',
    'Reminder: Invoice {invoice_number} Past Due',
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2>Hello {client_name},</h2>
      <p>This is a friendly reminder that invoice <strong>{invoice_number}</strong> for <strong>{invoice_amount}</strong> is past due.</p>
      <p>Please arrange payment at your earliest convenience.</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="{payment_link}" style="background:#dc2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Pay Now</a>
      </p>
      <p>Thank you,<br/>{company_name}</p>
    </div>',
    '["client_name","company_name","invoice_number","invoice_amount","due_date","payment_link"]'::jsonb,
    true, true)
  on conflict do nothing;

  -- Quote Sent
  insert into public.email_templates (org_id, name, type, subject, body, variables, is_active, is_default)
  values (p_org_id,
    'Quote Sent (Default)',
    'quote_sent',
    'Estimate from {company_name}',
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2>Hello {client_name},</h2>
      <p>We have prepared an estimate for you. Please review the details below:</p>
      <p><strong>Amount:</strong> {invoice_amount}</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="{payment_link}" style="background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">View Estimate</a>
      </p>
      <p>Best regards,<br/>{company_name}</p>
    </div>',
    '["client_name","company_name","invoice_amount","payment_link"]'::jsonb,
    true, true)
  on conflict do nothing;

  -- Review Request
  insert into public.email_templates (org_id, name, type, subject, body, variables, is_active, is_default)
  values (p_org_id,
    'Review Request (Default)',
    'review_request',
    '{company_name} — How was your experience?',
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2>Hi {client_name},</h2>
      <p>We recently completed <strong>{job_name}</strong> and would love to hear your feedback!</p>
      <p>Please take a moment to rate your experience:</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="{review_link}" style="background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Rate Your Experience</a>
      </p>
      <p>Thank you for choosing {company_name}!</p>
    </div>',
    '["client_name","company_name","job_name","review_link"]'::jsonb,
    true, true)
  on conflict do nothing;

  return v_count;
end;
$$;

-- Seed for all existing orgs
do $$
declare
  v_org record;
begin
  for v_org in select id from public.orgs loop
    perform public.seed_email_templates(v_org.id);
  end loop;
end $$;
