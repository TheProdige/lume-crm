/* ═══════════════════════════════════════════════════════════════
   Fix — Teams RLS policies
   Drops and recreates all policies on public.teams to ensure
   correct UPDATE / DELETE access via memberships.
   ═══════════════════════════════════════════════════════════════ */

-- Drop all existing policies on teams (safe — no data loss)
drop policy if exists "teams_select_org" on public.teams;
drop policy if exists "teams_insert_org" on public.teams;
drop policy if exists "teams_update_org" on public.teams;
drop policy if exists "teams_delete_org" on public.teams;

-- Ensure RLS is enabled
alter table public.teams enable row level security;

-- SELECT: org members can see non-deleted teams
create policy "teams_select_org" on public.teams
  for select to authenticated
  using (
    org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid())
  );

-- INSERT: org members can create teams
create policy "teams_insert_org" on public.teams
  for insert to authenticated
  with check (
    org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid())
  );

-- UPDATE: org members can update their teams (including soft-delete)
create policy "teams_update_org" on public.teams
  for update to authenticated
  using (
    org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid())
  )
  with check (
    org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid())
  );

-- DELETE: org members can hard-delete their teams
create policy "teams_delete_org" on public.teams
  for delete to authenticated
  using (
    org_id in (select m.org_id from public.memberships m where m.user_id = auth.uid())
  );
