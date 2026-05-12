-- ============================================================
-- 031 — Interconnexion financière croisée
--       Factures → Transactions → Journal
--       Paie     → Transactions → Journal
--       Scolarité→ Transactions → Journal
--       Rapprochement bancaire
--       Comptes tiers (clients/fournisseurs)
-- ============================================================

-- ── 1. Table rapprochement bancaire ──────────────────────────

CREATE TABLE IF NOT EXISTS rapprochement_bancaire (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id       UUID        REFERENCES ecole_wallets(id) ON DELETE SET NULL,
  date_releve     DATE        NOT NULL,
  reference       TEXT        NOT NULL,
  montant         NUMERIC(15,2) NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('debit', 'credit')),
  libelle         TEXT,
  statut          TEXT        NOT NULL DEFAULT 'non_rapproche'
                  CHECK (statut IN ('non_rapproche', 'rapproche', 'ecart')),
  transaction_id  UUID        REFERENCES transactions(id) ON DELETE SET NULL,
  ecart           NUMERIC(15,2) GENERATED ALWAYS AS (
    CASE WHEN statut = 'ecart' THEN montant ELSE 0 END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rapprochement_bancaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rapprochement: all" ON rapprochement_bancaire;
CREATE POLICY "rapprochement: all" ON rapprochement_bancaire
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_rapprochement_tenant   ON rapprochement_bancaire (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rapprochement_statut   ON rapprochement_bancaire (statut);
CREATE INDEX IF NOT EXISTS idx_rapprochement_wallet   ON rapprochement_bancaire (wallet_id);

-- ── 2. Table comptes tiers (clients / fournisseurs) ──────────

CREATE TABLE IF NOT EXISTS comptes_tiers (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('client', 'fournisseur', 'autre')),
  nom         TEXT        NOT NULL,
  email       TEXT,
  telephone   TEXT,
  adresse     TEXT,
  rccm        TEXT,
  nif         TEXT,
  solde       NUMERIC(15,2) NOT NULL DEFAULT 0,
  limite_credit NUMERIC(15,2),
  actif       BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE comptes_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comptes_tiers: all" ON comptes_tiers;
CREATE POLICY "comptes_tiers: all" ON comptes_tiers
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_comptes_tiers_tenant ON comptes_tiers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comptes_tiers_type   ON comptes_tiers (type);

-- Colonne optionnelle : lier un compte tiers à une facture
ALTER TABLE factures ADD COLUMN IF NOT EXISTS compte_tiers_id UUID REFERENCES comptes_tiers(id) ON DELETE SET NULL;

-- ── 3. Trigger : Facture payée → Transaction automatique ─────

CREATE OR REPLACE FUNCTION fn_facture_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fiscal_year INT;
BEGIN
  -- Ne déclencher que lors du passage à 'payee'
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN

    -- Vérifier que la transaction n'existe pas déjà (idempotence)
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE source = 'factures' AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      v_fiscal_year := EXTRACT(YEAR FROM COALESCE(NEW.date::date, NOW()::date));

      INSERT INTO transactions (
        tenant_id, type, categorie, montant,
        libelle, date_operation, moyen_paiement,
        source, source_id, reference_externe
      ) VALUES (
        NEW.tenant_id,
        'entree',
        'Facture payée',
        COALESCE(NEW.total, NEW.subtotal, 0),
        COALESCE('Règlement facture ' || NEW.invoice_number, 'Règlement facture'),
        COALESCE(NEW.date::date, CURRENT_DATE),
        COALESCE(NEW.moyen_paiement, 'virement'),
        'factures',
        NEW.id,
        NEW.invoice_number
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facture_to_transaction ON factures;
CREATE TRIGGER trg_facture_to_transaction
  AFTER UPDATE ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_to_transaction();

-- Colonne moyen_paiement sur factures si manquante
ALTER TABLE factures ADD COLUMN IF NOT EXISTS moyen_paiement TEXT DEFAULT 'virement';
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reference_externe TEXT;

-- ── 4. Trigger : Fiche de paie validée → Transaction salaire ─

CREATE OR REPLACE FUNCTION fn_paie_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE source = 'fiches_paie' AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      INSERT INTO transactions (
        tenant_id, type, categorie, montant,
        libelle, date_operation, moyen_paiement,
        source, source_id
      ) VALUES (
        NEW.tenant_id,
        'sortie',
        'Salaires',
        COALESCE(NEW.salaire_net, NEW.salaire_base, 0),
        COALESCE(
          'Salaire ' || TO_CHAR(COALESCE(NEW.periode_mois, CURRENT_DATE)::date, 'MM/YYYY'),
          'Salaire mensuel'
        ),
        COALESCE(NEW.date_paiement, CURRENT_DATE),
        'virement',
        'fiches_paie',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paie_to_transaction ON fiches_paie;
CREATE TRIGGER trg_paie_to_transaction
  AFTER UPDATE ON fiches_paie
  FOR EACH ROW EXECUTE FUNCTION fn_paie_to_transaction();

-- ── 5. Trigger : Paiement scolaire → Transaction ─────────────

CREATE OR REPLACE FUNCTION fn_paiement_scolaire_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- S'exécute à l'INSERT d'un paiement validé
  IF COALESCE(NEW.statut, 'valide') IN ('valide', 'confirme') THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE source = 'paiements_scolaires' AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      INSERT INTO transactions (
        tenant_id, type, categorie, montant,
        libelle, date_operation, moyen_paiement,
        source, source_id
      ) VALUES (
        NEW.tenant_id,
        'entree',
        'Scolarité',
        NEW.montant,
        COALESCE(NEW.libelle, 'Frais de scolarité'),
        COALESCE(NEW.date_paiement, CURRENT_DATE),
        COALESCE(NEW.mode_paiement, 'especes'),
        'paiements_scolaires',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiement_scolaire ON paiements_scolaires;
CREATE TRIGGER trg_paiement_scolaire
  AFTER INSERT ON paiements_scolaires
  FOR EACH ROW EXECUTE FUNCTION fn_paiement_scolaire_to_transaction();

-- ── 6. Trigger : Mouvement wallet école → Journal OHADA ──────
-- Les mouvements wallet créent déjà une mise à jour du solde (migration 029).
-- Ce trigger crée en plus l'écriture comptable OHADA.

CREATE OR REPLACE FUNCTION fn_wallet_movement_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_debit  TEXT;
  v_credit TEXT;
  v_fiscal_year INT;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM NOW());

  -- Mobile money → 521100 (Banque mobile) ou 521000 (Banque)
  -- Caisse espèces → 571000
  -- Par défaut: 521000 banque
  IF NEW.type = 'entree' THEN
    v_debit  := '521000';  -- Banque / Mobile money
    v_credit := '706000';  -- Prestation de services / Scolarité
  ELSE
    v_debit  := '651000';  -- Charges
    v_credit := '521000';  -- Banque / Mobile money
  END IF;

  -- Vérifier unicité
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE source = 'ecole_wallet_movements' AND source_id = NEW.id
      AND tenant_id = NEW.tenant_id
  ) THEN
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year
    ) VALUES (
      NEW.tenant_id,
      NOW()::date,
      NEW.libelle,
      v_debit, v_credit, NEW.montant,
      'ecole_wallet_movements',
      NEW.id,
      v_fiscal_year
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_movement_journal ON ecole_wallet_movements;
CREATE TRIGGER trg_wallet_movement_journal
  AFTER INSERT ON ecole_wallet_movements
  FOR EACH ROW EXECUTE FUNCTION fn_wallet_movement_to_journal();

-- ── 7. Vue : Balance clients (comptes tiers 411) ─────────────

CREATE OR REPLACE VIEW vue_balance_clients AS
SELECT
  t.tenant_id,
  COALESCE(f.client_nom, f.client_name)                        AS nom_client,
  COUNT(*)                                                      AS nb_factures,
  SUM(CASE WHEN f.statut IN ('brouillon','envoyee') THEN COALESCE(f.total,0) ELSE 0 END) AS encours,
  SUM(CASE WHEN f.statut = 'payee' THEN COALESCE(f.total,0) ELSE 0 END)                  AS regle,
  SUM(COALESCE(f.total,0))                                     AS total_facture
FROM transactions t
JOIN factures f ON f.tenant_id = t.tenant_id
  AND f.id = t.source_id
  AND t.source = 'factures'
GROUP BY t.tenant_id, COALESCE(f.client_nom, f.client_name);

-- ── 8. Vue : Balance fournisseurs (comptes tiers 401) ────────

CREATE OR REPLACE VIEW vue_balance_fournisseurs AS
SELECT
  tenant_id,
  categorie                                                    AS type_charge,
  COUNT(*)                                                     AS nb_operations,
  SUM(montant)                                                 AS total_engage
FROM transactions
WHERE type = 'sortie'
  AND categorie IN ('Achats', 'Loyer', 'Charges', 'Carburant')
GROUP BY tenant_id, categorie;

-- ── 9. Vue grand livre enrichi ────────────────────────────────

CREATE OR REPLACE VIEW vue_grand_livre AS
SELECT
  je.tenant_id,
  je.date_operation,
  je.libelle,
  je.debit_account,
  je.credit_account,
  je.montant,
  je.source,
  je.reference_piece,
  je.fiscal_year,
  coa_d.account_name  AS libelle_debit,
  coa_c.account_name  AS libelle_credit,
  cc.nom              AS centre_cout
FROM journal_entries je
LEFT JOIN chart_of_accounts coa_d ON coa_d.account_number = je.debit_account  AND coa_d.tenant_id = je.tenant_id
LEFT JOIN chart_of_accounts coa_c ON coa_c.account_number = je.credit_account AND coa_c.tenant_id = je.tenant_id
LEFT JOIN cost_centers cc ON cc.id = je.cost_center_id
ORDER BY je.date_operation DESC, je.created_at DESC;
