-- =============================================================================
-- Migration 092 — WhatsApp Business Integration
-- Table: whatsapp_config (per-tenant API credentials)
-- Table: whatsapp_logs  (message history)
-- =============================================================================

-- ── whatsapp_config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id       text NOT NULL DEFAULT '',
  business_account_id   text NOT NULL DEFAULT '',
  access_token          text NOT NULL DEFAULT '',
  webhook_secret        text NOT NULL DEFAULT '',
  actif                 boolean NOT NULL DEFAULT false,
  from_phone            text NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- ── whatsapp_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_phone      text NOT NULL,
  to_name       text,
  message_type  text NOT NULL DEFAULT 'text',
  template_name text,
  body          text,
  status        text NOT NULL DEFAULT 'sent',
  whatsapp_id   text,
  error_message text,
  context       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_tenant   ON whatsapp_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_tenant     ON whatsapp_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created    ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status     ON whatsapp_logs(tenant_id, status);

-- ── Updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_whatsapp_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_config_updated_at ON whatsapp_config;
CREATE TRIGGER trg_whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_config_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "whatsapp_config_tenant_isolation"
    ON whatsapp_config FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "whatsapp_logs_tenant_isolation"
    ON whatsapp_logs FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
