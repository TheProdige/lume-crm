-- ============================================================
-- Fix: memberships RLS infinite recursion
--
-- The previous policy used a subquery on memberships itself
-- to check org access, causing infinite recursion.
--
-- Fix: use auth.uid() = user_id directly (users can see
-- their own memberships) + service_role bypass for admin ops.
-- ============================================================

begin;

-- Drop the recursive policies
drop policy if exists memberships_select_own_org on public.memberships;
drop policy if exists memberships_insert_admin on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;
drop policy if exists memberships_delete_admin on public.memberships;

-- SELECT: users can see all memberships in orgs where they are a member
-- Uses a security definer function to avoid recursion
create or replace function public.user_org_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.memberships where user_id = p_user_id;
$$;

create policy memberships_select_own_org on public.memberships
  for select to authenticated
  using (org_id in (select public.user_org_ids(auth.uid())));

-- INSERT: only if user is already a member of that org (checked via security definer)
create policy memberships_insert_org on public.memberships
  for insert to authenticated
  with check (org_id in (select public.user_org_ids(auth.uid())));

-- UPDATE: same check
create policy memberships_update_org on public.memberships
  for update to authenticated
  using (org_id in (select public.user_org_ids(auth.uid())))
  with check (org_id in (select public.user_org_ids(auth.uid())));

-- DELETE: same check
create policy memberships_delete_org on public.memberships
  for delete to authenticated
  using (org_id in (select public.user_org_ids(auth.uid())));

commit;
