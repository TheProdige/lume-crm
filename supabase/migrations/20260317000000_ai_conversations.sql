-- ═══════════════════════════════════════════════════════════════
-- AI Conversations, Messages & Files
-- Full storage architecture for the CRM AI assistant
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. ai_conversations ─────────────────────────────────────

create table if not exists public.ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  created_by    uuid not null references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,

  title         text,                                       -- auto-generated or user-set
  model         text not null default 'llama3.2',           -- default model for this convo
  provider      text not null default 'ollama'              -- 'ollama', 'openai', 'anthropic', etc.
                check (provider in ('ollama', 'openai', 'anthropic', 'custom')),
  status        text not null default 'active'
                check (status in ('active', 'archived', 'deleted')),

  -- denormalized for fast list queries
  last_message_preview  text,                               -- first 200 chars of last message
  last_message_role     text,                               -- 'user' | 'assistant'
  last_message_at       timestamptz,
  message_count         integer not null default 0,

  -- aggregated usage
  total_input_tokens    integer not null default 0,
  total_output_tokens   integer not null default 0,
  total_estimated_cost  numeric(12,6) not null default 0,

  -- extensibility
  metadata      jsonb not null default '{}',                -- tags, context, pinned, etc.

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index if not exists ai_conversations_org_idx
  on public.ai_conversations(org_id);
create index if not exists ai_conversations_created_by_idx
  on public.ai_conversations(org_id, created_by, last_message_at desc);
create index if not exists ai_conversations_client_idx
  on public.ai_conversations(client_id)
  where client_id is not null;
create index if not exists ai_conversations_status_idx
  on public.ai_conversations(org_id, status);

-- ─── 2. ai_messages ──────────────────────────────────────────

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,

  role            text not null
                  check (role in ('user', 'assistant', 'system', 'tool')),
  content         text not null default '',

  -- model & provider at message level (can differ per message)
  model           text,                                     -- e.g. 'llama3.2', 'gpt-4o', etc.
  provider        text,                                     -- 'ollama', 'openai', etc.

  -- token usage (nullable — not always available)
  input_tokens    integer,
  output_tokens   integer,
  total_tokens    integer,
  estimated_cost  numeric(12,6),                            -- in USD

  -- timing
  duration_ms     integer,                                  -- response generation time

  -- full raw API payload for debugging/auditing
  raw_request     jsonb,                                    -- what was sent to the model
  raw_response    jsonb,                                    -- what came back

  -- extensibility
  metadata        jsonb not null default '{}',              -- tool_calls, function results, etc.

  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists ai_messages_conversation_idx
  on public.ai_messages(conversation_id, created_at);
create index if not exists ai_messages_org_idx
  on public.ai_messages(org_id);
create index if not exists ai_messages_role_idx
  on public.ai_messages(conversation_id, role);

-- ─── 3. ai_message_files ─────────────────────────────────────

create table if not exists public.ai_message_files (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  message_id      uuid not null references public.ai_messages(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,

  file_name       text not null,
  mime_type       text,
  file_size       integer,                                  -- bytes
  storage_path    text not null,                            -- Supabase Storage path
  storage_bucket  text not null default 'ai-files',

  -- for future RAG
  extracted_text  text,                                     -- text extracted from file
  embedding_id    uuid,                                     -- reference to vector store

  metadata        jsonb not null default '{}',

  created_at      timestamptz not null default now()
);

create index if not exists ai_message_files_message_idx
  on public.ai_message_files(message_id);
create index if not exists ai_message_files_conversation_idx
  on public.ai_message_files(conversation_id);

-- ─── 4. updated_at trigger ───────────────────────────────────

create or replace function public.ai_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.ai_set_updated_at();

-- ─── 5. Auto-update conversation stats on new message ────────

create or replace function public.ai_on_message_insert()
returns trigger as $$
begin
  update public.ai_conversations
  set
    last_message_preview = left(new.content, 200),
    last_message_role    = new.role,
    last_message_at      = new.created_at,
    message_count        = message_count + 1,
    total_input_tokens   = total_input_tokens + coalesce(new.input_tokens, 0),
    total_output_tokens  = total_output_tokens + coalesce(new.output_tokens, 0),
    total_estimated_cost = total_estimated_cost + coalesce(new.estimated_cost, 0)
  where id = new.conversation_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_messages_after_insert on public.ai_messages;
create trigger ai_messages_after_insert
  after insert on public.ai_messages
  for each row execute function public.ai_on_message_insert();

-- ─── 6. Org scope enforcement ────────────────────────────────
-- Use the existing crm_enforce_scope pattern if available, otherwise:

create or replace function public.ai_enforce_org_scope()
returns trigger as $$
declare
  v_org uuid;
begin
  -- Try to get org from current_org_id() if it exists
  begin
    v_org := public.current_org_id();
  exception when others then
    v_org := null;
  end;

  if v_org is not null then
    new.org_id := v_org;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_conversations_enforce_org on public.ai_conversations;
create trigger ai_conversations_enforce_org
  before insert on public.ai_conversations
  for each row execute function public.ai_enforce_org_scope();

drop trigger if exists ai_messages_enforce_org on public.ai_messages;
create trigger ai_messages_enforce_org
  before insert on public.ai_messages
  for each row execute function public.ai_enforce_org_scope();

drop trigger if exists ai_message_files_enforce_org on public.ai_message_files;
create trigger ai_message_files_enforce_org
  before insert on public.ai_message_files
  for each row execute function public.ai_enforce_org_scope();

-- ─── 7. Row Level Security ───────────────────────────────────

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_message_files enable row level security;

-- Conversations: users can only see their own org's conversations
create policy "ai_conversations_select" on public.ai_conversations
  for select using (org_id = public.current_org_id());

create policy "ai_conversations_insert" on public.ai_conversations
  for insert with check (org_id = public.current_org_id());

create policy "ai_conversations_update" on public.ai_conversations
  for update using (org_id = public.current_org_id());

create policy "ai_conversations_delete" on public.ai_conversations
  for delete using (org_id = public.current_org_id() and created_by = auth.uid());

-- Messages: same org scoping
create policy "ai_messages_select" on public.ai_messages
  for select using (org_id = public.current_org_id());

create policy "ai_messages_insert" on public.ai_messages
  for insert with check (org_id = public.current_org_id());

-- Files: same org scoping
create policy "ai_message_files_select" on public.ai_message_files
  for select using (org_id = public.current_org_id());

create policy "ai_message_files_insert" on public.ai_message_files
  for insert with check (org_id = public.current_org_id());

-- ─── 8. Helper RPC: list recent conversations ────────────────

create or replace function public.rpc_ai_recent_conversations(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id              uuid,
  title           text,
  model           text,
  provider        text,
  status          text,
  client_id       uuid,
  client_name     text,
  last_message_preview  text,
  last_message_role     text,
  last_message_at       timestamptz,
  message_count   integer,
  total_input_tokens    integer,
  total_output_tokens   integer,
  total_estimated_cost  numeric,
  created_at      timestamptz
)
language sql stable security definer as $$
  select
    c.id,
    c.title,
    c.model,
    c.provider,
    c.status,
    c.client_id,
    cl.first_name || ' ' || cl.last_name as client_name,
    c.last_message_preview,
    c.last_message_role,
    c.last_message_at,
    c.message_count,
    c.total_input_tokens,
    c.total_output_tokens,
    c.total_estimated_cost,
    c.created_at
  from public.ai_conversations c
  left join public.clients cl on cl.id = c.client_id
  where c.org_id = public.current_org_id()
    and c.status = 'active'
  order by c.last_message_at desc nulls last
  limit p_limit
  offset p_offset;
$$;

-- ─── Done ────────────────────────────────────────────────────
