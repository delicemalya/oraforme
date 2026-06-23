-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 132 — Normalisation TVA globale
-- Objectif : unifier toutes les écritures TVA collectée sur 4441 (SYSCOHADA)
-- Sources corrigées : factures_emises, factures_tva, resto_pos_tva,
--                     tva_declaration, tva_paiement
-- Prérequis : migration 131 appliquée (sante_facture déjà en 4441)
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION AVANT — À EXÉCUTER AVANT LA MIGRATION
-- Sauvegarder les résultats pour comparaison post-migration
-- ══════════════════════════════════════════════════════════════════════════════

-- SELECT 'AVANT_132' AS etape, credit_account, source, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE credit_account IN ('441','441000','4441')
-- GROUP BY credit_account, source
-- ORDER BY source, credit_account;

-- SELECT 'AVANT_132_DEBIT' AS etape, debit_account, source, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE debit_account IN ('441','441000','4441')
-- GROUP BY debit_account, source
-- ORDER BY source, debit_account;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION — À EXÉCUTER
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Backfill credit_account : 441 → 4441
--    Sources concernées uniquement — sante_facture exclu (déjà 4441 via mig.131)
UPDATE journal_entries
SET credit_account = '4441'
WHERE credit_account = '441'
  AND source IN (
    'factures_emises',
    'factures_tva',
    'resto_pos_tva',
    'tva_declaration',
    'tva_paiement'
  );

-- 2. Backfill credit_account : 441000 résiduel → 4441
--    Écritures antérieures à migration 119 ayant échappé à la normalisation
UPDATE journal_entries
SET credit_account = '4441'
WHERE credit_account = '441000'
  AND source NOT IN ('sante_facture');

-- 3. Backfill debit_account : 441 / 441000 → 4441
--    tva_declaration débite 441 pour neutraliser la TVA collectée
UPDATE journal_entries
SET debit_account = '4441'
WHERE debit_account IN ('441', '441000')
  AND source IN ('tva_declaration', 'tva_paiement');

-- 4. Corriger fn_normalize_journal_account_codes
--    Supprimer la condition source pour le mapping TVA → applicable à toutes les sources
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

  -- TVA collectée → 4441 : toutes les sources sans condition (BUG-TX-01)
  IF debit_norm  IN ('441', '443') THEN debit_norm  := '4441'; END IF;
  IF credit_norm IN ('441', '443') THEN credit_norm := '4441'; END IF;

  -- Paie : rémunérations dues = 421 (conservé)
  IF debit_norm  = '422' AND NEW.source = 'paie' THEN debit_norm  := '421'; END IF;
  IF credit_norm = '422' AND NEW.source = 'paie' THEN credit_norm := '421'; END IF;

  NEW.debit_account  := debit_norm;
  NEW.credit_account := credit_norm;
  RETURN NEW;
END;
$$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION APRÈS — À EXÉCUTER APRÈS LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Aucun '441' résiduel dans les sources normalisées (doit retourner 0)
-- SELECT 'CONTROLE_132_TVA_RESIDUEL' AS controle, COUNT(*) AS anomalies
-- FROM journal_entries
-- WHERE credit_account IN ('441', '441000')
--   AND source IN ('factures_emises','factures_tva','resto_pos_tva',
--                  'tva_declaration','tva_paiement');

-- 2. Confirmation 4441 présent par source
-- SELECT 'APRES_132' AS etape, source, COUNT(*) AS lignes_4441
-- FROM journal_entries
-- WHERE credit_account = '4441'
-- GROUP BY source
-- ORDER BY source;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ══════════════════════════════════════════════════════════════════════════════

-- BEGIN;
-- UPDATE journal_entries SET credit_account = '441'
--   WHERE credit_account = '4441'
--     AND source IN ('factures_emises','factures_tva','resto_pos_tva',
--                    'tva_declaration','tva_paiement');
-- UPDATE journal_entries SET debit_account = '441'
--   WHERE debit_account = '4441'
--     AND source IN ('tva_declaration','tva_paiement');
-- -- IMPORTANT : ne pas toucher sante_facture dans le rollback
-- -- Restaurer fn_normalize_journal_account_codes version migration 131 (avec source IN condition)
-- COMMIT;
