-- ============================================================
-- Migration 103 — Contraintes SYSCOHADA + Amortissements Auto
-- ============================================================

-- ── 1. Trigger de validation Débit = Crédit sur journal_entries ──────────────
-- Garantit l'équilibre de chaque écriture au niveau base de données.

CREATE OR REPLACE FUNCTION fn_validate_journal_entry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Vérifier que les comptes débit et crédit sont renseignés
  IF NEW.debit_account IS NULL OR NEW.debit_account = '' THEN
    RAISE EXCEPTION 'Journal Entry SC001: compte débit obligatoire (SYSCOHADA Art. 18)';
  END IF;
  IF NEW.credit_account IS NULL OR NEW.credit_account = '' THEN
    RAISE EXCEPTION 'Journal Entry SC001: compte crédit obligatoire (SYSCOHADA Art. 18)';
  END IF;
  IF NEW.debit_account = NEW.credit_account THEN
    RAISE EXCEPTION 'Journal Entry SC002: compte débit et crédit ne peuvent pas être identiques';
  END IF;
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN
    RAISE EXCEPTION 'Journal Entry SC003: montant doit être positif';
  END IF;
  -- Vérifier que le compte commence par 1-9 (plan SYSCOHADA)
  IF LEFT(NEW.debit_account, 1) NOT IN ('1','2','3','4','5','6','7','8','9') THEN
    RAISE EXCEPTION 'Journal Entry SC004: compte débit % hors plan SYSCOHADA (classes 1-9)', NEW.debit_account;
  END IF;
  IF LEFT(NEW.credit_account, 1) NOT IN ('1','2','3','4','5','6','7','8','9') THEN
    RAISE EXCEPTION 'Journal Entry SC004: compte crédit % hors plan SYSCOHADA (classes 1-9)', NEW.credit_account;
  END IF;
  RETURN NEW;
END;
$$;

-- Appliquer le trigger sur journal_entries
DROP TRIGGER IF EXISTS trg_validate_journal_entry ON journal_entries;
CREATE TRIGGER trg_validate_journal_entry
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION fn_validate_journal_entry();

-- ── 2. Trigger de mise à jour automatique (updated_at) ───────────────────────
DROP TRIGGER IF EXISTS trg_journal_entries_upd ON journal_entries;
CREATE TRIGGER trg_journal_entries_upd
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 3. Vue Balance Générale SYSCOHADA ────────────────────────────────────────
-- Vue servant à MIAA Compliance pour analyser la balance sans passer par l'API.

CREATE OR REPLACE VIEW vue_balance_generale AS
SELECT
  tenant_id,
  fiscal_year,
  CASE
    WHEN debit_account IS NOT NULL THEN debit_account
    ELSE credit_account
  END AS compte,
  LEFT(COALESCE(debit_account, credit_account), 1)::INT AS classe,
  SUM(CASE WHEN debit_account = COALESCE(debit_account, credit_account) THEN montant ELSE 0 END) AS total_debit,
  SUM(CASE WHEN credit_account = COALESCE(debit_account, credit_account) THEN montant ELSE 0 END) AS total_credit
FROM (
  SELECT tenant_id, fiscal_year, debit_account, credit_account, montant FROM journal_entries
  UNION ALL
  SELECT tenant_id, fiscal_year, credit_account AS debit_account, debit_account AS credit_account, 0 AS montant FROM journal_entries WHERE FALSE
) base
GROUP BY tenant_id, fiscal_year, compte, classe;

-- ── 4. Table des dotations aux amortissements (auto-générées) ─────────────────

CREATE TABLE IF NOT EXISTS amortissements_dotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  immobilisation_id UUID NOT NULL,
  exercice        INT NOT NULL,
  mois            INT,           -- NULL = dotation annuelle
  dotation        NUMERIC(18,2) NOT NULL DEFAULT 0,
  cumul_amort     NUMERIC(18,2) NOT NULL DEFAULT 0,
  valeur_nette    NUMERIC(18,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID,         -- écriture SYSCOHADA générée (Dr 683 / Cr 28x)
  statut          TEXT NOT NULL DEFAULT 'calcule' CHECK (statut IN ('calcule','comptabilise','annule')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, immobilisation_id, exercice, COALESCE(mois, 0))
);

ALTER TABLE amortissements_dotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amortissements_dotations_tenant" ON amortissements_dotations USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER trg_amort_dotations_upd BEFORE UPDATE ON amortissements_dotations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_amort_dotations_immo ON amortissements_dotations(tenant_id, immobilisation_id);
CREATE INDEX IF NOT EXISTS idx_amort_dotations_exercice ON amortissements_dotations(tenant_id, exercice);

-- ── 5. Fonction de calcul des dotations aux amortissements ───────────────────
-- Calcule la dotation annuelle pour une immobilisation donnée.
-- Méthode linéaire : dotation = (valeur_acquisition - valeur_residuelle) / duree_amort

CREATE OR REPLACE FUNCTION fn_calculer_dotation_amort(
  p_valeur_acquisition NUMERIC,
  p_valeur_residuelle  NUMERIC DEFAULT 0,
  p_duree_amort        INT DEFAULT 5,
  p_methode            TEXT DEFAULT 'lineaire'
) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_base     NUMERIC;
  v_dotation NUMERIC;
BEGIN
  v_base := p_valeur_acquisition - COALESCE(p_valeur_residuelle, 0);
  IF v_base <= 0 OR p_duree_amort <= 0 THEN RETURN 0; END IF;

  IF p_methode = 'lineaire' THEN
    v_dotation := v_base / p_duree_amort;
  ELSIF p_methode = 'degressif' THEN
    -- Taux dégressif = taux linéaire × coefficient OHADA (1.25 pour 3-4 ans, 1.5 pour 5-6 ans, 2.0 pour ≥7 ans)
    DECLARE
      v_coef NUMERIC := CASE
        WHEN p_duree_amort <= 4 THEN 1.25
        WHEN p_duree_amort <= 6 THEN 1.5
        ELSE 2.0
      END;
    BEGIN
      v_dotation := v_base * (v_coef / p_duree_amort);
    END;
  ELSE
    v_dotation := v_base / p_duree_amort;
  END IF;

  RETURN ROUND(v_dotation, 2);
END;
$$;

-- ── 6. Index supplémentaires pour performance comptabilité ───────────────────

CREATE INDEX IF NOT EXISTS idx_journal_entries_debit   ON journal_entries(tenant_id, fiscal_year, debit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_credit  ON journal_entries(tenant_id, fiscal_year, credit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date    ON journal_entries(tenant_id, fiscal_year, date_operation DESC);

-- ── 7. Commentaire sur la migration ─────────────────────────────────────────
COMMENT ON TRIGGER trg_validate_journal_entry ON journal_entries IS
  'Validation SYSCOHADA Art.18 : garantit la partie double (débit≠crédit, montant>0, classes 1-9)';
