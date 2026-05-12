-- ============================================================
-- Migration 027 — ERP Consolidation
-- Centres de coûts · Trigger amélioré · Backfill · TVA
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CENTRES DE COÛTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_centers (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code       TEXT    NOT NULL,
  nom        TEXT    NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'service'
             CHECK (type IN ('direction','rh','scolarite','informatique','logistique','commercial','finance','autre')),
  actif      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_centers: select" ON cost_centers FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "cost_centers: insert" ON cost_centers FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "cost_centers: update" ON cost_centers FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "cost_centers: delete" ON cost_centers FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ────────────────────────────────────────────────────────────
-- 2. NOUVELLES COLONNES
-- ────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS reference_piece TEXT;

ALTER TABLE depenses
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS reference_piece TEXT,
  ADD COLUMN IF NOT EXISTS debit_account   TEXT,
  ADD COLUMN IF NOT EXISTS credit_account  TEXT;

ALTER TABLE achats
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS debit_account   TEXT,
  ADD COLUMN IF NOT EXISTS credit_account  TEXT;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS reference_piece TEXT,
  ADD COLUMN IF NOT EXISTS tiers_id        UUID,
  ADD COLUMN IF NOT EXISTS tiers_type      TEXT;

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER AMÉLIORÉ — gestion partielle des catégories
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_journal_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_debit       TEXT;
  v_credit      TEXT;
  v_libelle     TEXT;
  v_fiscal_year INTEGER;
  v_cat         TEXT;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM NEW.date)::INTEGER;
  v_libelle     := COALESCE(NEW.description, NEW.categorie, 'Opération de trésorerie');
  v_cat         := LOWER(COALESCE(NEW.categorie, ''));

  -- Use explicit overrides if already provided (from client form)
  IF NEW.debit_account IS NOT NULL AND NEW.debit_account <> '' THEN
    v_debit := NEW.debit_account;
  END IF;
  IF NEW.credit_account IS NOT NULL AND NEW.credit_account <> '' THEN
    v_credit := NEW.credit_account;
  END IF;

  -- If not overridden, auto-derive from type + category
  IF v_debit IS NULL OR v_credit IS NULL THEN
    IF NEW.type = 'entree' THEN
      IF    v_cat ILIKE '%vente%'         OR v_cat ILIKE '%marchandise%' THEN v_debit := '571000'; v_credit := '707000';
      ELSIF v_cat ILIKE '%facture%'                                       THEN v_debit := '521000'; v_credit := '411000';
      ELSIF v_cat ILIKE '%prestation%'    OR v_cat ILIKE '%service%'     THEN v_debit := '571000'; v_credit := '706000';
      ELSIF v_cat ILIKE '%scolarit%'      OR v_cat ILIKE '%education%'   THEN v_debit := '571000'; v_credit := '706000';
      ELSIF v_cat ILIKE '%transport%'     OR v_cat ILIKE '%course%'      THEN v_debit := '571000'; v_credit := '708000';
      ELSIF v_cat ILIKE '%avance%'        OR v_cat ILIKE '%acompte%'     THEN v_debit := '571000'; v_credit := '411000';
      ELSIF v_cat ILIKE '%virement%'      OR v_cat ILIKE '%banque%'      THEN v_debit := '521000'; v_credit := '709000';
      ELSIF v_cat ILIKE '%remboursement%'                                 THEN v_debit := '571000'; v_credit := '409000';
      ELSE                                                                     v_debit := '571000'; v_credit := '709000';
      END IF;
    ELSE -- sortie
      IF    v_cat ILIKE '%salaire%'  OR v_cat ILIKE '%rh%'              THEN v_debit := '641000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%cnss%'     OR v_cat ILIKE '%social%'          THEN v_debit := '644000'; v_credit := '431000';
      ELSIF v_cat ILIKE '%loyer%'    OR v_cat ILIKE '%locatif%'         THEN v_debit := '651000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%achat%'    OR v_cat ILIKE '%fourniture%'
                                     OR v_cat ILIKE '%fournisseur%'     THEN v_debit := '601000'; v_credit := '401000';
      ELSIF v_cat ILIKE '%carburant%' OR v_cat ILIKE '%transport%'      THEN v_debit := '601000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%taxe%'     OR v_cat ILIKE '%impôt%'
                                     OR v_cat ILIKE '%tva%'             THEN v_debit := '441000'; v_credit := '521000';
      ELSIF v_cat ILIKE '%electric%' OR v_cat ILIKE '%eau%'
                                     OR v_cat ILIKE '%téléphone%'
                                     OR v_cat ILIKE '%internet%'        THEN v_debit := '651000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%santé%'    OR v_cat ILIKE '%assurance%'       THEN v_debit := '651000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%marketing%' OR v_cat ILIKE '%publicité%'      THEN v_debit := '651000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%maintenance%' OR v_cat ILIKE '%réparation%'   THEN v_debit := '651000'; v_credit := '571000';
      ELSIF v_cat ILIKE '%voyage%'   OR v_cat ILIKE '%déplacement%'     THEN v_debit := '601000'; v_credit := '571000';
      ELSE                                                                    v_debit := '651000'; v_credit := '571000';
      END IF;
    END IF;
  END IF;

  -- Insert journal entry
  INSERT INTO journal_entries (
    tenant_id, date_operation, libelle,
    debit_account, credit_account, montant,
    source, source_id, fiscal_year, created_by,
    cost_center_id, reference_piece
  ) VALUES (
    NEW.tenant_id, NEW.date, v_libelle,
    v_debit, v_credit, NEW.montant,
    COALESCE(NEW.source, 'tresorerie'), NEW.id,
    v_fiscal_year, NEW.created_by,
    NEW.cost_center_id, NEW.reference_piece
  );

  -- Write resolved accounts back to transaction
  UPDATE transactions SET
    debit_account  = v_debit,
    credit_account = v_credit,
    fiscal_year    = v_fiscal_year
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_auto_journal_entry ON transactions;
CREATE TRIGGER trg_auto_journal_entry
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_auto_journal_entry();

-- ────────────────────────────────────────────────────────────
-- 4. BACKFILL — créer journal_entries pour transactions existantes
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_backfill_journal_entries(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx          RECORD;
  v_debit     TEXT;
  v_credit    TEXT;
  v_cat       TEXT;
  v_count     INTEGER := 0;
BEGIN
  FOR tx IN
    SELECT t.* FROM transactions t
    WHERE (p_tenant_id IS NULL OR t.tenant_id = p_tenant_id)
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.source_id = t.id AND je.source = COALESCE(t.source, 'tresorerie')
      )
  LOOP
    v_cat   := LOWER(COALESCE(tx.categorie, ''));
    v_debit := tx.debit_account;
    v_credit := tx.credit_account;

    IF v_debit IS NULL OR v_credit IS NULL THEN
      IF tx.type = 'entree' THEN
        IF    v_cat ILIKE '%vente%'       THEN v_debit := '571000'; v_credit := '707000';
        ELSIF v_cat ILIKE '%facture%'     THEN v_debit := '521000'; v_credit := '411000';
        ELSIF v_cat ILIKE '%prestation%'  THEN v_debit := '571000'; v_credit := '706000';
        ELSIF v_cat ILIKE '%scolarit%'    THEN v_debit := '571000'; v_credit := '706000';
        ELSIF v_cat ILIKE '%transport%'   THEN v_debit := '571000'; v_credit := '708000';
        ELSIF v_cat ILIKE '%avance%'      THEN v_debit := '571000'; v_credit := '411000';
        ELSIF v_cat ILIKE '%virement%'    THEN v_debit := '521000'; v_credit := '709000';
        ELSE                                   v_debit := '571000'; v_credit := '709000';
        END IF;
      ELSE
        IF    v_cat ILIKE '%salaire%'     THEN v_debit := '641000'; v_credit := '571000';
        ELSIF v_cat ILIKE '%cnss%'        THEN v_debit := '644000'; v_credit := '431000';
        ELSIF v_cat ILIKE '%loyer%'       THEN v_debit := '651000'; v_credit := '571000';
        ELSIF v_cat ILIKE '%achat%'       THEN v_debit := '601000'; v_credit := '401000';
        ELSIF v_cat ILIKE '%carburant%'   THEN v_debit := '601000'; v_credit := '571000';
        ELSIF v_cat ILIKE '%taxe%'        THEN v_debit := '441000'; v_credit := '521000';
        ELSE                                   v_debit := '651000'; v_credit := '571000';
        END IF;
      END IF;
    END IF;

    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year, created_by
    ) VALUES (
      tx.tenant_id, tx.date,
      COALESCE(tx.description, tx.categorie, 'Opération'),
      v_debit, v_credit, tx.montant,
      COALESCE(tx.source, 'tresorerie'), tx.id,
      EXTRACT(YEAR FROM tx.date)::INTEGER, tx.created_by
    );

    UPDATE transactions SET
      debit_account  = v_debit,
      credit_account = v_credit,
      fiscal_year    = EXTRACT(YEAR FROM tx.date)::INTEGER
    WHERE id = tx.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Exécuter le backfill immédiatement pour toutes les transactions existantes
SELECT fn_backfill_journal_entries(NULL);

-- ────────────────────────────────────────────────────────────
-- 5. AUTO-CRÉER EXERCICE FISCAL EN COURS si absent
-- ────────────────────────────────────────────────────────────
INSERT INTO fiscal_years (tenant_id, annee, solde_ouverture, date_ouverture)
SELECT id, EXTRACT(YEAR FROM NOW())::INTEGER, 0, DATE_TRUNC('year', NOW())::DATE
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM fiscal_years fy
  WHERE fy.tenant_id = tenants.id
    AND fy.annee = EXTRACT(YEAR FROM NOW())::INTEGER
)
ON CONFLICT (tenant_id, annee) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. VUE : compte_resultat — Produits & Charges par compte
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW compte_resultat AS
SELECT
  je.tenant_id,
  EXTRACT(YEAR FROM je.date_operation)::INTEGER AS annee,
  EXTRACT(MONTH FROM je.date_operation)::INTEGER AS mois,
  coa.account_type,
  je.debit_account AS account_number,
  coa.account_name,
  SUM(je.montant) AS total_debit,
  0::NUMERIC AS total_credit
FROM journal_entries je
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = je.debit_account
  AND (coa.tenant_id IS NULL OR coa.tenant_id = je.tenant_id)
WHERE coa.account_type IN ('charge', 'produit') OR coa.account_type IS NULL
GROUP BY je.tenant_id, annee, mois, coa.account_type, je.debit_account, coa.account_name

UNION ALL

SELECT
  je.tenant_id,
  EXTRACT(YEAR FROM je.date_operation)::INTEGER AS annee,
  EXTRACT(MONTH FROM je.date_operation)::INTEGER AS mois,
  coa.account_type,
  je.credit_account AS account_number,
  coa.account_name,
  0::NUMERIC AS total_debit,
  SUM(je.montant) AS total_credit
FROM journal_entries je
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = je.credit_account
  AND (coa.tenant_id IS NULL OR coa.tenant_id = je.tenant_id)
WHERE coa.account_type IN ('charge', 'produit') OR coa.account_type IS NULL
GROUP BY je.tenant_id, annee, mois, coa.account_type, je.credit_account, coa.account_name;

-- ────────────────────────────────────────────────────────────
-- 7. CENTRES DE COÛTS PAR DÉFAUT (insérés après onboarding)
-- ────────────────────────────────────────────────────────────
-- Décommentez et adaptez si vous voulez les créer maintenant
-- pour le tenant POLYVALON :
--
-- INSERT INTO cost_centers (tenant_id, code, nom, type)
-- SELECT id, 'DIR', 'Direction Générale', 'direction' FROM tenants WHERE nom_entreprise = 'POLYVALON'
-- UNION ALL
-- SELECT id, 'RH',  'Ressources Humaines', 'rh' FROM tenants WHERE nom_entreprise = 'POLYVALON'
-- UNION ALL
-- SELECT id, 'SCO', 'Scolarité', 'scolarite' FROM tenants WHERE nom_entreprise = 'POLYVALON'
-- UNION ALL
-- SELECT id, 'IT',  'Informatique', 'informatique' FROM tenants WHERE nom_entreprise = 'POLYVALON'
-- UNION ALL
-- SELECT id, 'FIN', 'Finance & Compta', 'finance' FROM tenants WHERE nom_entreprise = 'POLYVALON'
-- ON CONFLICT (tenant_id, code) DO NOTHING;
