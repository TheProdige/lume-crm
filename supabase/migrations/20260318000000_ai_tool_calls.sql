-- ═══════════════════════════════════════════════════════════════
-- AI Tool Calls — Logging table for all AI tool executions
-- ═══════════════════════════════════════════════════════════════

create table if not exists ai_tool_calls (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  message_id    uuid references ai_messages(id) on delete set null,
  tool_id       text not null,
  tool_category text not null check (tool_category in ('read', 'write', 'action')),
  parameters    jsonb not null default '{}',
  result_success boolean not null default false,
  result_data   jsonb,
  result_error  text,
  duration_ms   integer not null default 0,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_ai_tool_calls_org      on ai_tool_calls(org_id);
create index if not exists idx_ai_tool_calls_conv     on ai_tool_calls(conversation_id);
create index if not exists idx_ai_tool_calls_tool     on ai_tool_calls(tool_id);
create index if not exists idx_ai_tool_calls_created  on ai_tool_calls(created_at desc);

-- RLS
alter table ai_tool_calls enable row level security;

-- Users can read their own org's tool calls
create policy "ai_tool_calls_select_own_org"
  on ai_tool_calls for select
  using (org_id = (select current_setting('app.current_org_id', true))::uuid);

-- Users can insert tool calls for their org
create policy "ai_tool_calls_insert_own_org"
  on ai_tool_calls for insert
  with check (org_id = (select current_setting('app.current_org_id', true))::uuid);

-- Org scope enforcement trigger (reuse from ai_conversations)
create trigger ai_tool_calls_enforce_org
  before insert on ai_tool_calls
  for each row execute function ai_enforce_org_scope();

comment on table ai_tool_calls is 'Audit log of all AI tool executions with parameters, results, and timing.';
