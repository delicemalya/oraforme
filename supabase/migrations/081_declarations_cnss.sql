-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 081 — DÉCLARATIONS CNSS CONGO
-- Taux officiels : Vieillesse 4%+8% (plaf. 1 200 000), AT/AF 12.28% (plaf. 600 000), TUS 3%
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enrichir employes avec colonnes CNSS manquantes ───────────────────────
ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS matricule               TEXT,
  ADD COLUMN IF NOT EXISTS type_travailleur        TEXT DEFAULT 'permanent'
    CHECK (type_travailleur IN ('permanent','contractuel','stagiaire','apprenti','detache')),
  ADD COLUMN IF NOT EXISTS categorie_emploi        TEXT,
  ADD COLUMN IF NOT EXISTS indemnite_vie_chere     NUMERIC(12,0) DEFAULT 0;

-- ── 2. Table déclarations CNSS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declarations_cnss (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  mois                             INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee                            INTEGER NOT NULL,
  reference                        TEXT,

  -- Récapitulatif calculé
  nb_employes                      INTEGER DEFAULT 0,
  masse_salariale                  NUMERIC(15,0) DEFAULT 0,
  base_vieillesse                  NUMERIC(15,0) DEFAULT 0,
  cotisation_vieillesse_employe    NUMERIC(15,0) DEFAULT 0,
  cotisation_vieillesse_patronal   NUMERIC(15,0) DEFAULT 0,
  cotisation_at_mp_pf              NUMERIC(15,0) DEFAULT 0,
  cotisation_tus                   NUMERIC(15,0) DEFAULT 0,
  total_a_verser                   NUMERIC(15,0) DEFAULT 0,

  -- Statut workflow
  statut                           TEXT DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','validee','deposee','payee','annulee')),
  date_depot                       DATE,
  date_paiement                    DATE,
  reference_depot                  TEXT,
  notes                            TEXT,

  -- Source de données
  pre_rempli_depuis_paie           BOOLEAN DEFAULT FALSE,

  created_at                       TIMESTAMPTZ DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, mois, annee)
);

ALTER TABLE declarations_cnss ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnss_tenant_policy" ON declarations_cnss;
CREATE POLICY "cnss_tenant_policy" ON declarations_cnss FOR ALL
  USING (tenant_id = get_my_tenant_id());

-- ── 3. Lignes nominatives (snapshot par employé) ──────────────────────────────
CREATE TABLE IF NOT EXISTS declarations_cnss_lignes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id           UUID NOT NULL REFERENCES declarations_cnss(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL,
  employe_id               UUID REFERENCES employes(id),

  -- Identité (snapshot)
  numero_ordre             INTEGER NOT NULL,
  nom                      TEXT NOT NULL,
  postnom                  TEXT,
  prenom                   TEXT NOT NULL,
  numero_cnss              TEXT,
  matricule                TEXT,
  poste                    TEXT,

  -- Salaire brut du mois
  salaire_brut             NUMERIC(12,0) NOT NULL DEFAULT 0,

  -- Vieillesse (plafond 1 200 000)
  base_vieillesse          NUMERIC(12,0) DEFAULT 0,
  cotisation_employe       NUMERIC(12,0) DEFAULT 0,  -- 4%
  cotisation_vieillesse    NUMERIC(12,0) DEFAULT 0,  -- 8%

  -- AT / Allocations Familiales (plafond 600 000)
  base_at_mp_pf            NUMERIC(12,0) DEFAULT 0,
  allocations_familiales   NUMERIC(12,0) DEFAULT 0,  -- 10.03%
  accidents_travail        NUMERIC(12,0) DEFAULT 0,  -- 2.25%
  cotisation_at_mp_pf      NUMERIC(12,0) DEFAULT 0,  -- = AF + AT

  -- TUS (3% déplafonné)
  cotisation_tus           NUMERIC(12,0) DEFAULT 0,

  -- Totaux
  total_patronal           NUMERIC(12,0) DEFAULT 0,

  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE declarations_cnss_lignes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnss_lignes_tenant_policy" ON declarations_cnss_lignes;
CREATE POLICY "cnss_lignes_tenant_policy" ON declarations_cnss_lignes FOR ALL
  USING (tenant_id = get_my_tenant_id());

-- ── 4. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cnss_declaration_periode
  ON declarations_cnss(tenant_id, annee, mois);

CREATE INDEX IF NOT EXISTS idx_cnss_declaration_statut
  ON declarations_cnss(tenant_id, statut);

CREATE INDEX IF NOT EXISTS idx_cnss_lignes_declaration
  ON declarations_cnss_lignes(declaration_id);

CREATE INDEX IF NOT EXISTS idx_cnss_lignes_employe
  ON declarations_cnss_lignes(employe_id) WHERE employe_id IS NOT NULL;
