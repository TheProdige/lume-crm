-- ============================================================
-- Predefined Services: reusable catalog of services / line items
-- that can be added to jobs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.predefined_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_price_cents integer NOT NULL DEFAULT 0,
  category text,
  default_duration_minutes integer,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups of active services per org
CREATE INDEX idx_predefined_services_org_active
  ON public.predefined_services(org_id, is_active);

-- ============================================================
-- RLS: scope all access via org membership
-- ============================================================
ALTER TABLE public.predefined_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS predefined_services_select_org ON public.predefined_services;
CREATE POLICY predefined_services_select_org ON public.predefined_services
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = predefined_services.org_id
    )
  );

DROP POLICY IF EXISTS predefined_services_insert_org ON public.predefined_services;
CREATE POLICY predefined_services_insert_org ON public.predefined_services
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = predefined_services.org_id
    )
  );

DROP POLICY IF EXISTS predefined_services_update_org ON public.predefined_services;
CREATE POLICY predefined_services_update_org ON public.predefined_services
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = predefined_services.org_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = predefined_services.org_id
    )
  );

DROP POLICY IF EXISTS predefined_services_delete_org ON public.predefined_services;
CREATE POLICY predefined_services_delete_org ON public.predefined_services
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.memberships WHERE org_id = predefined_services.org_id
    )
  );

-- ============================================================
-- Seed example services (only if the table is empty)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.predefined_services LIMIT 1) THEN
    INSERT INTO public.predefined_services (org_id, name, description, default_price_cents, category, sort_order)
    SELECT o.id,
           s.name,
           s.description,
           s.default_price_cents,
           s.category,
           s.sort_order
    FROM public.orgs o
    CROSS JOIN (
      VALUES
        ('Lavage à pression',
         'Nettoyage haute pression des surfaces extérieures',
         47500, 'Nettoyage', 1),
        ('Nettoyage d''entrée de cour',
         'Le nettoyage haute pression de l''allée et entrée',
         23000, 'Nettoyage', 2),
        ('Nettoyage des trottoirs',
         'Nettoyage haute pression des trottoirs publics',
         0, 'Nettoyage', 3),
        ('Nettoyage de moustiquaires',
         'Nettoyage doux des enclos de moustiquaires',
         0, 'Nettoyage', 4),
        ('Nettoyage de toiture',
         'Méthode de nettoyage doux utilisant des produits spécialisés',
         120000, 'Nettoyage', 5),
        ('Lavage à pression commercial',
         'Le nettoyage haute pression des propriétés commerciales',
         43500, 'Commercial', 6),
        ('Nettoyage de revêtement',
         'Nettoyage en profondeur du revêtement extérieur',
         35000, 'Nettoyage', 7)
    ) AS s(name, description, default_price_cents, category, sort_order);
  END IF;
END;
$$;
