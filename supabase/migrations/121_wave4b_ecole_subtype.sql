-- ============================================================
-- Migration 121 — Wave 4B-1 : Cloisonnement types établissements
-- Sprint correctif éducation : ecole_subtype + LMD tables
-- ============================================================

-- ── 1. Colonne ecole_subtype sur les tables École ─────────────────────────────
-- Permet d'isoler les données par type d'établissement au niveau DB.
-- Valeurs : garderie | primaire | college | lycee | universite
-- NULL autorisé pour compatibilité données existantes (backfill via trigger).

ALTER TABLE etudiants         ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE enseignants        ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE notes_etudiants   ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE frais_scolaires   ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;
ALTER TABLE absences_etudiants ADD COLUMN IF NOT EXISTS ecole_subtype TEXT;

-- Colonne série/section pour lycée (classes Terminale A, Terminale S…)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='classes_ecole') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes_ecole' AND column_name='serie') THEN
      ALTER TABLE classes_ecole ADD COLUMN serie TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes_ecole' AND column_name='section') THEN
      ALTER TABLE classes_ecole ADD COLUMN section TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes_ecole' AND column_name='ecole_subtype') THEN
      ALTER TABLE classes_ecole ADD COLUMN ecole_subtype TEXT;
    END IF;
  END IF;
END $$;

-- Index pour les requêtes filtrées par subtype
CREATE INDEX IF NOT EXISTS idx_etudiants_subtype    ON etudiants(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_enseignants_subtype  ON enseignants(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_notes_subtype        ON notes_etudiants(tenant_id, ecole_subtype);
CREATE INDEX IF NOT EXISTS idx_frais_subtype        ON frais_scolaires(tenant_id, ecole_subtype);

-- ── 2. TABLE academic_settings ────────────────────────────────────────────────
-- Paramètres LMD par tenant. Requis pour parametres-academiques/page.tsx.
-- CR-07 : la page avait un bouton Save mais la table n'existait pas.

CREATE TABLE IF NOT EXISTS academic_settings (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  system_type                   TEXT        NOT NULL DEFAULT 'classique'
    CHECK (system_type IN ('classique', 'lmd', 'hybride')),
  note_sur                      INTEGER     NOT NULL DEFAULT 20
    CHECK (note_sur IN (20, 100)),
  moyenne_validation_ue         NUMERIC(5,2) NOT NULL DEFAULT 10,
  moyenne_validation_semestre   NUMERIC(5,2) NOT NULL DEFAULT 10,
  moyenne_validation_annee      NUMERIC(5,2) NOT NULL DEFAULT 10,
  credits_par_semestre          INTEGER     NOT NULL DEFAULT 30,
  credits_par_annee             INTEGER     NOT NULL DEFAULT 60,
  compensation_matieres         BOOLEAN     NOT NULL DEFAULT false,
  compensation_ue               BOOLEAN     NOT NULL DEFAULT false,
  compensation_semestre         BOOLEAN     NOT NULL DEFAULT false,
  compensation_annuelle         BOOLEAN     NOT NULL DEFAULT false,
  seuil_note_compensable        NUMERIC(5,2) NOT NULL DEFAULT 7,
  seuil_acces_rattrapage        NUMERIC(5,2) NOT NULL DEFAULT 8,
  nb_max_matieres_rattrapage    INTEGER     NOT NULL DEFAULT 3,
  conservation_meilleure_note   BOOLEAN     NOT NULL DEFAULT true,
  mentions                      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE academic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_settings: tenant" ON academic_settings;
CREATE POLICY "academic_settings: tenant" ON academic_settings FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS academic_settings_tenant_idx ON academic_settings(tenant_id);

-- ── 3. TABLE unites_enseignement ──────────────────────────────────────────────
-- Unités d'Enseignement (UE) pour le système LMD.
-- MJ-17 : table absente — bloque tout le parcours LMD Université.

CREATE TABLE IF NOT EXISTS unites_enseignement (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            TEXT        NOT NULL,
  intitule        TEXT        NOT NULL,
  credits         INTEGER     NOT NULL DEFAULT 6 CHECK (credits > 0 AND credits <= 30),
  semestre        INTEGER     NOT NULL CHECK (semestre BETWEEN 1 AND 12),
  annee           INTEGER     NOT NULL DEFAULT 1 CHECK (annee BETWEEN 1 AND 8),
  parcours        TEXT        NOT NULL DEFAULT 'Licence'
    CHECK (parcours IN ('Licence', 'Master', 'Doctorat', 'BTS', 'DUT', 'Autre')),
  obligatoire     BOOLEAN     NOT NULL DEFAULT true,
  coefficient     NUMERIC(3,1) NOT NULL DEFAULT 1 CHECK (coefficient > 0),
  description     TEXT,
  enseignant_id   UUID        REFERENCES enseignants(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE unites_enseignement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unites_enseignement: tenant" ON unites_enseignement;
CREATE POLICY "unites_enseignement: tenant" ON unites_enseignement FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS ue_tenant_idx         ON unites_enseignement(tenant_id);
CREATE INDEX IF NOT EXISTS ue_parcours_semestre   ON unites_enseignement(tenant_id, parcours, semestre);

-- ── 4. TABLE semestres_etudiants ──────────────────────────────────────────────
-- Suivi de validation semestre par étudiant (workflow UE→Semestre→Année→Diplôme).
-- MJ-18 : table absente — délibération et parcours LMD impossibles.

CREATE TABLE IF NOT EXISTS semestres_etudiants (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id          UUID        NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  annee_universitaire  TEXT        NOT NULL DEFAULT '2024-2025',
  semestre             INTEGER     NOT NULL CHECK (semestre BETWEEN 1 AND 12),
  credits_obtenus      INTEGER     NOT NULL DEFAULT 0 CHECK (credits_obtenus >= 0),
  credits_requis       INTEGER     NOT NULL DEFAULT 30 CHECK (credits_requis > 0),
  moyenne              NUMERIC(5,2) CHECK (moyenne BETWEEN 0 AND 20),
  statut               TEXT        NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours', 'valide', 'ajourne', 'rattrapage', 'abandonne')),
  session              TEXT        NOT NULL DEFAULT 'normale'
    CHECK (session IN ('normale', 'rattrapage', 'exceptionnelle')),
  mention              TEXT,
  date_deliberation    DATE,
  delibere_par         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  notes_ue             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, etudiant_id, annee_universitaire, semestre, session)
);

ALTER TABLE semestres_etudiants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "semestres_etudiants: tenant" ON semestres_etudiants;
CREATE POLICY "semestres_etudiants: tenant" ON semestres_etudiants FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS sem_etu_tenant_idx    ON semestres_etudiants(tenant_id);
CREATE INDEX IF NOT EXISTS sem_etu_etudiant_idx  ON semestres_etudiants(etudiant_id);
CREATE INDEX IF NOT EXISTS sem_etu_annee_idx     ON semestres_etudiants(tenant_id, annee_universitaire, semestre);

-- ── 5. TABLE series_lycee ──────────────────────────────────────────────────────
-- Séries et options pour le lycée (Terminale A, B, C, D, E, S, ES, L…).
-- MJ-15 : classes_ecole sans série.

CREATE TABLE IF NOT EXISTS series_lycee (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  libelle     TEXT        NOT NULL,
  description TEXT,
  actif       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE series_lycee ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "series_lycee: tenant" ON series_lycee;
CREATE POLICY "series_lycee: tenant" ON series_lycee FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS series_lycee_tenant_idx ON series_lycee(tenant_id);

-- Séries standard Congo pré-chargées (optionnel — INSERT ignoré si conflit)
-- Ne s'exécute que si la table est vide pour un tenant donné.
-- (Pas de seed ici car tenant_id = NULL n'est pas valide — seed via application)

-- ── 6. Trigger updated_at sur academic_settings ───────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academic_settings_updated_at ON academic_settings;
CREATE TRIGGER trg_academic_settings_updated_at
  BEFORE UPDATE ON academic_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_semestres_etudiants_updated_at ON semestres_etudiants;
CREATE TRIGGER trg_semestres_etudiants_updated_at
  BEFORE UPDATE ON semestres_etudiants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
