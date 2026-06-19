-- ============================================================
-- Migration 110 — ATS Pipeline & Profils Candidats Complets
-- Étend les tables candidats + candidatures pour l'ATS pro
-- ============================================================

-- ── 1. Extension candidatures : stage ATS ────────────────────────────────────
ALTER TABLE candidatures
  ADD COLUMN IF NOT EXISTS ats_stage TEXT DEFAULT 'candidature'
    CHECK (ats_stage IN (
      'candidature','prequalification','entretien_rh','entretien_client',
      'validation','placement','mission','archivage'
    ));

CREATE INDEX IF NOT EXISTS candidatures_ats_stage_idx ON candidatures(tenant_id, ats_stage);

-- ── 2. Extension candidats : champs ATS complets ─────────────────────────────
ALTER TABLE candidats
  ADD COLUMN IF NOT EXISTS linkedin_url          TEXT,
  ADD COLUMN IF NOT EXISTS adresse               TEXT,
  ADD COLUMN IF NOT EXISTS ville                 TEXT,
  ADD COLUMN IF NOT EXISTS pays                  TEXT DEFAULT 'Congo',
  ADD COLUMN IF NOT EXISTS disponibilite         DATE,
  ADD COLUMN IF NOT EXISTS salaire_souhaite      NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS type_contrat_souhaite TEXT,
  ADD COLUMN IF NOT EXISTS mobilite              TEXT DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS langues               TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score_global          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cv_text               TEXT,
  ADD COLUMN IF NOT EXISTS cv_url                TEXT,
  ADD COLUMN IF NOT EXISTS notes_internes        TEXT,
  ADD COLUMN IF NOT EXISTS source                TEXT DEFAULT 'candidature',
  ADD COLUMN IF NOT EXISTS is_starred            BOOLEAN DEFAULT false;

-- ── 3. Diplômes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ats_diplomes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id   UUID        NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  titre         TEXT        NOT NULL,
  etablissement TEXT,
  domaine       TEXT,
  annee         INTEGER,
  niveau        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ats_diplomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_ats_diplomes" ON ats_diplomes
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS ats_diplomes_candidat_idx ON ats_diplomes(candidat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ats_diplomes TO authenticated;

-- ── 4. Certifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ats_certifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id     UUID        NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  titre           TEXT        NOT NULL,
  organisme       TEXT,
  date_obtention  DATE,
  date_expiration DATE,
  credential_url  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ats_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_ats_certifications" ON ats_certifications
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS ats_certifications_candidat_idx ON ats_certifications(candidat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ats_certifications TO authenticated;

-- ── 5. Expériences professionnelles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ats_experiences (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id  UUID        NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  poste        TEXT        NOT NULL,
  entreprise   TEXT,
  secteur      TEXT,
  date_debut   DATE,
  date_fin     DATE,
  en_cours     BOOLEAN     NOT NULL DEFAULT false,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ats_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_ats_experiences" ON ats_experiences
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS ats_experiences_candidat_idx ON ats_experiences(candidat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ats_experiences TO authenticated;

-- ── 6. Tests & évaluations candidats ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ats_tests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id     UUID        NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  nom_test        TEXT        NOT NULL,
  type_test       TEXT,
  score           INTEGER,
  score_max       INTEGER     DEFAULT 100,
  date_passation  DATE,
  duree_minutes   INTEGER,
  statut          TEXT        NOT NULL DEFAULT 'planifie'
    CHECK (statut IN ('planifie','en_cours','complete','annule')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ats_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_ats_tests" ON ats_tests
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS ats_tests_candidat_idx ON ats_tests(candidat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ats_tests TO authenticated;
