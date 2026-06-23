-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 131 — BUG-S2-03 : normalisation TVA Santé
-- Problème : fn_his_facture_journal écrit '441000' → fn_normalize tronque en '441'
-- mais la condition source='facture' rate 'sante_facture' → résultat '441' jamais capturé.
-- Fix : backfill '441' → '4441' + élargir la normalisation + corriger le trigger.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Backfill : corriger les comptes TVA déjà mal normalisés ────────────────
-- Les journal_entries existants issus de sante_facture ont credit_account = '441'
-- au lieu de '4441'. Aucune requête TVA ne les capturait.

UPDATE journal_entries
SET credit_account = '4441'
WHERE credit_account = '441'
  AND source = 'sante_facture';

UPDATE journal_entries
SET debit_account = '4441'
WHERE debit_account = '441'
  AND source = 'sante_facture';

-- Vérification (commentée) :
-- SELECT credit_account, COUNT(*) FROM journal_entries WHERE source = 'sante_facture'
--   GROUP BY credit_account;
-- → Doit montrer 4441, 705, 511/5711/512 (plus de '441000', plus de '441')

-- ── 2. Corriger fn_normalize_journal_account_codes ────────────────────────────
-- Étendre la condition TVA pour inclure source='sante_facture'.

CREATE OR REPLACE FUNCTION fn_normalize_journal_account_codes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  debit_norm  TEXT := NEW.debit_account;
  credit_norm TEXT := NEW.credit_account;
BEGIN
  -- Supprimer les suffixes '000' pour les codes 6 chiffres standards
  IF LENGTH(debit_norm) = 6 AND RIGHT(debit_norm, 3) = '000' THEN
    debit_norm := LEFT(debit_norm, 3);
  END IF;
  IF LENGTH(credit_norm) = 6 AND RIGHT(credit_norm, 3) = '000' THEN
    credit_norm := LEFT(credit_norm, 3);
  END IF;

  -- TVA collectée → 4441 : factures classiques ET factures médicales (BUG-S2-03)
  IF debit_norm IN ('441','443') AND NEW.source IN ('facture', 'sante_facture') THEN debit_norm := '4441'; END IF;
  IF credit_norm IN ('441','443') AND NEW.source IN ('facture', 'sante_facture') THEN credit_norm := '4441'; END IF;

  -- Paie : rémunérations dues = 421 (pas 422 qui est avances/acomptes)
  IF debit_norm = '422' AND NEW.source = 'paie' THEN debit_norm := '421'; END IF;
  IF credit_norm = '422' AND NEW.source = 'paie' THEN credit_norm := '421'; END IF;

  NEW.debit_account  := debit_norm;
  NEW.credit_account := credit_norm;
  RETURN NEW;
END;
$$;

-- ── 3. Corriger fn_his_facture_journal ───────────────────────────────────────
-- Utiliser directement les codes SYSCOHADA 4-chiffres (et non 6 chiffres qui
-- transitaient par la normalisation avec la mauvaise condition source).
-- TVA 18% + Centime Additionnel 5% sur TVA = 18.9% du TTC — Congo uniquement.

CREATE OR REPLACE FUNCTION fn_his_facture_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_delta  NUMERIC;
  v_debit  TEXT;
  v_ht     NUMERIC;
  v_tva    NUMERIC;
  v_fy     TEXT;
BEGIN
  v_delta := NEW.montant_paye - OLD.montant_paye;
  IF v_delta > 0 THEN
    v_debit := CASE NEW.mode_paiement
      WHEN 'especes'       THEN '511'
      WHEN 'mobile_money'  THEN '5711'
      WHEN 'carte'         THEN '512'
      ELSE '5712'
    END;
    v_ht  := ROUND(v_delta / 1.189, 0);
    v_tva := v_delta - v_ht;
    v_fy  := TO_CHAR(NOW(), 'YYYY');
    INSERT INTO journal_entries (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES (NEW.tenant_id, NOW(), 'Facture ' || COALESCE(NEW.numero_facture,'') || ' HT', v_debit, '705', v_ht, 'sante_facture', NEW.id, v_fy);
    INSERT INTO journal_entries (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES (NEW.tenant_id, NOW(), 'TVA Facture ' || COALESCE(NEW.numero_facture,''), v_debit, '4441', v_tva, 'sante_facture', NEW.id, v_fy);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

COMMIT;
