-- ============================================================
-- Migration 069 : MIAA+ Usage tracking — monitoring des coûts IA
-- ============================================================

CREATE TABLE IF NOT EXISTS miaa_usage (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  module              TEXT        NOT NULL,
  model               TEXT        NOT NULL,
  input_tokens        INT         NOT NULL DEFAULT 0,
  output_tokens       INT         NOT NULL DEFAULT 0,
  estimated_cost_usd  NUMERIC(12,8) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE miaa_usage ENABLE ROW LEVEL SECURITY;

-- Les admins voient l'usage de leur tenant
CREATE POLICY "sel_miaa_usage" ON miaa_usage
  USING (tenant_id = get_my_tenant_id());

-- Seul le service role peut insérer (API routes)
CREATE POLICY "ins_miaa_usage" ON miaa_usage FOR INSERT
  WITH CHECK (true);

-- Index pour les rapports de coûts
CREATE INDEX IF NOT EXISTS idx_miaa_usage_tenant     ON miaa_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_miaa_usage_created    ON miaa_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_miaa_usage_tenant_day ON miaa_usage(tenant_id, DATE(created_at));

-- Vue agrégée par tenant + jour (pratique pour un dashboard de coûts)
CREATE OR REPLACE VIEW miaa_usage_daily AS
SELECT
  tenant_id,
  DATE(created_at)           AS jour,
  module,
  model,
  COUNT(*)                   AS nb_appels,
  SUM(input_tokens)          AS total_input_tokens,
  SUM(output_tokens)         AS total_output_tokens,
  ROUND(SUM(estimated_cost_usd)::NUMERIC, 6) AS cout_total_usd
FROM miaa_usage
GROUP BY tenant_id, DATE(created_at), module, model
ORDER BY jour DESC, cout_total_usd DESC;
