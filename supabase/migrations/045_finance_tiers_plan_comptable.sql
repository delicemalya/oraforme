-- ============================================================================
-- Migration 045 — Finance : Tiers & Plan comptable personnalisé
-- Auteur  : oraforme ERP
-- Date    : 2026-05-22
-- ============================================================================
-- Tables créées :
--   tiers               — clients, fournisseurs, partenaires (multi-tenant)
--   plan_comptable      — comptes OHADA personnalisés par tenant
--   echeances           — échéances de paiement liées aux factures
--   tva_declarations    — déclarations TVA mensuelles
-- ============================================================================

-- ─── Extension UUID si pas encore présente ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. TABLE tiers ──────────────────────────────────────────────────────────
-- Centralise clients, fournisseurs, partenaires avec compte OHADA lié

CREATE TABLE IF NOT EXISTS tiers (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identification
  type             TEXT        NOT NULL CHECK (type IN ('client', 'fournisseur', 'partenaire', 'salarie')),
  code             TEXT,                        -- code interne ex: CLI-001
  nom              TEXT        NOT NULL,
  prenom           TEXT,
  raison_sociale   TEXT,
  siret            TEXT,
  nif              TEXT,                        -- Numéro Identifiant Fiscal Congo
  rccm             TEXT,                        -- Registre du Commerce Congo

  -- Contact
  email            TEXT,
  telephone        TEXT,
  adresse          TEXT,
  ville            TEXT,
  pays             TEXT        DEFAULT 'Congo-Brazzaville',

  -- Compte OHADA lié
  compte_ohada     TEXT,                        -- ex: '411000' pour clients, '401000' pour fourn.
  compte_auxiliaire TEXT,                       -- ex: 'CLI-0042'

  -- Financier
  plafond_credit   NUMERIC(15,2) DEFAULT 0,    -- crédit maximum autorisé
  delai_paiement   INTEGER       DEFAULT 30,   -- jours de délai standard
  taux_escompte    NUMERIC(5,2)  DEFAULT 0,

  -- Statut
  actif            BOOLEAN     NOT NULL DEFAULT TRUE,
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES auth.users(id)
);

-- Index performance
CREATE INDEX IF NOT EXISTS idx_tiers_tenant    ON tiers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tiers_type      ON tiers (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_tiers_nom       ON tiers (tenant_id, nom);
CREATE INDEX IF NOT EXISTS idx_tiers_compte    ON tiers (tenant_id, compte_ohada);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trig_tiers_updated_at ON tiers;
CREATE TRIGGER trig_tiers_updated_at
  BEFORE UPDATE ON tiers
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 2. TABLE plan_comptable ─────────────────────────────────────────────────
-- Permet à chaque tenant de personnaliser le plan OHADA ou d'ajouter des comptes

CREATE TABLE IF NOT EXISTS plan_comptable (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Numéro de compte OHADA (ex: '521005' pour une banque spécifique)
  numero           TEXT        NOT NULL,
  intitule         TEXT        NOT NULL,

  -- Classification
  classe           SMALLINT    NOT NULL CHECK (classe BETWEEN 1 AND 9),
  type_compte      TEXT        NOT NULL CHECK (type_compte IN (
    'actif','passif','capitaux','immobilisation','stock','tresorerie','charge','produit'
  )),
  sens_normal      TEXT        NOT NULL CHECK (sens_normal IN ('debit','credit')),

  -- Contrôle
  est_actif        BOOLEAN     NOT NULL DEFAULT TRUE,
  est_systeme      BOOLEAN     NOT NULL DEFAULT FALSE,   -- TRUE = compte OHADA standard non modifiable
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un compte ne peut exister qu'une fois par tenant
  UNIQUE (tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_plan_tenant   ON plan_comptable (tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_classe   ON plan_comptable (tenant_id, classe);

DROP TRIGGER IF EXISTS trig_plan_updated_at ON plan_comptable;
CREATE TRIGGER trig_plan_updated_at
  BEFORE UPDATE ON plan_comptable
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 3. TABLE echeances ──────────────────────────────────────────────────────
-- Échéances de paiement pour les factures clients et fournisseurs

CREATE TABLE IF NOT EXISTS echeances (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Référence document
  facture_id       UUID        REFERENCES factures(id) ON DELETE CASCADE,
  tiers_id         UUID        REFERENCES tiers(id) ON DELETE SET NULL,
  type_tiers       TEXT        NOT NULL CHECK (type_tiers IN ('client','fournisseur')),

  -- Échéance
  numero_echeance  INTEGER     NOT NULL DEFAULT 1,   -- 1ère, 2ème... (pour paiements fractionnés)
  montant          NUMERIC(15,2) NOT NULL,
  date_echeance    DATE        NOT NULL,
  date_paiement    DATE,                              -- renseigné quand payé
  statut           TEXT        NOT NULL DEFAULT 'en_attente'
                               CHECK (statut IN ('en_attente','payee','retard','litige','annulee')),

  -- Pénalités
  taux_penalite    NUMERIC(5,2) DEFAULT 0,
  montant_penalite NUMERIC(15,2) DEFAULT 0,

  -- Références
  libelle          TEXT,
  moyen_paiement   TEXT,
  reference_paiement TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ech_tenant    ON echeances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ech_facture   ON echeances (facture_id);
CREATE INDEX IF NOT EXISTS idx_ech_tiers     ON echeances (tiers_id);
CREATE INDEX IF NOT EXISTS idx_ech_date      ON echeances (tenant_id, date_echeance);
CREATE INDEX IF NOT EXISTS idx_ech_statut    ON echeances (tenant_id, statut);

DROP TRIGGER IF EXISTS trig_ech_updated_at ON echeances;
CREATE TRIGGER trig_ech_updated_at
  BEFORE UPDATE ON echeances
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 4. TABLE tva_declarations ───────────────────────────────────────────────
-- Suivi des déclarations TVA mensuelles (Congo : 18% + CA 5%)

CREATE TABLE IF NOT EXISTS tva_declarations (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Période
  annee            SMALLINT    NOT NULL,
  mois             SMALLINT    NOT NULL CHECK (mois BETWEEN 1 AND 12),

  -- Bases de calcul
  ca_ht            NUMERIC(15,2) NOT NULL DEFAULT 0,    -- chiffre d'affaires HT
  achats_ht        NUMERIC(15,2) NOT NULL DEFAULT 0,    -- achats HT

  -- TVA Congo
  tva_collectee    NUMERIC(15,2) NOT NULL DEFAULT 0,    -- CA HT × 18%
  tva_deductible   NUMERIC(15,2) NOT NULL DEFAULT 0,    -- Achats HT × 18%
  tva_nette        NUMERIC(15,2) GENERATED ALWAYS AS (tva_collectee - tva_deductible) STORED,

  -- Contribution d'Appui = 5% × TVA collectée
  ca_taxe          NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Total à reverser
  total_a_reverser NUMERIC(15,2) GENERATED ALWAYS AS (
    GREATEST(tva_collectee - tva_deductible, 0) + ca_taxe
  ) STORED,

  -- Déclaration
  statut           TEXT        NOT NULL DEFAULT 'brouillon'
                               CHECK (statut IN ('brouillon','soumise','validee','payee')),
  date_declaration DATE,
  date_paiement    DATE,
  reference_dgi    TEXT,       -- référence reçue de la Direction Générale des Impôts

  -- Notes
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, annee, mois)
);

CREATE INDEX IF NOT EXISTS idx_tva_tenant  ON tva_declarations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tva_periode ON tva_declarations (tenant_id, annee, mois);

DROP TRIGGER IF EXISTS trig_tva_updated_at ON tva_declarations;
CREATE TRIGGER trig_tva_updated_at
  BEFORE UPDATE ON tva_declarations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 5. COLONNE tiers_id sur factures (si inexistante) ───────────────────────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES tiers(id) ON DELETE SET NULL;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS compte_client TEXT; -- compte OHADA client (ex: 411000)

-- ─── 6. RLS — Row Level Security ─────────────────────────────────────────────

ALTER TABLE tiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comptable   ENABLE ROW LEVEL SECURITY;
ALTER TABLE echeances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tva_declarations ENABLE ROW LEVEL SECURITY;

-- ── Politique tiers ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tiers_tenant_isolation"  ON tiers;
CREATE POLICY "tiers_tenant_isolation" ON tiers
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── Politique plan_comptable ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "plan_tenant_isolation"   ON plan_comptable;
CREATE POLICY "plan_tenant_isolation" ON plan_comptable
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── Politique echeances ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "echeances_tenant_isolation" ON echeances;
CREATE POLICY "echeances_tenant_isolation" ON echeances
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── Politique tva_declarations ───────────────────────────────────────────────
DROP POLICY IF EXISTS "tva_tenant_isolation"    ON tva_declarations;
CREATE POLICY "tva_tenant_isolation" ON tva_declarations
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ─── 7. GRANT aux rôles authentifiés ────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON tiers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_comptable   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON echeances        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tva_declarations TO authenticated;

-- ─── 8. Vue balance_tiers ─────────────────────────────────────────────────────
-- Calcule le solde de chaque tiers à partir des écritures journal

CREATE OR REPLACE VIEW balance_tiers AS
SELECT
  t.tenant_id,
  t.id          AS tiers_id,
  t.nom,
  t.type,
  t.compte_ohada,
  -- Débit : ce que le tiers nous doit (clients) ou ce qu'on leur a versé (fourn.)
  COALESCE(SUM(CASE WHEN je.debit_account = t.compte_ohada THEN je.montant ELSE 0 END), 0) AS total_debit,
  -- Crédit : ce que nous devons au tiers
  COALESCE(SUM(CASE WHEN je.credit_account = t.compte_ohada THEN je.montant ELSE 0 END), 0) AS total_credit,
  -- Solde : positif = créance (client doit), négatif = dette (on doit)
  COALESCE(SUM(
    CASE WHEN je.debit_account  = t.compte_ohada THEN  je.montant
         WHEN je.credit_account = t.compte_ohada THEN -je.montant
         ELSE 0 END
  ), 0) AS solde
FROM tiers t
LEFT JOIN journal_entries je ON je.tenant_id = t.tenant_id
GROUP BY t.tenant_id, t.id, t.nom, t.type, t.compte_ohada;

GRANT SELECT ON balance_tiers TO authenticated;

-- ─── 9. Données initiales plan_comptable — comptes OHADA fréquents ──────────
-- Ces entrées sont optionnelles : le frontend lit OHADA_ACCOUNTS depuis accounting-engine.ts
-- Ne pas dupliquer si une autre migration les a déjà insérées.

-- (Aucune insertion automatique ici — les comptes OHADA sont gérés dans lib/accounting-engine.ts
--  et peuvent être peuplés via l'interface de configuration comptable.)

-- ─── FIN ─────────────────────────────────────────────────────────────────────
COMMENT ON TABLE tiers IS 'Tiers multi-tenant : clients, fournisseurs, partenaires, salariés';
COMMENT ON TABLE plan_comptable IS 'Plan comptable OHADA personnalisé par tenant';
COMMENT ON TABLE echeances IS 'Échéances de paiement liées aux factures (clients et fournisseurs)';
COMMENT ON TABLE tva_declarations IS 'Déclarations TVA mensuelles — Congo-Brazzaville (18% + CA 5%)';
