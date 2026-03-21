-- ============================================================
-- App Connections: stores integration credentials & state
-- per organization (replaces localStorage store).
-- ============================================================

-- 1. Table
create table if not exists public.app_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  app_id        text not null,                  -- matches Integration.id (e.g. 'stripe', 'twilio')
  status        text not null default 'connected'
                  check (status in ('connected','disconnected','error')),
  credentials   jsonb not null default '{}'::jsonb,  -- encrypted at rest by Supabase
  connected_at  timestamptz not null default now(),
  last_tested   timestamptz,
  error_message text,
  connected_by  uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- one connection per app per org
  unique (org_id, app_id)
);

-- 2. Indexes
create index if not exists idx_app_connections_org   on public.app_connections(org_id);
create index if not exists idx_app_connections_app   on public.app_connections(app_id);
create index if not exists idx_app_connections_status on public.app_connections(org_id, status);

-- 3. RLS
alter table public.app_connections enable row level security;

-- Members of the org can read connections
create policy "app_connections_select"
  on public.app_connections for select
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
    )
  );

-- Owners and admins can insert
create policy "app_connections_insert"
  on public.app_connections for insert
  with check (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Owners and admins can update
create policy "app_connections_update"
  on public.app_connections for update
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Owners can delete
create policy "app_connections_delete"
  on public.app_connections for delete
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- 4. Updated_at trigger
create or replace function public.set_app_connections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists trg_app_connections_updated_at on public.app_connections;
create trigger trg_app_connections_updated_at
  before update on public.app_connections
  for each row execute function public.set_app_connections_updated_at();
