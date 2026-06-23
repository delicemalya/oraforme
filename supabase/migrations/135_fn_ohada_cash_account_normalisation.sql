-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 135 — fn_ohada_cash_account : codes SYSCOHADA 4-chiffres
-- Objectif : la fonction retournait des codes 6 chiffres (571000, 521000,
--            571100, 571200). Après normalisation trigger : 571000→571, 521000→521
--            mais 571100 et 571200 restaient en 6 chiffres (ne finissent pas par 000).
--            Cette migration standardise la fonction pour produire directement
--            les codes cibles SYSCOHADA (571, 521, 5711, 5712).
-- Effet : uniquement sur les FUTURES écritures (aucun backfill)
--         les anciennes écritures 571100/571200 restent telles quelles
--         la vue migration 133 gère les deux formats
-- Prérequis : migrations 132, 133, 134 appliquées
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION AVANT — À EXÉCUTER AVANT LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- Test unitaire de la fonction AVANT modification :
-- SELECT
--   fn_ohada_cash_account('especes')     AS caisse_avant,    -- attendu actuel : 571000
--   fn_ohada_cash_account('airtel')      AS airtel_avant,    -- attendu actuel : 571100
--   fn_ohada_cash_account('mtn')         AS mtn_avant,       -- attendu actuel : 571200
--   fn_ohada_cash_account('mobile')      AS mobile_avant,    -- attendu actuel : 571100
--   fn_ohada_cash_account('virement')    AS banque_avant,    -- attendu actuel : 521000
--   fn_ohada_cash_account('carte')       AS carte_avant;     -- attendu actuel : 521000

-- Distribution des codes mobile money actuels en base :
-- SELECT 'AVANT_135' AS etape, debit_account, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE debit_account IN ('571100','571200','5711','5712')
-- GROUP BY debit_account ORDER BY debit_account;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION — À EXÉCUTER
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Aucun backfill intentionnel :
-- Les anciennes écritures 571100/571200 restent telles quelles
-- La vue (migration 133) les capture déjà sous les deux formats
-- Seules les FUTURES écritures utiliseront 5711/5712

CREATE OR REPLACE FUNCTION fn_ohada_cash_account(p_mode TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_mode ILIKE '%espece%'  OR p_mode = 'cash'         THEN '571'
    WHEN p_mode ILIKE '%airtel%'                              THEN '5711'
    WHEN p_mode ILIKE '%mtn%'     OR p_mode ILIKE '%momo%'   THEN '5712'
    WHEN p_mode ILIKE '%mobile%'                              THEN '5711'
    ELSE '521'
  END
$$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION APRÈS — À EXÉCUTER APRÈS LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- Test unitaire de la fonction APRÈS modification :
-- SELECT
--   fn_ohada_cash_account('especes')     AS caisse_apres,    -- attendu : 571
--   fn_ohada_cash_account('airtel')      AS airtel_apres,    -- attendu : 5711
--   fn_ohada_cash_account('mtn')         AS mtn_apres,       -- attendu : 5712
--   fn_ohada_cash_account('mobile')      AS mobile_apres,    -- attendu : 5711
--   fn_ohada_cash_account('virement')    AS banque_apres,    -- attendu : 521
--   fn_ohada_cash_account('carte')       AS carte_apres;     -- attendu : 521

-- Après un paiement test réel, vérifier le code créé :
-- SELECT debit_account, source, created_at FROM journal_entries
-- WHERE source IN ('factures_paiement','paie_paiement')
-- ORDER BY created_at DESC LIMIT 5;
-- → Nouvelles lignes doivent avoir 5711 ou 5712 (pas 571100/571200)

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ══════════════════════════════════════════════════════════════════════════════

-- BEGIN;
-- CREATE OR REPLACE FUNCTION fn_ohada_cash_account(p_mode TEXT)
-- RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
--   SELECT CASE
--     WHEN p_mode ILIKE '%espece%'  OR p_mode = 'cash'         THEN '571000'
--     WHEN p_mode ILIKE '%mobile%'  OR p_mode ILIKE '%airtel%' THEN '571100'
--     WHEN p_mode ILIKE '%mtn%'     OR p_mode ILIKE '%momo%'   THEN '571200'
--     ELSE '521000'
--   END
-- $$;
-- COMMIT;
-- NOTE : après rollback, le trigger de normalisation reconvertira 571000→571
-- et 521000→521. Les écritures 5711/5712 créées entre 135 et le rollback
-- restent en 5711/5712 — coexistence gérée par la vue migration 133.

-- ══════════════════════════════════════════════════════════════════════════════
-- VALIDATION FINALE SPRINT P1 — À EXÉCUTER APRÈS LES 4 MIGRATIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Requête de cohérence globale (doit retourner 0 anomalies sur chaque ligne) :

-- SELECT 'TVA_441_RESIDUEL' AS controle,
--   COUNT(*) AS anomalies
-- FROM journal_entries
-- WHERE credit_account IN ('441','441000')
--   AND source != 'manuel'
-- UNION ALL
-- SELECT 'PAIE_641_644_RESIDUEL',
--   COUNT(*) FROM journal_entries
-- WHERE debit_account IN ('641','644')
--   AND source IN ('paie_accrual','paie_cnss')
-- UNION ALL
-- SELECT 'TRESORERIE_6CHIFFRES_RESIDUEL',
--   COUNT(*) FROM journal_entries
-- WHERE LENGTH(debit_account) = 6
--   AND debit_account NOT IN ('571100','571200')
--   AND source != 'manuel'
-- UNION ALL
-- SELECT 'TVA_4441_PRESENT',
--   COUNT(*) FROM journal_entries
-- WHERE credit_account = '4441';
-- → Ligne 1 : 0  (plus aucun 441 résiduel)
-- → Ligne 2 : 0  (plus aucun 641/644 paie)
-- → Ligne 3 : 0  (plus aucun code 6 chiffres sauf 571100/571200 legacy)
-- → Ligne 4 : > 0 (4441 bien présent)
