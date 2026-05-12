-- ============================================================
-- 028 — Academic Settings (LMD engine + configurable mentions)
-- ============================================================

-- ── 1. academic_settings table ────────────────────────────────

CREATE TABLE IF NOT EXISTS academic_settings (
  id                         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                  UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  -- Système pédagogique
  system_type                TEXT        NOT NULL DEFAULT 'classique'
                             CHECK (system_type IN ('lmd', 'classique', 'hybride')),
  note_sur                   INTEGER     NOT NULL DEFAULT 20
                             CHECK (note_sur IN (20, 100)),

  -- Validation LMD
  moyenne_validation_ue      NUMERIC(4,2) DEFAULT 10,
  moyenne_validation_semestre NUMERIC(4,2) DEFAULT 10,
  moyenne_validation_annee   NUMERIC(4,2) DEFAULT 10,
  credits_par_semestre       INTEGER     DEFAULT 30,
  credits_par_annee          INTEGER     DEFAULT 60,

  -- Compensation
  compensation_matieres      BOOLEAN     NOT NULL DEFAULT false,
  compensation_ue            BOOLEAN     NOT NULL DEFAULT false,
  compensation_semestre      BOOLEAN     NOT NULL DEFAULT false,
  compensation_annuelle      BOOLEAN     NOT NULL DEFAULT false,
  seuil_note_compensable     NUMERIC(4,2) DEFAULT 7,

  -- Rattrapage
  seuil_acces_rattrapage     NUMERIC(4,2) DEFAULT 8,
  nb_max_matieres_rattrapage INTEGER     DEFAULT 3,
  conservation_meilleure_note BOOLEAN    NOT NULL DEFAULT true,

  -- Mentions (JSON, modifiable par l'établissement)
  mentions JSONB NOT NULL DEFAULT '[
    {"min":16,"label":"Très Bien","color":"#2EA043"},
    {"min":14,"label":"Bien","color":"#388BFD"},
    {"min":12,"label":"Assez Bien","color":"#8B5CF6"},
    {"min":10,"label":"Passable","color":"#F0A30A"},
    {"min":0,"label":"Insuffisant","color":"#F85149"}
  ]'::jsonb,

  created_by  UUID        REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE academic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_settings: select" ON academic_settings;
CREATE POLICY "academic_settings: select" ON academic_settings
  FOR SELECT USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "academic_settings: insert" ON academic_settings;
CREATE POLICY "academic_settings: insert" ON academic_settings
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "academic_settings: update" ON academic_settings;
CREATE POLICY "academic_settings: update" ON academic_settings
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "academic_settings: delete" ON academic_settings;
CREATE POLICY "academic_settings: delete" ON academic_settings
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ── 3. updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academic_settings_updated_at ON academic_settings;
CREATE TRIGGER trg_academic_settings_updated_at
  BEFORE UPDATE ON academic_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 4. Extend subjects table ──────────────────────────────────

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS credits  INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS ue_code  TEXT,
  ADD COLUMN IF NOT EXISTS semestre TEXT
    CHECK (semestre IS NULL OR semestre IN ('S1','S2','S3','S4','S5','S6','S7','S8','S9','S10'));

-- ── 5. Extend sessions_ecole table ───────────────────────────

ALTER TABLE sessions_ecole
  ADD COLUMN IF NOT EXISTS is_rattrapage BOOLEAN NOT NULL DEFAULT false;
