-- ============================================================
-- Migration 047 — RH Enterprise Premium Tables
-- Oraforme ERP · Congo-Brazzaville
-- Date: 2026-05-25
--
-- Nouvelles tables :
--   1. presences           — pointage quotidien
--   2. evaluations         — évaluations de performance
--   3. sanctions           — mesures disciplinaires
--   4. avantages           — avantages en nature et bénéfices
--   5. documents_rh        — GED RH (contrats, bulletins, diplômes…)
--
-- Colonnes ajoutées à employes :
--   photo_url, departement, manager, salaire_brut, email_pro
--
-- RLS : isolation tenant absolue sur toutes les tables
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 0. Extensions (idempotent)
-- ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────
-- 1. COLONNES SUPPLÉMENTAIRES sur employes
-- ─────────────────────────────────────────────────────────

-- photo_url : URL photo de profil
ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS photo_url     TEXT,
  ADD COLUMN IF NOT EXISTS departement   TEXT,
  ADD COLUMN IF NOT EXISTS manager       TEXT,   -- nom du manager (référence souple)
  ADD COLUMN IF NOT EXISTS salaire_brut  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS email_pro     TEXT;

-- ─────────────────────────────────────────────────────────
-- 2. TABLE presences
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presences (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID        NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'present'
                              CHECK (type IN ('present','absent','retard','permission','teletravail')),
  heure_arrivee   TIME,
  heure_depart    TIME,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Un seul enregistrement par employé par jour
  CONSTRAINT presences_unique_employe_date UNIQUE (tenant_id, employe_id, date)
);

CREATE INDEX IF NOT EXISTS presences_tenant_date_idx  ON presences (tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS presences_employe_idx      ON presences (employe_id);

-- RLS
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presences_tenant_isolation ON presences;
CREATE POLICY presences_tenant_isolation ON presences
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_presences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_presences_updated_at ON presences;
CREATE TRIGGER trg_presences_updated_at
  BEFORE UPDATE ON presences
  FOR EACH ROW EXECUTE FUNCTION update_presences_updated_at();

-- ─────────────────────────────────────────────────────────
-- 3. TABLE evaluations
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluations (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id            UUID        NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  periode               TEXT        NOT NULL,           -- ex: 'Q1 2026', 'Annuel 2025'
  note_globale          NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (note_globale BETWEEN 0 AND 5),
  note_travail          NUMERIC(3,2)          DEFAULT 0 CHECK (note_travail BETWEEN 0 AND 5),
  note_ponctualite      NUMERIC(3,2)          DEFAULT 0 CHECK (note_ponctualite BETWEEN 0 AND 5),
  note_travail_equipe   NUMERIC(3,2)          DEFAULT 0 CHECK (note_travail_equipe BETWEEN 0 AND 5),
  note_initiative       NUMERIC(3,2)          DEFAULT 0 CHECK (note_initiative BETWEEN 0 AND 5),
  commentaire           TEXT,
  objectifs_prochains   TEXT,
  evaluateur            TEXT,
  statut                TEXT        NOT NULL DEFAULT 'brouillon'
                                    CHECK (statut IN ('brouillon','finalise','partage')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evaluations_tenant_idx  ON evaluations (tenant_id);
CREATE INDEX IF NOT EXISTS evaluations_employe_idx ON evaluations (employe_id);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evaluations_tenant_isolation ON evaluations;
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE OR REPLACE FUNCTION update_evaluations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_evaluations_updated_at ON evaluations;
CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_evaluations_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. TABLE sanctions
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sanctions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID        NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL
                              CHECK (type IN ('avertissement','blame','mise_en_demeure','suspension','licenciement')),
  motif           TEXT        NOT NULL,
  date_sanction   DATE        NOT NULL,
  date_fin        DATE,
  statut          TEXT        NOT NULL DEFAULT 'en_cours'
                              CHECK (statut IN ('en_cours','cloture','conteste')),
  observations    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sanctions_tenant_idx  ON sanctions (tenant_id);
CREATE INDEX IF NOT EXISTS sanctions_employe_idx ON sanctions (employe_id);

ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sanctions_tenant_isolation ON sanctions;
CREATE POLICY sanctions_tenant_isolation ON sanctions
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE OR REPLACE FUNCTION update_sanctions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_sanctions_updated_at ON sanctions;
CREATE TRIGGER trg_sanctions_updated_at
  BEFORE UPDATE ON sanctions
  FOR EACH ROW EXECUTE FUNCTION update_sanctions_updated_at();

-- ─────────────────────────────────────────────────────────
-- 5. TABLE avantages
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avantages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID        REFERENCES employes(id) ON DELETE CASCADE,  -- NULL = global
  type            TEXT        NOT NULL DEFAULT 'autre'
                              CHECK (type IN ('transport','logement','telephone','repas','assurance','formation','prime','voiture','autre')),
  libelle         TEXT        NOT NULL,
  montant         NUMERIC(14,2),
  periodicite     TEXT        NOT NULL DEFAULT 'mensuel'
                              CHECK (periodicite IN ('mensuel','trimestriel','annuel','ponctuel')),
  statut          TEXT        NOT NULL DEFAULT 'actif'
                              CHECK (statut IN ('actif','inactif')),
  date_debut      DATE,
  date_fin        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS avantages_tenant_idx  ON avantages (tenant_id);
CREATE INDEX IF NOT EXISTS avantages_employe_idx ON avantages (employe_id);

ALTER TABLE avantages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avantages_tenant_isolation ON avantages;
CREATE POLICY avantages_tenant_isolation ON avantages
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE OR REPLACE FUNCTION update_avantages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_avantages_updated_at ON avantages;
CREATE TRIGGER trg_avantages_updated_at
  BEFORE UPDATE ON avantages
  FOR EACH ROW EXECUTE FUNCTION update_avantages_updated_at();

-- ─────────────────────────────────────────────────────────
-- 6. TABLE documents_rh
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents_rh (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID        REFERENCES employes(id) ON DELETE SET NULL,  -- NULL = document général
  categorie       TEXT        NOT NULL DEFAULT 'autre'
                              CHECK (categorie IN ('contrat','bulletin','attestation','diplome','identite','medical','evaluation','formation','autre')),
  titre           TEXT        NOT NULL,
  url             TEXT,                           -- URL Supabase Storage, Drive, etc.
  extension       TEXT,                           -- pdf, docx, jpg…
  taille_ko       INTEGER,
  statut          TEXT        NOT NULL DEFAULT 'actif'
                              CHECK (statut IN ('actif','archive')),
  date_document   DATE,
  expiration      DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_rh_tenant_idx   ON documents_rh (tenant_id);
CREATE INDEX IF NOT EXISTS documents_rh_employe_idx  ON documents_rh (employe_id);
CREATE INDEX IF NOT EXISTS documents_rh_categorie_idx ON documents_rh (tenant_id, categorie);
CREATE INDEX IF NOT EXISTS documents_rh_expiration_idx ON documents_rh (expiration)
  WHERE expiration IS NOT NULL;

ALTER TABLE documents_rh ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_rh_tenant_isolation ON documents_rh;
CREATE POLICY documents_rh_tenant_isolation ON documents_rh
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE OR REPLACE FUNCTION update_documents_rh_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_documents_rh_updated_at ON documents_rh;
CREATE TRIGGER trg_documents_rh_updated_at
  BEFORE UPDATE ON documents_rh
  FOR EACH ROW EXECUTE FUNCTION update_documents_rh_updated_at();

-- ─────────────────────────────────────────────────────────
-- 7. GRANTS pour service_role (supabaseAdmin)
-- ─────────────────────────────────────────────────────────
GRANT ALL ON presences     TO service_role;
GRANT ALL ON evaluations   TO service_role;
GRANT ALL ON sanctions     TO service_role;
GRANT ALL ON avantages     TO service_role;
GRANT ALL ON documents_rh  TO service_role;

-- ─────────────────────────────────────────────────────────
-- 8. GRANTS pour authenticated (client RLS)
-- ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON presences     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON evaluations   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sanctions     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON avantages     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents_rh  TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 9. VUE analytique RH (optionnel — aide pour reporting)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW rh_analytics_summary AS
SELECT
  e.tenant_id,
  COUNT(*)                                           AS total_employes,
  COUNT(*) FILTER (WHERE e.statut = 'actif')         AS employes_actifs,
  AVG(e.salaire_brut) FILTER (WHERE e.salaire_brut IS NOT NULL AND e.salaire_brut > 0) AS salaire_moyen,
  COUNT(DISTINCT e.departement)                      AS nb_departements,
  COUNT(s.id) FILTER (WHERE s.statut = 'en_cours')   AS sanctions_en_cours,
  COUNT(c.id) FILTER (WHERE c.statut = 'en_attente') AS conges_en_attente
FROM employes e
LEFT JOIN sanctions s ON s.employe_id = e.id
LEFT JOIN conges    c ON c.employe_id = e.id
GROUP BY e.tenant_id;

-- ─────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION 047
-- ─────────────────────────────────────────────────────────
-- À exécuter dans Supabase SQL Editor (onglet SQL de votre projet)
-- ou via : supabase db push
