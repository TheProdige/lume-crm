-- ============================================================
-- Quote View Tracking: tracking columns, views log, notifications
-- ============================================================

-- 1. Add view tracking columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS view_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_viewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Ensure unique token index
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_view_token ON public.invoices(view_token);

-- Backfill tokens for existing invoices that got NULL
UPDATE public.invoices SET view_token = gen_random_uuid() WHERE view_token IS NULL;

-- 2. Detailed view log table
CREATE TABLE IF NOT EXISTS public.quote_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_quote_views_invoice ON public.quote_views(invoice_id, viewed_at DESC);

ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_views_auth ON public.quote_views
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. In-app notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid,                              -- target user (NULL = all org users)
  type text NOT NULL,                        -- 'quote_opened', 'payment_received', etc.
  title text NOT NULL,
  body text,
  icon text,                                 -- icon name for UI
  link text,                                 -- relative URL to navigate to
  reference_id uuid,                         -- related entity ID
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_org ON public.notifications(org_id, created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_auth ON public.notifications
  FOR ALL USING (auth.uid() IS NOT NULL);
