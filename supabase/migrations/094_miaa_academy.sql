-- =============================================================================
-- Migration 094 — MIAA Academy + Analyse Quotidienne
-- =============================================================================

-- ── academy_progress — suivi de progression par tenant/catégorie ──────────────
CREATE TABLE IF NOT EXISTS academy_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid,
  categorie     text NOT NULL,           -- id de la catégorie ACADEMY_CATS
  niveau        text NOT NULL DEFAULT 'debutant',  -- debutant|intermediaire|avance|expert
  cours_suivis  integer NOT NULL DEFAULT 0,
  quiz_total    integer NOT NULL DEFAULT 0,
  quiz_reussis  integer NOT NULL DEFAULT 0,
  score_moyen   numeric(5,2) DEFAULT 0,
  dernier_cours timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, categorie)
);

-- ── academy_certificates — certificats générés ────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_certificates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        uuid,
  user_name      text,
  categorie      text NOT NULL,
  niveau         text NOT NULL,
  score          integer NOT NULL,          -- score obtenu au quiz
  score_max      integer NOT NULL DEFAULT 5,
  pourcentage    integer NOT NULL,          -- 0-100
  delivre_le     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── miaa_daily_reports — rapports quotidiens d'analyse ───────────────────────
CREATE TABLE IF NOT EXISTS miaa_daily_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_rapport     date NOT NULL DEFAULT CURRENT_DATE,
  score_sante      integer DEFAULT 0,      -- 0-100
  nb_alertes       integer DEFAULT 0,
  nb_proposals     integer DEFAULT 0,
  modules_analyses text[] DEFAULT '{}',
  rapport_json     jsonb NOT NULL DEFAULT '{}',
  rapport_texte    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date_rapport)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academy_progress_tenant   ON academy_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_tenant ON academy_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_cat  ON academy_certificates(tenant_id, categorie);
CREATE INDEX IF NOT EXISTS idx_daily_reports_tenant      ON miaa_daily_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date        ON miaa_daily_reports(date_rapport DESC);

-- ── Updated_at trigger (academy_progress) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_academy_progress_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_academy_progress_updated_at ON academy_progress;
CREATE TRIGGER trg_academy_progress_updated_at
  BEFORE UPDATE ON academy_progress
  FOR EACH ROW EXECUTE FUNCTION update_academy_progress_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE academy_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certificates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE miaa_daily_reports    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "academy_progress_tenant" ON academy_progress FOR ALL
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_certificates_tenant" ON academy_certificates FOR ALL
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "miaa_daily_reports_tenant" ON miaa_daily_reports FOR ALL
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
