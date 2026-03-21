-- Director Panel module tables

-- ============================================================
-- 1. director_flows
-- ============================================================
CREATE TABLE director_flows (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid        NOT NULL,
    title           text        NOT NULL,
    slug            text,
    description     text,
    status          text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','archived')),
    created_by      uuid        REFERENCES auth.users(id),
    updated_by      uuid        REFERENCES auth.users(id),
    template_id     uuid,
    linked_campaign_id       uuid,
    linked_product_id        uuid,
    linked_brand_profile_id  uuid,
    thumbnail_asset_id       uuid,
    version_number  int         DEFAULT 1,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_director_flows_org_id ON director_flows(org_id);

-- ============================================================
-- 2. director_nodes
-- ============================================================
CREATE TABLE director_nodes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id     uuid        NOT NULL REFERENCES director_flows(id) ON DELETE CASCADE,
    org_id      uuid        NOT NULL,
    type        text        NOT NULL,
    category    text        NOT NULL,
    title       text        NOT NULL,
    position_x  float       DEFAULT 0,
    position_y  float       DEFAULT 0,
    width       float,
    height      float,
    z_index     int         DEFAULT 0,
    data_json   jsonb       DEFAULT '{}',
    ui_json     jsonb       DEFAULT '{}',
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_director_nodes_org_id  ON director_nodes(org_id);
CREATE INDEX idx_director_nodes_flow_id ON director_nodes(flow_id);

-- ============================================================
-- 3. director_edges
-- ============================================================
CREATE TABLE director_edges (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id         uuid        NOT NULL REFERENCES director_flows(id) ON DELETE CASCADE,
    org_id          uuid        NOT NULL,
    source_node_id  uuid        NOT NULL REFERENCES director_nodes(id) ON DELETE CASCADE,
    target_node_id  uuid        NOT NULL REFERENCES director_nodes(id) ON DELETE CASCADE,
    source_handle   text,
    target_handle   text,
    label           text,
    edge_type       text        DEFAULT 'default',
    data_json       jsonb       DEFAULT '{}',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_director_edges_org_id  ON director_edges(org_id);
CREATE INDEX idx_director_edges_flow_id ON director_edges(flow_id);

-- ============================================================
-- 4. director_runs
-- ============================================================
CREATE TABLE director_runs (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid        NOT NULL,
    flow_id                 uuid        NOT NULL REFERENCES director_flows(id),
    status                  text        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','running','completed','failed','cancelled')),
    triggered_by            uuid        REFERENCES auth.users(id),
    cost_estimate_credits   numeric     DEFAULT 0,
    cost_actual_credits     numeric     DEFAULT 0,
    provider_cost_actual    numeric     DEFAULT 0,
    started_at              timestamptz,
    finished_at             timestamptz,
    error_json              jsonb,
    result_summary_json     jsonb,
    created_at              timestamptz DEFAULT now()
);

CREATE INDEX idx_director_runs_org_id  ON director_runs(org_id);
CREATE INDEX idx_director_runs_flow_id ON director_runs(flow_id);

-- ============================================================
-- 5. director_run_steps
-- ============================================================
CREATE TABLE director_run_steps (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      uuid        NOT NULL REFERENCES director_runs(id) ON DELETE CASCADE,
    node_id     uuid        NOT NULL,
    org_id      uuid        NOT NULL,
    provider    text,
    model       text,
    status      text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','running','completed','failed','skipped')),
    input_json  jsonb       DEFAULT '{}',
    output_json jsonb       DEFAULT '{}',
    usage_json  jsonb       DEFAULT '{}',
    error_json  jsonb,
    started_at  timestamptz,
    finished_at timestamptz
);

CREATE INDEX idx_director_run_steps_org_id ON director_run_steps(org_id);
CREATE INDEX idx_director_run_steps_run_id ON director_run_steps(run_id);

-- ============================================================
-- 6. director_templates
-- ============================================================
CREATE TABLE director_templates (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid,
    scope               text        NOT NULL DEFAULT 'global'
                                    CHECK (scope IN ('global','org')),
    title               text        NOT NULL,
    slug                text        NOT NULL,
    description         text,
    category            text,
    preview_asset_id    uuid,
    flow_snapshot_json  jsonb       NOT NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_director_templates_org_id ON director_templates(org_id);

-- ============================================================
-- 7. director_flow_links
-- ============================================================
CREATE TABLE director_flow_links (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid        NOT NULL,
    flow_id     uuid        NOT NULL REFERENCES director_flows(id) ON DELETE CASCADE,
    entity_type text        NOT NULL
                            CHECK (entity_type IN ('campaign','product','brand','audience')),
    entity_id   uuid        NOT NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_director_flow_links_org_id  ON director_flow_links(org_id);
CREATE INDEX idx_director_flow_links_flow_id ON director_flow_links(flow_id);

-- ============================================================
-- 8. org_credit_balances
-- ============================================================
CREATE TABLE org_credit_balances (
    org_id          uuid        PRIMARY KEY,
    credits_balance numeric     NOT NULL DEFAULT 0,
    updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- 9. org_credit_transactions
-- ============================================================
CREATE TABLE org_credit_transactions (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        uuid        NOT NULL,
    kind          text        NOT NULL
                              CHECK (kind IN ('debit','credit','refund','bonus')),
    amount        numeric     NOT NULL,
    reason        text,
    run_id        uuid        REFERENCES director_runs(id),
    metadata_json jsonb       DEFAULT '{}',
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_org_credit_transactions_org_id ON org_credit_transactions(org_id);
CREATE INDEX idx_org_credit_transactions_run_id ON org_credit_transactions(run_id);

-- ============================================================
-- Updated-at trigger function (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_director_flows_updated_at
    BEFORE UPDATE ON director_flows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_director_nodes_updated_at
    BEFORE UPDATE ON director_nodes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_director_edges_updated_at
    BEFORE UPDATE ON director_edges
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_director_templates_updated_at
    BEFORE UPDATE ON director_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_org_credit_balances_updated_at
    BEFORE UPDATE ON org_credit_balances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

-- director_flows
ALTER TABLE director_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_flows_select ON director_flows
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flows_insert ON director_flows
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flows_update ON director_flows
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flows_delete ON director_flows
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- director_nodes
ALTER TABLE director_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_nodes_select ON director_nodes
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_nodes_insert ON director_nodes
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_nodes_update ON director_nodes
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_nodes_delete ON director_nodes
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- director_edges
ALTER TABLE director_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_edges_select ON director_edges
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_edges_insert ON director_edges
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_edges_update ON director_edges
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_edges_delete ON director_edges
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- director_runs
ALTER TABLE director_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_runs_select ON director_runs
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_runs_insert ON director_runs
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_runs_update ON director_runs
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_runs_delete ON director_runs
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- director_run_steps
ALTER TABLE director_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_run_steps_select ON director_run_steps
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_run_steps_insert ON director_run_steps
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_run_steps_update ON director_run_steps
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_run_steps_delete ON director_run_steps
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- director_templates (special: global templates readable by all authenticated users)
ALTER TABLE director_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_templates_select_global ON director_templates
    FOR SELECT USING (org_id IS NULL AND auth.uid() IS NOT NULL);

CREATE POLICY director_templates_select_org ON director_templates
    FOR SELECT USING (org_id IS NOT NULL AND has_org_membership(auth.uid(), org_id));

CREATE POLICY director_templates_insert ON director_templates
    FOR INSERT WITH CHECK (
        (org_id IS NULL AND auth.uid() IS NOT NULL)
        OR (org_id IS NOT NULL AND has_org_membership(auth.uid(), org_id))
    );

CREATE POLICY director_templates_update ON director_templates
    FOR UPDATE USING (
        (org_id IS NULL AND auth.uid() IS NOT NULL)
        OR (org_id IS NOT NULL AND has_org_membership(auth.uid(), org_id))
    ) WITH CHECK (
        (org_id IS NULL AND auth.uid() IS NOT NULL)
        OR (org_id IS NOT NULL AND has_org_membership(auth.uid(), org_id))
    );

CREATE POLICY director_templates_delete ON director_templates
    FOR DELETE USING (
        (org_id IS NULL AND auth.uid() IS NOT NULL)
        OR (org_id IS NOT NULL AND has_org_membership(auth.uid(), org_id))
    );

-- director_flow_links
ALTER TABLE director_flow_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_flow_links_select ON director_flow_links
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flow_links_insert ON director_flow_links
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flow_links_update ON director_flow_links
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY director_flow_links_delete ON director_flow_links
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- org_credit_balances
ALTER TABLE org_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_credit_balances_select ON org_credit_balances
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_balances_insert ON org_credit_balances
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_balances_update ON org_credit_balances
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_balances_delete ON org_credit_balances
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- org_credit_transactions
ALTER TABLE org_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_credit_transactions_select ON org_credit_transactions
    FOR SELECT USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_transactions_insert ON org_credit_transactions
    FOR INSERT WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_transactions_update ON org_credit_transactions
    FOR UPDATE USING (has_org_membership(auth.uid(), org_id))
              WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY org_credit_transactions_delete ON org_credit_transactions
    FOR DELETE USING (has_org_membership(auth.uid(), org_id));

-- ============================================================
-- 10. Seed initial credits for all existing orgs (100 free credits)
-- ============================================================
-- Seed 100 free credits for every org that has at least one member
INSERT INTO org_credit_balances (org_id, credits_balance)
SELECT DISTINCT org_id, 100
FROM memberships
ON CONFLICT (org_id) DO NOTHING;

-- ============================================================
-- 11. Storage bucket for generated assets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'director-panel',
  'director-panel',
  true,
  104857600,  -- 100MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: org members can read/write their own folder
CREATE POLICY director_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'director-panel'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY director_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'director-panel'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY director_storage_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'director-panel'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY director_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'director-panel'
    AND auth.uid() IS NOT NULL
  );
