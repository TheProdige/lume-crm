-- ============================================================
-- Fix RLS policies: scope all table access to org membership
--
-- Previous policies used `auth.uid() IS NOT NULL` which allows
-- any authenticated user to read/write any org's data.
-- This migration replaces them with proper org-scoped checks.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. AUTOMATIONS (has org_id)
-- ============================================================
DROP POLICY IF EXISTS automations_auth ON public.automations;

DROP POLICY IF EXISTS automations_select_org ON public.automations;
CREATE POLICY automations_select_org ON public.automations
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = automations.org_id
    )
  );

DROP POLICY IF EXISTS automations_insert_org ON public.automations;
CREATE POLICY automations_insert_org ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = automations.org_id
    )
  );

DROP POLICY IF EXISTS automations_update_org ON public.automations;
CREATE POLICY automations_update_org ON public.automations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = automations.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = automations.org_id
    )
  );

DROP POLICY IF EXISTS automations_delete_org ON public.automations;
CREATE POLICY automations_delete_org ON public.automations
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = automations.org_id
    )
  );

-- ============================================================
-- 2. TIME_ENTRIES (has org_id)
-- ============================================================
DROP POLICY IF EXISTS time_entries_auth ON public.time_entries;

DROP POLICY IF EXISTS time_entries_select_org ON public.time_entries;
CREATE POLICY time_entries_select_org ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id
    )
  );

DROP POLICY IF EXISTS time_entries_insert_org ON public.time_entries;
CREATE POLICY time_entries_insert_org ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id
    )
  );

DROP POLICY IF EXISTS time_entries_update_org ON public.time_entries;
CREATE POLICY time_entries_update_org ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id
    )
  );

DROP POLICY IF EXISTS time_entries_delete_org ON public.time_entries;
CREATE POLICY time_entries_delete_org ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id
    )
  );

-- ============================================================
-- 3. QUOTE_VIEWS (no org_id - scoped via invoice -> org_id)
--    Users can only see/manage quote_views for invoices in their org.
-- ============================================================
DROP POLICY IF EXISTS quote_views_auth ON public.quote_views;

DROP POLICY IF EXISTS quote_views_select_org ON public.quote_views;
CREATE POLICY quote_views_select_org ON public.quote_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = quote_views.invoice_id
        AND auth.uid() IN (
          SELECT user_id FROM public.memberships WHERE org_id = i.org_id
        )
    )
  );

DROP POLICY IF EXISTS quote_views_insert_org ON public.quote_views;
CREATE POLICY quote_views_insert_org ON public.quote_views
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = quote_views.invoice_id
        AND auth.uid() IN (
          SELECT user_id FROM public.memberships WHERE org_id = i.org_id
        )
    )
  );

DROP POLICY IF EXISTS quote_views_update_org ON public.quote_views;
CREATE POLICY quote_views_update_org ON public.quote_views
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = quote_views.invoice_id
        AND auth.uid() IN (
          SELECT user_id FROM public.memberships WHERE org_id = i.org_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = quote_views.invoice_id
        AND auth.uid() IN (
          SELECT user_id FROM public.memberships WHERE org_id = i.org_id
        )
    )
  );

DROP POLICY IF EXISTS quote_views_delete_org ON public.quote_views;
CREATE POLICY quote_views_delete_org ON public.quote_views
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = quote_views.invoice_id
        AND auth.uid() IN (
          SELECT user_id FROM public.memberships WHERE org_id = i.org_id
        )
    )
  );

-- Allow anonymous/public inserts for quote view tracking (clients viewing quotes)
DROP POLICY IF EXISTS quote_views_insert_anon ON public.quote_views;
CREATE POLICY quote_views_insert_anon ON public.quote_views
  FOR INSERT TO anon
  WITH CHECK (true);

-- ============================================================
-- 4. COMPANY_SETTINGS (has org_id)
--    Drop old permissive policies from both the original migration
--    and the automations_timesheets migration, then recreate properly.
-- ============================================================
DROP POLICY IF EXISTS company_settings_auth ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings for their org" ON public.company_settings;
DROP POLICY IF EXISTS "Users can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can update company settings" ON public.company_settings;

DROP POLICY IF EXISTS company_settings_select_org ON public.company_settings;
CREATE POLICY company_settings_select_org ON public.company_settings
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id
    )
  );

DROP POLICY IF EXISTS company_settings_insert_org ON public.company_settings;
CREATE POLICY company_settings_insert_org ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id
    )
  );

DROP POLICY IF EXISTS company_settings_update_org ON public.company_settings;
CREATE POLICY company_settings_update_org ON public.company_settings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id
    )
  );

DROP POLICY IF EXISTS company_settings_delete_org ON public.company_settings;
CREATE POLICY company_settings_delete_org ON public.company_settings
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id
    )
  );

-- ============================================================
-- 5. NOTIFICATIONS (has org_id)
-- ============================================================
DROP POLICY IF EXISTS notifications_auth ON public.notifications;

DROP POLICY IF EXISTS notifications_select_org ON public.notifications;
CREATE POLICY notifications_select_org ON public.notifications
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id
    )
  );

DROP POLICY IF EXISTS notifications_insert_org ON public.notifications;
CREATE POLICY notifications_insert_org ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id
    )
  );

DROP POLICY IF EXISTS notifications_update_org ON public.notifications;
CREATE POLICY notifications_update_org ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id
    )
  );

DROP POLICY IF EXISTS notifications_delete_org ON public.notifications;
CREATE POLICY notifications_delete_org ON public.notifications
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id
    )
  );

-- ============================================================
-- 6. CONVERSATIONS (has org_id)
-- ============================================================
DROP POLICY IF EXISTS conversations_auth ON public.conversations;

DROP POLICY IF EXISTS conversations_select_org ON public.conversations;
CREATE POLICY conversations_select_org ON public.conversations
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id
    )
  );

DROP POLICY IF EXISTS conversations_insert_org ON public.conversations;
CREATE POLICY conversations_insert_org ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id
    )
  );

DROP POLICY IF EXISTS conversations_update_org ON public.conversations;
CREATE POLICY conversations_update_org ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id
    )
  );

DROP POLICY IF EXISTS conversations_delete_org ON public.conversations;
CREATE POLICY conversations_delete_org ON public.conversations
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id
    )
  );

-- ============================================================
-- 7. MESSAGES (has org_id)
-- ============================================================
DROP POLICY IF EXISTS messages_auth ON public.messages;

DROP POLICY IF EXISTS messages_select_org ON public.messages;
CREATE POLICY messages_select_org ON public.messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = messages.org_id
    )
  );

DROP POLICY IF EXISTS messages_insert_org ON public.messages;
CREATE POLICY messages_insert_org ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = messages.org_id
    )
  );

DROP POLICY IF EXISTS messages_update_org ON public.messages;
CREATE POLICY messages_update_org ON public.messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = messages.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = messages.org_id
    )
  );

DROP POLICY IF EXISTS messages_delete_org ON public.messages;
CREATE POLICY messages_delete_org ON public.messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = messages.org_id
    )
  );

-- ============================================================
-- 8. TEAM_MEMBERS - fix INSERT policy (was auth.uid() is not null)
--    Keep existing SELECT/UPDATE/DELETE which are already org-scoped.
-- ============================================================
DROP POLICY IF EXISTS "Users can insert team members" ON public.team_members;

DROP POLICY IF EXISTS team_members_insert_org ON public.team_members;
CREATE POLICY team_members_insert_org ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = team_members.org_id
    )
  );

COMMIT;
