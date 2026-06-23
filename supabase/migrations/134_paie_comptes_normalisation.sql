-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 134 — Paie : cohérence comptes charges et personnel
-- Objectif : corriger l'incohérence 641/661 et 644/664 entre le backfill
--            migration 119 (→ 661/664) et le trigger générique (→ 641/644)
-- Sources corrigées : paie_accrual, paie_cnss
-- Prérequis : migrations 132 et 133 appliquées
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION AVANT — À EXÉCUTER AVANT LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- SELECT 'AVANT_134' AS etape, debit_account, source, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE debit_account IN ('641','644','661','664')
--   AND source IN ('paie_accrual','paie_cnss')
-- GROUP BY debit_account, source
-- ORDER BY source, debit_account;
-- → Attendu avant : mix de 641/661 pour paie_accrual, mix 644/664 pour paie_cnss

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION — À EXÉCUTER
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Backfill 641 → 661 (salaires bruts)
--    Migration 119 avait créé 661 via backfill, mais le trigger générique
--    produisait 641000 → 641 pour les nouvelles écritures
UPDATE journal_entries
SET debit_account = '661'
WHERE debit_account = '641'
  AND source = 'paie_accrual';

-- 2. Backfill 644 → 664 (charges sociales patronales)
UPDATE journal_entries
SET debit_account = '664'
WHERE debit_account = '644'
  AND source = 'paie_cnss';

-- 3. Corriger fn_bulletins_paie_to_journal
--    Utiliser directement 661/664 (SYSCOHADA Congo) au lieu de 641000/644000
--    qui transitaient par la normalisation générique et aboutissaient à 641/644
CREATE OR REPLACE FUNCTION fn_bulletins_paie_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year     INT;
  v_credit   TEXT;
  v_libelle  TEXT;
  v_net      NUMERIC(14,2);
  v_date     DATE;
BEGIN
  -- ── Accrual à la validation ─────────────────────────────────────────────────
  IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'paie_accrual' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_year    := EXTRACT(YEAR FROM v_date)::INT;
      v_libelle := 'Bulletin paie ' || NEW.mois || '/' || NEW.annee;

      -- A1. Salaire brut : 661 / 421 (SYSCOHADA Congo — rémunérations directes)
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account,
         montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — salaire brut',
         '661', '421', COALESCE(NEW.brut, 0), 'paie_accrual', NEW.id, v_year);

      -- A2. CNSS patronal : 664 / 431 (SYSCOHADA Congo — charges sociales patronales)
      IF COALESCE(NEW.cnss_patronal, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle, debit_account, credit_account,
           montant, source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS patronal',
           '664', '431', NEW.cnss_patronal, 'paie_cnss', NEW.id, v_year);
      END IF;
    END IF;
  END IF;

  -- ── Paiement ────────────────────────────────────────────────────────────────
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'paie_paiement' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_year    := EXTRACT(YEAR FROM v_date)::INT;
      v_libelle := 'Virement salaires ' || NEW.mois || '/' || NEW.annee;
      v_credit  := fn_ohada_cash_account(COALESCE(NEW.mode_paiement, 'virement'));
      v_net     := GREATEST(
        COALESCE(NEW.brut, 0) - COALESCE(NEW.cnss_salarie, 0) - COALESCE(NEW.irpp, 0),
        0
      );

      -- B. Paiement net : 421 / Trésorerie
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account,
         montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle,
         '421', v_credit, v_net, 'paie_paiement', NEW.id, v_year);

      INSERT INTO transactions
        (tenant_id, type, categorie, description, montant, date,
         mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
      VALUES
        (NEW.tenant_id, 'sortie', 'Paie', v_libelle, v_net, v_date,
         COALESCE(NEW.mode_paiement, 'virement'), 'paie', NEW.id,
         '421', v_credit, v_year);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION APRÈS — À EXÉCUTER APRÈS LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Aucun 641 ou 644 résiduel dans les sources paie (doit retourner 0)
-- SELECT 'CONTROLE_134_PAIE_RESIDUEL' AS controle, COUNT(*) AS anomalies
-- FROM journal_entries
-- WHERE debit_account IN ('641','644')
--   AND source IN ('paie_accrual','paie_cnss');

-- 2. Confirmation 661/664 unifiés
-- SELECT 'APRES_134' AS etape, debit_account, source, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE source IN ('paie_accrual','paie_cnss')
-- GROUP BY debit_account, source
-- ORDER BY source, debit_account;
-- → Attendu : 661 (paie_accrual), 664 (paie_cnss) uniquement

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ══════════════════════════════════════════════════════════════════════════════

-- BEGIN;
-- UPDATE journal_entries SET debit_account = '641'
--   WHERE debit_account = '661' AND source = 'paie_accrual';
-- UPDATE journal_entries SET debit_account = '644'
--   WHERE debit_account = '664' AND source = 'paie_cnss';
-- -- Restaurer fn_bulletins_paie_to_journal version migration 046 (641000/644000)
-- COMMIT;
-- NOTE : rollback recrée l'incohérence 641/661 uniquement pour les écritures
-- de ce backfill — les écritures migration 119 (backfill historique) restent en 661
