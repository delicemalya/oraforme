-- Migration 112 : MIAA+ RH Expert — table de persistance des générations
-- Stocke l'historique des documents générés par l'IA RH pour chaque tenant.

CREATE TABLE IF NOT EXISTS miaa_rh_generations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool         TEXT        NOT NULL,
  plan         TEXT        NOT NULL,   -- tpe / pme / grande
  inputs       JSONB       NOT NULL DEFAULT '{}',
  output       TEXT        NOT NULL,
  model        TEXT        NOT NULL DEFAULT 'claude-opus-4-5',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour retrouver facilement les générations par tenant
CREATE INDEX IF NOT EXISTS idx_miaa_rh_generations_tenant_id
  ON miaa_rh_generations (tenant_id, created_at DESC);

-- RLS
ALTER TABLE miaa_rh_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_miaa_rh" ON miaa_rh_generations
  USING (tenant_id = (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    ORDER BY created_at LIMIT 1
  ));

-- Grants
GRANT SELECT, INSERT ON miaa_rh_generations TO authenticated;
