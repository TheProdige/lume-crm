-- ═══════════════════════════════════════════════════════════════
-- Custom Fields / Dynamic Columns (Monday.com / Airtable style)
-- ═══════════════════════════════════════════════════════════════

-- ── custom_columns ──────────────────────────────────────────────
-- Defines a column (field) for a given entity (clients, jobs, invoices).
create table if not exists public.custom_columns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  entity      text not null check (entity in ('clients', 'jobs', 'invoices')),
  name        text not null,
  col_type    text not null check (col_type in (
    'text', 'number', 'status', 'dropdown', 'date', 'checkbox',
    'email', 'phone', 'url', 'currency', 'rating', 'label'
  )),
  -- JSON config: dropdown options, status colors, currency code, etc.
  config      jsonb not null default '{}',
  -- Display order (0-based)
  position    int not null default 0,
  -- Visibility
  visible     boolean not null default true,
  -- Required field
  required    boolean not null default false,
  -- Timestamps
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Soft delete
  deleted_at  timestamptz
);

-- Unique column name per entity per org
create unique index if not exists custom_columns_org_entity_name_uniq
  on public.custom_columns(org_id, entity, name)
  where deleted_at is null;

-- Fast lookup
create index if not exists custom_columns_org_entity_idx
  on public.custom_columns(org_id, entity)
  where deleted_at is null;

-- ── custom_column_values ────────────────────────────────────────
-- Stores the value for a given record × column intersection (EAV pattern).
create table if not exists public.custom_column_values (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  column_id   uuid not null references public.custom_columns(id) on delete cascade,
  record_id   uuid not null,  -- FK to clients.id / jobs.id / invoices.id
  -- Store values in typed columns for query performance
  value_text      text,
  value_number    numeric,
  value_boolean   boolean,
  value_date      date,
  value_json      jsonb,       -- for arrays, status objects, etc.
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One value per record per column
create unique index if not exists custom_column_values_record_col_uniq
  on public.custom_column_values(column_id, record_id);

-- Fast lookup by record
create index if not exists custom_column_values_record_idx
  on public.custom_column_values(record_id);

-- Fast lookup by column
create index if not exists custom_column_values_column_idx
  on public.custom_column_values(column_id);

-- ── RLS policies ────────────────────────────────────────────────
alter table public.custom_columns enable row level security;
alter table public.custom_column_values enable row level security;

-- custom_columns policies
drop policy if exists "custom_columns_select" on public.custom_columns;
create policy "custom_columns_select" on public.custom_columns
  for select using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_columns_insert" on public.custom_columns;
create policy "custom_columns_insert" on public.custom_columns
  for insert with check (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_columns_update" on public.custom_columns;
create policy "custom_columns_update" on public.custom_columns
  for update using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_columns_delete" on public.custom_columns;
create policy "custom_columns_delete" on public.custom_columns
  for delete using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- custom_column_values policies
drop policy if exists "custom_column_values_select" on public.custom_column_values;
create policy "custom_column_values_select" on public.custom_column_values
  for select using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_column_values_insert" on public.custom_column_values;
create policy "custom_column_values_insert" on public.custom_column_values
  for insert with check (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_column_values_update" on public.custom_column_values;
create policy "custom_column_values_update" on public.custom_column_values
  for update using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "custom_column_values_delete" on public.custom_column_values;
create policy "custom_column_values_delete" on public.custom_column_values
  for delete using (org_id in (
    select org_id from public.memberships where user_id = auth.uid()
  ));

-- ── Updated_at trigger ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists custom_columns_updated_at on public.custom_columns;
create trigger custom_columns_updated_at
  before update on public.custom_columns
  for each row execute function public.set_updated_at();

drop trigger if exists custom_column_values_updated_at on public.custom_column_values;
create trigger custom_column_values_updated_at
  before update on public.custom_column_values
  for each row execute function public.set_updated_at();
