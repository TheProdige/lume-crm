-- ============================================================
-- Migration: Security hardening - RLS on critical missing tables
--
-- Only targets tables that have an org_id column.
-- Child tables (workflow_nodes, note_items, etc.) inherit
-- security via CASCADE from their parent FK.
-- ============================================================

begin;

-- ============================================================
-- 1. memberships — CRITICAL: org membership table itself
-- ============================================================

alter table public.memberships enable row level security;

do $do$
begin
  if not exists (select 1 from pg_policies where tablename = 'memberships' and policyname = 'memberships_select_own_org') then
    create policy memberships_select_own_org on public.memberships
      for select to authenticated
      using (
        org_id in (
          select m.org_id from public.memberships m where m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'memberships' and policyname = 'memberships_insert_admin') then
    create policy memberships_insert_admin on public.memberships
      for insert to authenticated
      with check (public.has_org_membership(auth.uid(), org_id));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'memberships' and policyname = 'memberships_update_admin') then
    create policy memberships_update_admin on public.memberships
      for update to authenticated
      using (public.has_org_membership(auth.uid(), org_id))
      with check (public.has_org_membership(auth.uid(), org_id));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'memberships' and policyname = 'memberships_delete_admin') then
    create policy memberships_delete_admin on public.memberships
      for delete to authenticated
      using (public.has_org_membership(auth.uid(), org_id));
  end if;
end;
$do$;

-- ============================================================
-- 2. tasks — has policies but RLS was not enabled
-- ============================================================

alter table if exists public.tasks enable row level security;

-- ============================================================
-- 3. Tables WITH org_id — enable RLS + add 4 policies each
--    Only includes tables confirmed to have an org_id column.
-- ============================================================

do $rls$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    -- Workflow (only parent + runs have org_id)
    'workflows',
    'workflow_runs',
    -- Notes (only parent tables have org_id)
    'notes',
    'note_boards',
    -- Custom fields
    'custom_columns',
    'custom_column_values',
    -- Automations
    'automation_rules',
    'automation_execution_logs',
    'automation_scheduled_tasks',
    -- Team availability
    'team_date_slots',
    'team_date_availability',
    -- Integrations
    'app_connections',
    'connected_accounts',
    'integration_audit_logs',
    'integration_oauth_states',
    -- Recurring jobs
    'job_recurrence_rules',
    'job_templates'
  ]) loop
    -- Check table exists before proceeding
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      continue;
    end if;

    -- Check table has org_id column
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'org_id'
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    if not exists (select 1 from pg_policies where tablename = tbl and policyname = tbl || '_select_org') then
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.has_org_membership(auth.uid(), org_id))',
        tbl || '_select_org', tbl
      );
    end if;

    if not exists (select 1 from pg_policies where tablename = tbl and policyname = tbl || '_insert_org') then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.has_org_membership(auth.uid(), org_id))',
        tbl || '_insert_org', tbl
      );
    end if;

    if not exists (select 1 from pg_policies where tablename = tbl and policyname = tbl || '_update_org') then
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.has_org_membership(auth.uid(), org_id)) with check (public.has_org_membership(auth.uid(), org_id))',
        tbl || '_update_org', tbl
      );
    end if;

    if not exists (select 1 from pg_policies where tablename = tbl and policyname = tbl || '_delete_org') then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.has_org_membership(auth.uid(), org_id))',
        tbl || '_delete_org', tbl
      );
    end if;
  end loop;
end;
$rls$;

-- ============================================================
-- 4. Activity log
-- ============================================================

do $al$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'activity_log'
  ) then
    return;
  end if;

  execute 'alter table public.activity_log enable row level security';

  if not exists (select 1 from pg_policies where tablename = 'activity_log' and policyname = 'activity_log_select_org') then
    create policy activity_log_select_org on public.activity_log
      for select to authenticated
      using (public.has_org_membership(auth.uid(), org_id));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'activity_log' and policyname = 'activity_log_insert_org') then
    create policy activity_log_insert_org on public.activity_log
      for insert to authenticated
      with check (public.has_org_membership(auth.uid(), org_id));
  end if;
end;
$al$;

commit;
