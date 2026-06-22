-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 122 — Wave 4B-2 : Université complète + ecole_subtype complet
-- Ajoute ecole_subtype sur les tables académiques restantes.
-- Crée la hiérarchie Université : Facultés → Départements → Parcours.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. ecole_subtype sur les tables académiques restantes ─────────────────────

ALTER TABLE subjects          ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE sessions_ecole    ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE exams              ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE exam_grades        ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE report_cards       ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE attestations       ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE diplomas           ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE defenses           ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;

CREATE INDEX IF NOT EXISTS idx_subjects_subtype     ON subjects(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_sessions_subtype     ON sessions_ecole(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_exams_subtype        ON exams(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_attestations_subtype ON attestations(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_diplomas_subtype     ON diplomas(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_defenses_subtype     ON defenses(tenant_id, ecole_subtype);

-- ── 2. TABLE facultes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facultes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  nom         TEXT        NOT NULL,
  acronyme    TEXT,
  description TEXT,
  actif       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE facultes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facultes: tenant" ON facultes;
CREATE POLICY "facultes: tenant" ON facultes FOR ALL
  USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS facultes_tenant_idx ON facultes(tenant_id);

-- ── 3. TABLE departements_universite ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departements_universite (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  faculte_id  UUID        REFERENCES facultes(id) ON DELETE SET NULL,
  code        TEXT        NOT NULL,
  nom         TEXT        NOT NULL,
  description TEXT,
  actif       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE departements_universite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departements_universite: tenant" ON departements_universite;
CREATE POLICY "departements_universite: tenant" ON departements_universite FOR ALL
  USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS dept_univ_tenant_idx  ON departements_universite(tenant_id);
CREATE INDEX IF NOT EXISTS dept_univ_faculte_idx ON departements_universite(faculte_id);

-- ── 4. TABLE parcours_universite ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parcours_universite (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  departement_id  UUID        REFERENCES departements_universite(id) ON DELETE SET NULL,
  code            TEXT        NOT NULL,
  intitule        TEXT        NOT NULL,
  niveau          TEXT        NOT NULL DEFAULT 'Licence'
    CHECK (niveau IN ('Licence', 'Master', 'Doctorat', 'BTS', 'DUT', 'Autre')),
  duree_semestres INTEGER     NOT NULL DEFAULT 6 CHECK (duree_semestres BETWEEN 1 AND 16),
  credits_requis  INTEGER     NOT NULL DEFAULT 180 CHECK (credits_requis > 0),
  description     TEXT,
  actif           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE parcours_universite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parcours_universite: tenant" ON parcours_universite;
CREATE POLICY "parcours_universite: tenant" ON parcours_universite FOR ALL
  USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS parcours_univ_tenant_idx ON parcours_universite(tenant_id);
CREATE INDEX IF NOT EXISTS parcours_univ_dept_idx   ON parcours_universite(departement_id);

-- ── 5. FK optionnelles — uniquement si les tables existent ───────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='unites_enseignement') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unites_enseignement' AND column_name='parcours_id') THEN
      ALTER TABLE unites_enseignement ADD COLUMN parcours_id UUID REFERENCES parcours_universite(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='etudiants' AND column_name='faculte_id') THEN
    ALTER TABLE etudiants ADD COLUMN faculte_id UUID REFERENCES facultes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='etudiants' AND column_name='parcours_id') THEN
    ALTER TABLE etudiants ADD COLUMN parcours_id UUID REFERENCES parcours_universite(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etudiants_faculte  ON etudiants(tenant_id, faculte_id);
CREATE INDEX IF NOT EXISTS idx_etudiants_parcours ON etudiants(tenant_id, parcours_id);
