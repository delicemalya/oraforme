-- =============================================================================
-- Migration 093 — Cloud Storage System + OCR Index
-- =============================================================================

-- ── storage_configs — credentials S3-compatible par tenant ────────────────────
CREATE TABLE IF NOT EXISTS storage_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      text NOT NULL DEFAULT 's3',   -- 's3'|'r2'|'wasabi'|'minio'|'supabase'
  s3_endpoint   text NOT NULL DEFAULT '',
  s3_bucket     text NOT NULL DEFAULT '',
  s3_region     text NOT NULL DEFAULT 'auto',
  s3_access_key text NOT NULL DEFAULT '',
  s3_secret_key text NOT NULL DEFAULT '',
  actif         boolean NOT NULL DEFAULT false,
  public_url    text,                          -- CDN ou domaine public optionnel
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- ── Ajouter colonnes storage à la table documents existante ──────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key      text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'supabase';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket   text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size        bigint;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type        text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum         text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_text         text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status       text DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_data         jsonb DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version          integer NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_id        uuid REFERENCES documents(id) ON DELETE SET NULL;

-- ── document_versions — historique versionné ─────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  storage_key     text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'supabase',
  storage_bucket  text,
  file_size       bigint,
  mime_type       text,
  checksum        text,
  nom             text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  note            text
);

-- ── document_history — audit trail complet ────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action        text NOT NULL,  -- 'upload'|'download'|'archive'|'restore'|'delete'|'update'|'ocr'|'share'
  user_id       uuid,
  user_name     text,
  ip_address    text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_storage_configs_tenant       ON storage_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc        ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_tenant     ON document_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_history_doc         ON document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_document_history_tenant      ON document_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_history_created     ON document_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_ocr_status         ON documents(tenant_id, ocr_status);
CREATE INDEX IF NOT EXISTS idx_documents_storage_key        ON documents(storage_key) WHERE storage_key IS NOT NULL;

-- Full-text search sur contenu OCR
CREATE INDEX IF NOT EXISTS idx_documents_ocr_fts
  ON documents USING gin(to_tsvector('french', COALESCE(ocr_text, '') || ' ' || COALESCE(nom, '')));

-- ── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_storage_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_storage_config_updated_at ON storage_configs;
CREATE TRIGGER trg_storage_config_updated_at
  BEFORE UPDATE ON storage_configs
  FOR EACH ROW EXECUTE FUNCTION update_storage_config_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE storage_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_history    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "storage_configs_tenant"
    ON storage_configs FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "document_versions_tenant"
    ON document_versions FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "document_history_tenant"
    ON document_history FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
