-- ============================================================
-- COMBINED PENDING MIGRATIONS — Run in Supabase SQL Editor
-- Includes: RLS fixes, storage buckets, recurring invoices,
--           client_tags table, clients.notes column
-- ============================================================

BEGIN;

-- ============================================================
-- A) CLIENTS: add notes column if missing
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================
-- B) CLIENT_TAGS table (for tagging clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, tag)
);

ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_tags_select ON public.client_tags;
CREATE POLICY client_tags_select ON public.client_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.memberships m ON m.org_id = c.org_id
      WHERE c.id = client_tags.client_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_tags_insert ON public.client_tags;
CREATE POLICY client_tags_insert ON public.client_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.memberships m ON m.org_id = c.org_id
      WHERE c.id = client_tags.client_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_tags_delete ON public.client_tags;
CREATE POLICY client_tags_delete ON public.client_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.memberships m ON m.org_id = c.org_id
      WHERE c.id = client_tags.client_id AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- C) FIX RLS POLICIES — scope to org membership
-- ============================================================

-- 1. AUTOMATIONS
DROP POLICY IF EXISTS automations_auth ON public.automations;
DROP POLICY IF EXISTS automations_select_org ON public.automations;
CREATE POLICY automations_select_org ON public.automations
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = automations.org_id));

DROP POLICY IF EXISTS automations_insert_org ON public.automations;
CREATE POLICY automations_insert_org ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = automations.org_id));

DROP POLICY IF EXISTS automations_update_org ON public.automations;
CREATE POLICY automations_update_org ON public.automations
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = automations.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = automations.org_id));

DROP POLICY IF EXISTS automations_delete_org ON public.automations;
CREATE POLICY automations_delete_org ON public.automations
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = automations.org_id));

-- 2. TIME_ENTRIES
DROP POLICY IF EXISTS time_entries_auth ON public.time_entries;
DROP POLICY IF EXISTS time_entries_select_org ON public.time_entries;
CREATE POLICY time_entries_select_org ON public.time_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id));

DROP POLICY IF EXISTS time_entries_insert_org ON public.time_entries;
CREATE POLICY time_entries_insert_org ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id));

DROP POLICY IF EXISTS time_entries_update_org ON public.time_entries;
CREATE POLICY time_entries_update_org ON public.time_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id));

DROP POLICY IF EXISTS time_entries_delete_org ON public.time_entries;
CREATE POLICY time_entries_delete_org ON public.time_entries
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = time_entries.org_id));

-- 3. QUOTE_VIEWS
DROP POLICY IF EXISTS quote_views_auth ON public.quote_views;
DROP POLICY IF EXISTS quote_views_select_org ON public.quote_views;
CREATE POLICY quote_views_select_org ON public.quote_views
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = quote_views.invoice_id
      AND auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = i.org_id)
  ));

DROP POLICY IF EXISTS quote_views_insert_org ON public.quote_views;
CREATE POLICY quote_views_insert_org ON public.quote_views
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = quote_views.invoice_id
      AND auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = i.org_id)
  ));

DROP POLICY IF EXISTS quote_views_update_org ON public.quote_views;
CREATE POLICY quote_views_update_org ON public.quote_views
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = quote_views.invoice_id
      AND auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = i.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = quote_views.invoice_id
      AND auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = i.org_id)
  ));

DROP POLICY IF EXISTS quote_views_delete_org ON public.quote_views;
CREATE POLICY quote_views_delete_org ON public.quote_views
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = quote_views.invoice_id
      AND auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = i.org_id)
  ));

DROP POLICY IF EXISTS quote_views_insert_anon ON public.quote_views;
CREATE POLICY quote_views_insert_anon ON public.quote_views
  FOR INSERT TO anon
  WITH CHECK (true);

-- 4. COMPANY_SETTINGS
DROP POLICY IF EXISTS company_settings_auth ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings for their org" ON public.company_settings;
DROP POLICY IF EXISTS "Users can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can update company settings" ON public.company_settings;

DROP POLICY IF EXISTS company_settings_select_org ON public.company_settings;
CREATE POLICY company_settings_select_org ON public.company_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id));

DROP POLICY IF EXISTS company_settings_insert_org ON public.company_settings;
CREATE POLICY company_settings_insert_org ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id));

DROP POLICY IF EXISTS company_settings_update_org ON public.company_settings;
CREATE POLICY company_settings_update_org ON public.company_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id));

DROP POLICY IF EXISTS company_settings_delete_org ON public.company_settings;
CREATE POLICY company_settings_delete_org ON public.company_settings
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = company_settings.org_id));

-- 5. NOTIFICATIONS
DROP POLICY IF EXISTS notifications_auth ON public.notifications;
DROP POLICY IF EXISTS notifications_select_org ON public.notifications;
CREATE POLICY notifications_select_org ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id));

DROP POLICY IF EXISTS notifications_insert_org ON public.notifications;
CREATE POLICY notifications_insert_org ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id));

DROP POLICY IF EXISTS notifications_update_org ON public.notifications;
CREATE POLICY notifications_update_org ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id));

DROP POLICY IF EXISTS notifications_delete_org ON public.notifications;
CREATE POLICY notifications_delete_org ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = notifications.org_id));

-- 6. CONVERSATIONS
DROP POLICY IF EXISTS conversations_auth ON public.conversations;
DROP POLICY IF EXISTS conversations_select_org ON public.conversations;
CREATE POLICY conversations_select_org ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id));

DROP POLICY IF EXISTS conversations_insert_org ON public.conversations;
CREATE POLICY conversations_insert_org ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id));

DROP POLICY IF EXISTS conversations_update_org ON public.conversations;
CREATE POLICY conversations_update_org ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id));

DROP POLICY IF EXISTS conversations_delete_org ON public.conversations;
CREATE POLICY conversations_delete_org ON public.conversations
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = conversations.org_id));

-- 7. MESSAGES
DROP POLICY IF EXISTS messages_auth ON public.messages;
DROP POLICY IF EXISTS messages_select_org ON public.messages;
CREATE POLICY messages_select_org ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = messages.org_id));

DROP POLICY IF EXISTS messages_insert_org ON public.messages;
CREATE POLICY messages_insert_org ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = messages.org_id));

DROP POLICY IF EXISTS messages_update_org ON public.messages;
CREATE POLICY messages_update_org ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = messages.org_id))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = messages.org_id));

DROP POLICY IF EXISTS messages_delete_org ON public.messages;
CREATE POLICY messages_delete_org ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = messages.org_id));

-- 8. TEAM_MEMBERS insert fix
DROP POLICY IF EXISTS "Users can insert team members" ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_org ON public.team_members;
CREATE POLICY team_members_insert_org ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.memberships WHERE org_id = team_members.org_id));

-- ============================================================
-- D) STORAGE BUCKETS + POLICIES
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('company-logos', 'company-logos', true),
  ('job-photos', 'job-photos', true),
  ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

-- company-logos
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload company logos"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
CREATE POLICY "Authenticated users can update company logos"
  ON storage.objects FOR UPDATE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete company logos"
  ON storage.objects FOR DELETE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

-- job-photos
DROP POLICY IF EXISTS "Anyone can view job photos" ON storage.objects;
CREATE POLICY "Anyone can view job photos"
  ON storage.objects FOR SELECT USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS "Authenticated users can upload job photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload job photos"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update job photos" ON storage.objects;
CREATE POLICY "Authenticated users can update job photos"
  ON storage.objects FOR UPDATE USING (bucket_id = 'job-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete job photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete job photos"
  ON storage.objects FOR DELETE USING (bucket_id = 'job-photos' AND auth.role() = 'authenticated');

-- attachments
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view attachments"
  ON storage.objects FOR SELECT USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update attachments"
  ON storage.objects FOR UPDATE USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
  ON storage.objects FOR DELETE USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

-- ============================================================
-- E) RECURRING INVOICES
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval text,
  ADD COLUMN IF NOT EXISTS next_recurrence_date date,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid;

-- Safe constraint add (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_recurrence_interval' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT chk_recurrence_interval
      CHECK (recurrence_interval IS NULL OR recurrence_interval IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_parent_invoice' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_parent_invoice
      FOREIGN KEY (parent_invoice_id) REFERENCES invoices(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_recurring_due
  ON invoices (next_recurrence_date)
  WHERE is_recurring = true AND deleted_at IS NULL;

COMMIT;
