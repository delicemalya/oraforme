-- ============================================================
-- Migration 048 — Comptabilité Enterprise OHADA
-- Tables : centres_couts, immobilisations, amortissements,
--          rapprochement_bancaire, clotures_comptables
-- Column : journal_entries.centre_cout
-- ============================================================

-- 1. Centres de coûts (Analytique)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.centres_couts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  libelle       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'departement'
                CHECK (type IN ('departement','projet','activite','autre')),
  responsable   TEXT,
  budget        NUMERIC(18,2) DEFAULT 0,
  actif         BOOLEAN DEFAULT TRUE,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.centres_couts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centres_couts_tenant" ON public.centres_couts;
CREATE POLICY "centres_couts_tenant" ON public.centres_couts
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

GRANT ALL ON public.centres_couts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centres_couts TO authenticated;


-- 2. Immobilisations (Actifs fixes — Classe 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.immobilisations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  libelle             TEXT NOT NULL,
  reference           TEXT,
  categorie           TEXT NOT NULL DEFAULT 'materiel'
                      CHECK (categorie IN ('terrain','construction','materiel','transport','informatique','mobilier','logiciel','autre')),
  compte_ohada        TEXT,
  compte_amort        TEXT,
  valeur_acquisition  NUMERIC(18,2) NOT NULL DEFAULT 0,
  date_acquisition    DATE,
  duree_amort         INTEGER DEFAULT 5,
  methode_amort       TEXT DEFAULT 'lineaire' CHECK (methode_amort IN ('lineaire','degressif')),
  valeur_residuelle   NUMERIC(18,2) DEFAULT 0,
  statut              TEXT DEFAULT 'actif' CHECK (statut IN ('actif','cede','reforme')),
  fournisseur         TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.immobilisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "immobilisations_tenant" ON public.immobilisations;
CREATE POLICY "immobilisations_tenant" ON public.immobilisations
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

GRANT ALL ON public.immobilisations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.immobilisations TO authenticated;


-- 3. Amortissements (Plan d'amortissement par exercice)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.amortissements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  immobilisation_id     UUID NOT NULL REFERENCES public.immobilisations(id) ON DELETE CASCADE,
  exercice              INTEGER NOT NULL,
  dotation              NUMERIC(18,2) NOT NULL DEFAULT 0,
  cumul_amort           NUMERIC(18,2) NOT NULL DEFAULT 0,
  valeur_nette          NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, immobilisation_id, exercice)
);

ALTER TABLE public.amortissements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amortissements_tenant" ON public.amortissements;
CREATE POLICY "amortissements_tenant" ON public.amortissements
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

GRANT ALL ON public.amortissements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amortissements TO authenticated;


-- 4. Rapprochement bancaire
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rapprochement_bancaire (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  compte          TEXT NOT NULL DEFAULT '521000',
  date_operation  DATE NOT NULL,
  libelle         TEXT NOT NULL,
  debit           NUMERIC(18,2) DEFAULT 0,
  credit          NUMERIC(18,2) DEFAULT 0,
  rapproche       BOOLEAN DEFAULT FALSE,
  movement_id     UUID,   -- référence journal_entries.id (nullable pour lignes manuelles)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rapprochement_bancaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rapprochement_bancaire_tenant" ON public.rapprochement_bancaire;
CREATE POLICY "rapprochement_bancaire_tenant" ON public.rapprochement_bancaire
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

GRANT ALL ON public.rapprochement_bancaire TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapprochement_bancaire TO authenticated;


-- 5. Clôtures comptables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clotures_comptables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mois          INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee         INTEGER NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'ouverte'
                CHECK (statut IN ('ouverte','verifiee','cloturee')),
  cloture_le    TIMESTAMPTZ,
  cloture_par   TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, mois, annee)
);

ALTER TABLE public.clotures_comptables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clotures_comptables_tenant" ON public.clotures_comptables;
CREATE POLICY "clotures_comptables_tenant" ON public.clotures_comptables
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

GRANT ALL ON public.clotures_comptables TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clotures_comptables TO authenticated;


-- 6. Ajouter colonne centre_cout à journal_entries (analytique)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'centre_cout'
  ) THEN
    ALTER TABLE public.journal_entries ADD COLUMN centre_cout TEXT;
  END IF;
END
$$;

-- Index pour améliorer les recherches analytiques
CREATE INDEX IF NOT EXISTS idx_journal_entries_centre_cout
  ON public.journal_entries(tenant_id, centre_cout);

CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_year
  ON public.journal_entries(tenant_id, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_rapprochement_bancaire_compte
  ON public.rapprochement_bancaire(tenant_id, compte, date_operation);

CREATE INDEX IF NOT EXISTS idx_amortissements_immo
  ON public.amortissements(tenant_id, immobilisation_id, exercice);


-- 7. Vue synthèse comptable par exercice
-- ============================================================
DROP VIEW IF EXISTS compta_summary_view;
CREATE OR REPLACE VIEW compta_summary_view AS
SELECT
  tenant_id,
  fiscal_year,
  COUNT(*)                                    AS nb_ecritures,
  SUM(montant)                               AS total_mouvements,
  COUNT(DISTINCT debit_account)              AS nb_comptes_debit,
  COUNT(DISTINCT credit_account)             AS nb_comptes_credit,
  MIN(date_operation)                        AS premiere_ecriture,
  MAX(date_operation)                        AS derniere_ecriture
FROM public.journal_entries
GROUP BY tenant_id, fiscal_year;

GRANT SELECT ON compta_summary_view TO authenticated, service_role;


-- ============================================================
-- FIN migration 048
-- ============================================================
