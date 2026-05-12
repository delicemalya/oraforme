-- ============================================================
-- Tenant Modules — normalized module assignment per tenant
-- Replaces the JSONB array tenants.modules_actifs as source
-- of truth. The old column is kept for backward compatibility.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_modules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT        NOT NULL,
  enabled    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

-- Users may read only their own tenant's modules
CREATE POLICY "tenant_modules: select"
  ON tenant_modules FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX idx_tenant_modules_tenant    ON tenant_modules(tenant_id);
CREATE INDEX idx_tenant_modules_enabled   ON tenant_modules(tenant_id, enabled);

-- ── Backfill from existing tenants.modules_actifs ──────────────────────────
-- Safe to run multiple times: ON CONFLICT ignores duplicates.
INSERT INTO tenant_modules (tenant_id, module_key)
SELECT t.id, unnest(t.modules_actifs)
FROM   tenants t
WHERE  array_length(t.modules_actifs, 1) > 0
ON CONFLICT (tenant_id, module_key) DO NOTHING;
