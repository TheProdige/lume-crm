-- ============================================================
-- Automations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger text NOT NULL CHECK (trigger IN (
    'days_after_quote_sent',
    'days_before_appointment',
    'on_invoice_due_date',
    'days_after_invoice_due',
    'days_after_job_completed',
    'custom'
  )),
  delay_value integer NOT NULL DEFAULT 0,
  delay_unit text NOT NULL DEFAULT 'days' CHECK (delay_unit IN ('hours', 'days')),
  message_template text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'follow_up' CHECK (category IN ('appointment', 'invoice', 'quote', 'follow_up')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_org ON public.automations(org_id);
CREATE INDEX IF NOT EXISTS idx_automations_active ON public.automations(org_id, active);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY automations_auth ON public.automations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Time entries table (Timesheets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_name text,
  date date NOT NULL,
  punch_in time NOT NULL,
  punch_out time,
  breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_org ON public.time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(org_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON public.time_entries(employee_id, date);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_entries_auth ON public.time_entries
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Quote views table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_views_invoice ON public.quote_views(invoice_id, viewed_at DESC);

ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_views_auth ON public.quote_views
  FOR ALL USING (auth.uid() IS NOT NULL);

-- View tracking columns on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS view_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_viewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_view_token ON public.invoices(view_token);

-- ============================================================
-- Company settings table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  company_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  street1 text NOT NULL DEFAULT '',
  street2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_settings_auth ON public.company_settings
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Notifications table (if not exists)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  icon text,
  link text,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(org_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_auth ON public.notifications
  FOR ALL USING (auth.uid() IS NOT NULL);
