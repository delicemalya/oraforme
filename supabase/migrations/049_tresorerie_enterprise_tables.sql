-- ============================================================
-- Migration 049 — Trésorerie Enterprise Tables
-- Modules: Encaissements, Décaissements, Transferts, Remboursements,
--          Validations/Demandes Paiement, Prévisions, Rapprochements,
--          Alertes config, Alertes trésorerie
-- Date: 2026-05-25
-- ============================================================

-- ── 1. ENCAISSEMENTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS encaissements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_operation        DATE NOT NULL,
  libelle               TEXT NOT NULL,
  montant               BIGINT NOT NULL CHECK (montant > 0),
  categorie             TEXT NOT NULL DEFAULT 'autre',
  mode_paiement         TEXT NOT NULL DEFAULT 'virement',
  compte_destination    TEXT NOT NULL DEFAULT 'banque',  -- banque|caisse|mobile|wallet
  compte_destination_id UUID,
  reference             TEXT DEFAULT '',
  tiers                 TEXT DEFAULT '',
  statut                TEXT NOT NULL DEFAULT 'validé'
                          CHECK (statut IN ('en_attente','validé','rejeté','annulé')),
  notes                 TEXT DEFAULT '',
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encaissements_tenant     ON encaissements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_date       ON encaissements(tenant_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_encaissements_statut     ON encaissements(tenant_id, statut);

ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_encaissements" ON encaissements;
CREATE POLICY "tenant_encaissements" ON encaissements
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON encaissements TO service_role;
GRANT SELECT, INSERT, UPDATE ON encaissements TO authenticated;

-- ── 2. DÉCAISSEMENTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decaissements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_operation    DATE NOT NULL,
  libelle           TEXT NOT NULL,
  montant           BIGINT NOT NULL CHECK (montant > 0),
  categorie         TEXT NOT NULL DEFAULT 'autre',
  mode_paiement     TEXT NOT NULL DEFAULT 'virement',
  compte_source     TEXT NOT NULL DEFAULT 'banque',
  compte_source_id  UUID,
  reference         TEXT DEFAULT '',
  tiers             TEXT DEFAULT '',
  beneficiaire      TEXT DEFAULT '',
  statut            TEXT NOT NULL DEFAULT 'validé'
                      CHECK (statut IN ('en_attente','validé','rejeté','annulé')),
  notes             TEXT DEFAULT '',
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decaissements_tenant ON decaissements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decaissements_date   ON decaissements(tenant_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_decaissements_statut ON decaissements(tenant_id, statut);

ALTER TABLE decaissements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_decaissements" ON decaissements;
CREATE POLICY "tenant_decaissements" ON decaissements
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON decaissements TO service_role;
GRANT SELECT, INSERT, UPDATE ON decaissements TO authenticated;

-- ── 3. TRANSFERTS (inter-comptes enterprise) ────────────────────────────────

CREATE TABLE IF NOT EXISTS transferts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_transfert  DATE NOT NULL,
  libelle         TEXT DEFAULT '',
  montant         BIGINT NOT NULL CHECK (montant > 0),
  frais           BIGINT NOT NULL DEFAULT 0 CHECK (frais >= 0),
  source_type     TEXT NOT NULL CHECK (source_type IN ('banque','caisse','mobile','wallet')),
  source_id       UUID,
  source_label    TEXT DEFAULT '',
  dest_type       TEXT NOT NULL CHECK (dest_type IN ('banque','caisse','mobile','wallet')),
  dest_id         UUID,
  dest_label      TEXT DEFAULT '',
  statut          TEXT NOT NULL DEFAULT 'exécuté'
                    CHECK (statut IN ('en_attente','exécuté','annulé','rejeté')),
  reference       TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transferts_tenant ON transferts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transferts_date   ON transferts(tenant_id, date_transfert DESC);

ALTER TABLE transferts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_transferts" ON transferts;
CREATE POLICY "tenant_transferts" ON transferts
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON transferts TO service_role;
GRANT SELECT, INSERT, UPDATE ON transferts TO authenticated;

-- ── 4. REMBOURSEMENTS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remboursements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_demande        DATE NOT NULL,
  date_remboursement  DATE,
  libelle             TEXT NOT NULL,
  montant             BIGINT NOT NULL CHECK (montant > 0),
  montant_rembourse   BIGINT NOT NULL DEFAULT 0 CHECK (montant_rembourse >= 0),
  motif               TEXT DEFAULT '',
  type                TEXT NOT NULL DEFAULT 'autre'
                        CHECK (type IN ('client','fournisseur','salarie','autre')),
  tiers               TEXT NOT NULL DEFAULT '',
  mode_paiement       TEXT DEFAULT 'virement',
  compte_id           UUID,
  statut              TEXT NOT NULL DEFAULT 'demandé'
                        CHECK (statut IN ('demandé','en_cours','remboursé','rejeté','partiel')),
  reference           TEXT DEFAULT '',
  notes               TEXT DEFAULT '',
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remboursements_tenant ON remboursements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remboursements_statut ON remboursements(tenant_id, statut);

ALTER TABLE remboursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_remboursements" ON remboursements;
CREATE POLICY "tenant_remboursements" ON remboursements
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON remboursements TO service_role;
GRANT SELECT, INSERT, UPDATE ON remboursements TO authenticated;

-- ── 5. DEMANDES_PAIEMENT (Circuit de validation) ────────────────────────────

CREATE TABLE IF NOT EXISTS demandes_paiement (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_demande          DATE NOT NULL,
  libelle               TEXT NOT NULL,
  montant               BIGINT NOT NULL CHECK (montant > 0),
  categorie             TEXT DEFAULT 'fournisseur',
  mode_paiement         TEXT DEFAULT 'virement',
  beneficiaire          TEXT NOT NULL DEFAULT '',
  compte_source         TEXT DEFAULT 'banque',
  compte_source_id      UUID,
  justification         TEXT DEFAULT '',
  reference_facture     TEXT DEFAULT '',
  urgence               TEXT NOT NULL DEFAULT 'normale'
                          CHECK (urgence IN ('normale','urgente','très_urgente')),
  statut                TEXT NOT NULL DEFAULT 'en_attente'
                          CHECK (statut IN ('en_attente','validé_raf','validé_dg','approuvé','rejeté','exécuté','annulé')),
  validé_par_raf        TEXT,
  validé_par_dg         TEXT,
  approuvé_par          TEXT,
  commentaire_raf       TEXT DEFAULT '',
  commentaire_dg        TEXT DEFAULT '',
  commentaire_rejet     TEXT DEFAULT '',
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandes_paiement_tenant  ON demandes_paiement(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demandes_paiement_statut  ON demandes_paiement(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_demandes_paiement_urgence ON demandes_paiement(tenant_id, urgence);

ALTER TABLE demandes_paiement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_demandes_paiement" ON demandes_paiement;
CREATE POLICY "tenant_demandes_paiement" ON demandes_paiement
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON demandes_paiement TO service_role;
GRANT SELECT, INSERT, UPDATE ON demandes_paiement TO authenticated;

-- ── 6. PRÉVISIONS TRÉSORERIE ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS previsions_tresorerie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periode         CHAR(7) NOT NULL,   -- YYYY-MM
  type            TEXT NOT NULL CHECK (type IN ('entree','sortie')),
  categorie       TEXT NOT NULL DEFAULT '',
  libelle         TEXT NOT NULL,
  montant_prevu   BIGINT NOT NULL CHECK (montant_prevu > 0),
  montant_reel    BIGINT NOT NULL DEFAULT 0,
  probabilite     SMALLINT NOT NULL DEFAULT 80 CHECK (probabilite BETWEEN 0 AND 100),
  statut          TEXT NOT NULL DEFAULT 'planifié'
                    CHECK (statut IN ('planifié','partiel','réalisé','dépassé','annulé')),
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_previsions_tenant  ON previsions_tresorerie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_previsions_periode ON previsions_tresorerie(tenant_id, periode);

ALTER TABLE previsions_tresorerie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_previsions_tresorerie" ON previsions_tresorerie;
CREATE POLICY "tenant_previsions_tresorerie" ON previsions_tresorerie
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON previsions_tresorerie TO service_role;
GRANT SELECT, INSERT, UPDATE ON previsions_tresorerie TO authenticated;

-- ── 7. RAPPROCHEMENTS BANCAIRES (Trésorerie) ────────────────────────────────

CREATE TABLE IF NOT EXISTS rapprochements_bancaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  compte_id       UUID NOT NULL,  -- FK to comptes_bancaires
  date_operation  DATE NOT NULL,
  libelle         TEXT NOT NULL DEFAULT '',
  debit           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  rapproche       BOOLEAN NOT NULL DEFAULT FALSE,
  reference       TEXT DEFAULT '',
  movement_id     UUID,   -- optional link to a transaction
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rapprochements_bancaires_tenant  ON rapprochements_bancaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rapprochements_bancaires_compte  ON rapprochements_bancaires(tenant_id, compte_id);
CREATE INDEX IF NOT EXISTS idx_rapprochements_bancaires_rapproche ON rapprochements_bancaires(tenant_id, rapproche);

ALTER TABLE rapprochements_bancaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rapprochements_bancaires" ON rapprochements_bancaires;
CREATE POLICY "tenant_rapprochements_bancaires" ON rapprochements_bancaires
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON rapprochements_bancaires TO service_role;
GRANT SELECT, INSERT, UPDATE ON rapprochements_bancaires TO authenticated;

-- ── 8. ALERTES CONFIG ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertes_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  libelle         TEXT NOT NULL,
  seuil           BIGINT NOT NULL DEFAULT 0,
  compte_id       UUID,
  compte_type     TEXT,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertes_config_tenant ON alertes_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertes_config_actif  ON alertes_config(tenant_id, actif);

ALTER TABLE alertes_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_alertes_config" ON alertes_config;
CREATE POLICY "tenant_alertes_config" ON alertes_config
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON alertes_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON alertes_config TO authenticated;

-- ── 9. ALERTES TRÉSORERIE (Log) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertes_tresorerie (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id   UUID REFERENCES alertes_config(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info','warning','critical')),
  montant     BIGINT,
  compte      TEXT,
  lue         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertes_tresorerie_tenant  ON alertes_tresorerie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertes_tresorerie_lue     ON alertes_tresorerie(tenant_id, lue);
CREATE INDEX IF NOT EXISTS idx_alertes_tresorerie_severity ON alertes_tresorerie(tenant_id, severity);

ALTER TABLE alertes_tresorerie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_alertes_tresorerie" ON alertes_tresorerie;
CREATE POLICY "tenant_alertes_tresorerie" ON alertes_tresorerie
  USING (tenant_id = get_my_tenant_id());

GRANT ALL ON alertes_tresorerie TO service_role;
GRANT SELECT, INSERT, UPDATE ON alertes_tresorerie TO authenticated;

-- ── 10. ENRICHISSEMENT TABLE TRANSACTIONS ───────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='source') THEN
    ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='source_id') THEN
    ALTER TABLE transactions ADD COLUMN source_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='compte') THEN
    ALTER TABLE transactions ADD COLUMN compte TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='reference') THEN
    ALTER TABLE transactions ADD COLUMN reference TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='transactions' AND column_name='notes') THEN
    ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_source   ON transactions(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions(tenant_id, date DESC, type);

-- ── 11. VUE SOMMAIRE TRÉSORERIE ──────────────────────────────────────────────

CREATE OR REPLACE VIEW tresorerie_summary_view AS
SELECT
  t.tenant_id,
  COALESCE(SUM(CASE WHEN t.type = 'entree'  THEN t.montant ELSE 0 END), 0) AS total_entrees,
  COALESCE(SUM(CASE WHEN t.type = 'sortie'  THEN t.montant ELSE 0 END), 0) AS total_sorties,
  COALESCE(SUM(CASE WHEN t.type = 'entree'  THEN t.montant ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'sortie' THEN t.montant ELSE 0 END), 0) AS cashflow_net,
  COUNT(*) AS nb_operations,
  MAX(t.date) AS derniere_operation
FROM transactions t
WHERE t.date >= date_trunc('month', CURRENT_DATE)
GROUP BY t.tenant_id;

GRANT SELECT ON tresorerie_summary_view TO authenticated;
GRANT SELECT ON tresorerie_summary_view TO service_role;

-- ── 12. FONCTION CASHFLOW MENSUEL ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_cashflow_mensuel(p_tenant_id UUID, p_mois CHAR(7))
RETURNS TABLE (entrees BIGINT, sorties BIGINT, cashflow_net BIGINT) AS $$
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN type IN ('sortie','frais') THEN montant ELSE 0 END), 0)::BIGINT,
    (COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type IN ('sortie','frais') THEN montant ELSE 0 END), 0))::BIGINT
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND to_char(date, 'YYYY-MM') = p_mois;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_cashflow_mensuel(UUID, CHAR(7)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cashflow_mensuel(UUID, CHAR(7)) TO service_role;

-- ── 13. TRIGGER — Auto-update solde comptes_bancaires ─────────────────────

-- Auto-create alert when compte_bancaire goes below 100k
CREATE OR REPLACE FUNCTION fn_check_low_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.solde < 100000 AND OLD.solde >= 100000 THEN
    INSERT INTO alertes_tresorerie (tenant_id, type, message, severity, montant, compte)
    VALUES (
      NEW.tenant_id,
      'solde_min_banque',
      'Compte "' || NEW.intitule || '" (' || NEW.banque || ') : solde faible (' || NEW.solde || ' FCFA)',
      CASE WHEN NEW.solde < 0 THEN 'critical' ELSE 'warning' END,
      NEW.solde,
      NEW.intitule
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_low_balance_banque ON comptes_bancaires;
CREATE TRIGGER trg_low_balance_banque
  AFTER UPDATE OF solde ON comptes_bancaires
  FOR EACH ROW EXECUTE FUNCTION fn_check_low_balance();

-- ── 14. COMMENTAIRES ─────────────────────────────────────────────────────────

COMMENT ON TABLE encaissements         IS 'Encaissements trésorerie — entrées de fonds';
COMMENT ON TABLE decaissements         IS 'Décaissements trésorerie — sorties de fonds';
COMMENT ON TABLE transferts            IS 'Transferts inter-comptes avec écriture OHADA automatique';
COMMENT ON TABLE remboursements        IS 'Demandes et exécutions de remboursements';
COMMENT ON TABLE demandes_paiement     IS 'Circuit validation: Demande → RAF → DG → Comptable → Exécution';
COMMENT ON TABLE previsions_tresorerie IS 'Prévisions cashflow 12 mois glissants';
COMMENT ON TABLE rapprochements_bancaires IS 'Rapprochement relevés bancaires vs soldes comptables';
COMMENT ON TABLE alertes_config        IS 'Règles d'alerte personnalisées par tenant';
COMMENT ON TABLE alertes_tresorerie    IS 'Log des alertes financières déclenchées';
