-- ═══════════════════════════════════════════════════════════════
-- Workflows — Visual Automation Builder
-- ═══════════════════════════════════════════════════════════════

-- ── workflows ───────────────────────────────────────────────────
create table if not exists public.workflows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  description text,
  active      boolean not null default false,
  trigger_type text not null,
  trigger_config jsonb not null default '{}',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workflows_org_idx on public.workflows(org_id);
create index if not exists workflows_active_idx on public.workflows(org_id, active) where active = true;

-- ── workflow_nodes ──────────────────────────────────────────────
create table if not exists public.workflow_nodes (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows(id) on delete cascade,
  node_type     text not null check (node_type in ('trigger', 'condition', 'action')),
  action_type   text,       -- send_sms, send_email, create_task, assign_user, update_status, add_tag, create_note, schedule_reminder, request_review, send_notification, call_webhook, trigger_n8n
  label         text,
  config        jsonb not null default '{}',
  position_x    double precision not null default 0,
  position_y    double precision not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists workflow_nodes_wf_idx on public.workflow_nodes(workflow_id);

-- ── workflow_edges ──────────────────────────────────────────────
create table if not exists public.workflow_edges (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows(id) on delete cascade,
  source_id     uuid not null references public.workflow_nodes(id) on delete cascade,
  target_id     uuid not null references public.workflow_nodes(id) on delete cascade,
  source_handle text,
  target_handle text,
  label         text,
  created_at    timestamptz not null default now()
);

create index if not exists workflow_edges_wf_idx on public.workflow_edges(workflow_id);

-- ── workflow_runs ───────────────────────────────────────────────
create table if not exists public.workflow_runs (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows(id) on delete cascade,
  org_id        uuid not null references public.orgs(id) on delete cascade,
  status        text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  trigger_data  jsonb,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  duration_ms   integer,
  error_msg     text,
  nodes_executed integer not null default 0
);

create index if not exists workflow_runs_wf_idx on public.workflow_runs(workflow_id, started_at desc);
create index if not exists workflow_runs_org_idx on public.workflow_runs(org_id, started_at desc);

-- ── workflow_logs ───────────────────────────────────────────────
create table if not exists public.workflow_logs (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.workflow_runs(id) on delete cascade,
  node_id       uuid references public.workflow_nodes(id) on delete set null,
  level         text not null default 'info' check (level in ('info', 'warn', 'error', 'debug')),
  message       text not null,
  data          jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists workflow_logs_run_idx on public.workflow_logs(run_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.workflows enable row level security;
alter table public.workflow_nodes enable row level security;
alter table public.workflow_edges enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_logs enable row level security;

create policy "workflows_org" on public.workflows
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

create policy "workflow_nodes_org" on public.workflow_nodes
  for all using (workflow_id in (
    select id from public.workflows where org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  ));

create policy "workflow_edges_org" on public.workflow_edges
  for all using (workflow_id in (
    select id from public.workflows where org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  ));

create policy "workflow_runs_org" on public.workflow_runs
  for all using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

create policy "workflow_logs_org" on public.workflow_logs
  for all using (run_id in (
    select id from public.workflow_runs where org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  ));

-- ── Updated_at triggers ─────────────────────────────────────────
drop trigger if exists workflows_updated_at on public.workflows;
create trigger workflows_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();
