-- ============================================================
-- MIGRATION: 20260405000000_lume_payments_connect.sql
-- Lume Payments — Stripe Connect embedded payments system
-- Idempotent: safe to run multiple times
-- ============================================================

-- ── 1. connected_accounts ───────────────────────────────────

create table if not exists public.connected_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique,
  stripe_account_id text not null unique,
  account_type  text not null default 'express'
    check (account_type in ('express', 'standard', 'custom')),
  onboarding_complete boolean not null default false,
  charges_enabled     boolean not null default false,
  payouts_enabled     boolean not null default false,
  details_submitted   boolean not null default false,
  country       text,
  default_currency text not null default 'CAD',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists connected_accounts_org_id_idx
  on public.connected_accounts (org_id);

create or replace function public.set_connected_accounts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_connected_accounts_updated_at on public.connected_accounts;
create trigger trg_connected_accounts_updated_at
  before update on public.connected_accounts
  for each row execute function public.set_connected_accounts_updated_at();

alter table public.connected_accounts enable row level security;

drop policy if exists "connected_accounts_select_org" on public.connected_accounts;
create policy "connected_accounts_select_org" on public.connected_accounts
  for select using (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = connected_accounts.org_id)
  );

drop policy if exists "connected_accounts_insert_org" on public.connected_accounts;
create policy "connected_accounts_insert_org" on public.connected_accounts
  for insert with check (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = connected_accounts.org_id)
  );

drop policy if exists "connected_accounts_update_org" on public.connected_accounts;
create policy "connected_accounts_update_org" on public.connected_accounts
  for update using (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = connected_accounts.org_id)
  );

-- ── 2. payment_requests ─────────────────────────────────────

create table if not exists public.payment_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  public_token  text not null unique default encode(gen_random_bytes(24), 'hex'),
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'CAD',
  status        text not null default 'pending'
    check (status in ('pending', 'sent', 'paid', 'expired', 'cancelled')),
  expires_at    timestamptz,
  stripe_payment_intent_id text,
  payment_url   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists payment_requests_org_id_idx
  on public.payment_requests (org_id);
create index if not exists payment_requests_invoice_id_idx
  on public.payment_requests (invoice_id);
create index if not exists payment_requests_public_token_idx
  on public.payment_requests (public_token);
create index if not exists payment_requests_status_idx
  on public.payment_requests (org_id, status);

create or replace function public.set_payment_requests_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_payment_requests_updated_at on public.payment_requests;
create trigger trg_payment_requests_updated_at
  before update on public.payment_requests
  for each row execute function public.set_payment_requests_updated_at();

alter table public.payment_requests enable row level security;

drop policy if exists "payment_requests_select_org" on public.payment_requests;
create policy "payment_requests_select_org" on public.payment_requests
  for select using (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = payment_requests.org_id)
  );

drop policy if exists "payment_requests_insert_org" on public.payment_requests;
create policy "payment_requests_insert_org" on public.payment_requests
  for insert with check (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = payment_requests.org_id)
  );

drop policy if exists "payment_requests_update_org" on public.payment_requests;
create policy "payment_requests_update_org" on public.payment_requests
  for update using (
    org_id = auth.uid()
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = payment_requests.org_id)
  );

-- ── 3. webhook_events (drop + recreate to fix schema) ───────

drop table if exists public.webhook_events cascade;

create table public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'stripe'
    check (provider in ('stripe', 'paypal')),
  stripe_event_id text unique,
  stripe_account_id text,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
    check (status in ('pending', 'processed', 'failed', 'skipped')),
  processed_at    timestamptz,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists webhook_events_stripe_event_id_idx
  on public.webhook_events (stripe_event_id);
create index if not exists webhook_events_provider_type_idx
  on public.webhook_events (provider, event_type);
create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at desc);

alter table public.webhook_events enable row level security;

-- ── 4. Extend payments table ────────────────────────────────

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_request_id'
  ) then
    alter table public.payments add column payment_request_id uuid references public.payment_requests(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_charge_id'
  ) then
    alter table public.payments add column stripe_charge_id text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_transfer_id'
  ) then
    alter table public.payments add column stripe_transfer_id text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_balance_transaction_id'
  ) then
    alter table public.payments add column stripe_balance_transaction_id text;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'application_fee_amount'
  ) then
    alter table public.payments add column application_fee_amount integer;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_fee_amount'
  ) then
    alter table public.payments add column stripe_fee_amount integer;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'net_amount'
  ) then
    alter table public.payments add column net_amount integer;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'paid_at'
  ) then
    alter table public.payments add column paid_at timestamptz;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'failure_reason'
  ) then
    alter table public.payments add column failure_reason text;
  end if;
end $$;

create index if not exists payments_payment_request_id_idx
  on public.payments (payment_request_id);

-- exec_sql removed — security risk (arbitrary SQL execution)
