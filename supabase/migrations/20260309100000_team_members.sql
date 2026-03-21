-- Team members table for managing users with roles and status
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  phone text not null default '',
  role text not null default 'technician' check (role in ('owner', 'admin', 'technician')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast org lookups
create index if not exists idx_team_members_org_id on public.team_members(org_id);
create index if not exists idx_team_members_email on public.team_members(email);

-- RLS
alter table public.team_members enable row level security;

create policy "Users can view team members in their org"
  on public.team_members for select
  using (
    org_id in (
      select m.org_id from public.memberships m where m.user_id = auth.uid()
    )
    or org_id is null
  );

create policy "Users can insert team members"
  on public.team_members for insert
  with check (auth.uid() is not null);

create policy "Users can update team members in their org"
  on public.team_members for update
  using (
    org_id in (
      select m.org_id from public.memberships m where m.user_id = auth.uid()
    )
    or org_id is null
  );

create policy "Users can delete team members in their org"
  on public.team_members for delete
  using (
    org_id in (
      select m.org_id from public.memberships m where m.user_id = auth.uid()
    )
    or org_id is null
  );
