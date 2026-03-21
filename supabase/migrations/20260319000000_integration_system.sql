-- ═══════════════════════════════════════════════════════════════
-- Integration System — Full refactor
-- Upgrades app_connections, adds oauth_states & audit_logs
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. ALTER app_connections: add real status tracking + encrypted fields
-- ────────────────────────────────────────────────────────────────

-- Drop old check constraint and add expanded statuses
alter table public.app_connections
  drop constraint if exists app_connections_status_check;

alter table public.app_connections
  add constraint app_connections_status_check
  check (status in (
    'not_connected',
    'setup_required',
    'pending_authorization',
    'connected',
    'token_expired',
    'reconnect_required',
    'error',
    'disabled'
  ));

-- Update default status
alter table public.app_connections
  alter column status set default 'not_connected';

-- Add new columns for real integration tracking
alter table public.app_connections
  add column if not exists auth_type text check (auth_type in ('oauth', 'api_key', 'credentials', 'manual', 'internal')),
  add column if not exists connected_account_name text,
  add column if not exists connected_account_id text,
  add column if not exists scopes_granted text[],
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists encrypted_credentials jsonb default '{}'::jsonb,
  add column if not exists last_test_result text check (last_test_result in ('success', 'failure', null)),
  add column if not exists last_error text,
  add column if not exists disconnected_at timestamptz;

-- Index on token expiry for refresh job
create index if not exists idx_app_connections_token_expiry
  on public.app_connections(token_expires_at)
  where token_expires_at is not null and status = 'connected';

-- ────────────────────────────────────────────────────────────────
-- 2. integration_oauth_states — CSRF protection for OAuth flows
-- ────────────────────────────────────────────────────────────────

create table if not exists public.integration_oauth_states (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  app_id          text not null,
  state           text not null unique,
  code_verifier   text,
  redirect_uri    text not null,
  expires_at      timestamptz not null default (now() + interval '10 minutes'),
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_oauth_states_state on public.integration_oauth_states(state);
create index if not exists idx_oauth_states_expires on public.integration_oauth_states(expires_at);

-- RLS
alter table public.integration_oauth_states enable row level security;

create policy "oauth_states_insert_own_org"
  on public.integration_oauth_states for insert
  with check (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "oauth_states_select_own_org"
  on public.integration_oauth_states for select
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 3. integration_audit_logs — Full audit trail
-- ────────────────────────────────────────────────────────────────

create table if not exists public.integration_audit_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  connection_id   uuid references public.app_connections(id) on delete set null,
  app_id          text not null,
  user_id         uuid references auth.users(id),
  action          text not null check (action in (
    'connect_started',
    'oauth_redirect',
    'oauth_callback',
    'credentials_submitted',
    'connection_tested',
    'connection_validated',
    'token_refreshed',
    'token_expired',
    'disconnected',
    'revoked',
    'error',
    'reconnect_started',
    'status_changed'
  )),
  status          text,
  message         text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_logs_org on public.integration_audit_logs(org_id);
create index if not exists idx_audit_logs_connection on public.integration_audit_logs(connection_id);
create index if not exists idx_audit_logs_app on public.integration_audit_logs(app_id);
create index if not exists idx_audit_logs_created on public.integration_audit_logs(created_at desc);

-- RLS
alter table public.integration_audit_logs enable row level security;

create policy "audit_logs_select_own_org"
  on public.integration_audit_logs for select
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
    )
  );

create policy "audit_logs_insert_own_org"
  on public.integration_audit_logs for insert
  with check (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 4. Cleanup function: auto-expire old oauth states
-- ────────────────────────────────────────────────────────────────

create or replace function public.cleanup_expired_oauth_states()
returns void as $$
begin
  delete from public.integration_oauth_states
  where expires_at < now() and consumed_at is null;
end;
$$ language plpgsql security definer set search_path = '';

comment on table public.integration_oauth_states is 'Temporary OAuth state storage for CSRF protection during OAuth flows.';
comment on table public.integration_audit_logs is 'Complete audit trail for all integration connection lifecycle events.';
