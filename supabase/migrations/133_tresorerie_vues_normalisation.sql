-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 133 — Trésorerie : corriger vues et fonction de resync
-- Objectif : vue_tresorerie_unifiee et fn_sync_tresorerie_soldes requêtaient
--            des codes 6 chiffres (521000, 571000, 512000) absents de la base
--            après normalisation → soldes retournés à zéro (BUG-TX-02)
-- Prérequis : migration 132 appliquée
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION AVANT — À EXÉCUTER AVANT LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Vérifier les codes trésorerie actuellement en base
-- SELECT 'AVANT_133' AS etape, debit_account AS compte, COUNT(*) AS nb
-- FROM journal_entries
-- WHERE debit_account IN (
--   '521000','571000','571100','571200','512000',
--   '521','571','512','5711','5712'
-- )
-- GROUP BY debit_account ORDER BY debit_account;

-- 2. Vérifier l'état actuel de la vue (probablement soldes à 0 ou manquants)
-- SELECT * FROM vue_tresorerie_unifiee LIMIT 20;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION — À EXÉCUTER
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Recréer vue_tresorerie_unifiee avec codes normalisés + codes legacy
--    Couvre : 521 (banque), 571 (caisse), 571100/5711 (Airtel), 571200/5712 (MTN), 512 (chèques)
--    La double liste gère la coexistence avant/après migration 135
CREATE OR REPLACE VIEW vue_tresorerie_unifiee AS
WITH mouvements AS (
  SELECT tenant_id, debit_account AS compte,
         SUM(montant) AS debits, 0::NUMERIC AS credits
  FROM journal_entries
  WHERE debit_account IN ('521','571','571100','571200','512','5711','5712')
  GROUP BY tenant_id, debit_account
  UNION ALL
  SELECT tenant_id, credit_account AS compte,
         0::NUMERIC AS debits, SUM(montant) AS credits
  FROM journal_entries
  WHERE credit_account IN ('521','571','571100','571200','512','5711','5712')
  GROUP BY tenant_id, credit_account
)
SELECT
  m.tenant_id,
  m.compte,
  COALESCE(coa.account_name, m.compte) AS libelle,
  SUM(m.debits)                         AS total_entrees,
  SUM(m.credits)                        AS total_sorties,
  SUM(m.debits) - SUM(m.credits)        AS solde_journal
FROM mouvements m
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = m.compte
 AND (coa.tenant_id = m.tenant_id OR coa.tenant_id IS NULL)
GROUP BY m.tenant_id, m.compte, coa.account_name
ORDER BY m.tenant_id, m.compte;

-- 2. Corriger fn_sync_tresorerie_soldes
--    Remplacer les codes 6 chiffres par les codes normalisés 3-4 chiffres
--    Couvre aussi le cas où compte_ohada du wallet est encore en 6 chiffres (571100)
CREATE OR REPLACE FUNCTION fn_sync_tresorerie_soldes(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Comptes bancaires : '521' (normalisé depuis 521000 via trigger)
  UPDATE comptes_bancaires cb
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = '521' THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = '521' THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE cb.tenant_id = p_tenant_id;

  -- Caisses : '571' (normalisé depuis 571000)
  -- numero_compte peut être '571' ou une valeur custom — les deux sont pris en compte
  UPDATE caisses ca
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE ca.tenant_id = p_tenant_id;

  -- Mobile money wallets : compte_ohada peut être '571100'/'5711' ou '571200'/'5712'
  -- Les deux formats coexistent (anciens = 571100/571200, nouveaux post-135 = 5711/5712)
  UPDATE mobile_money_wallets mm
  SET solde_actuel = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account IN (
                mm.compte_ohada,
                CASE mm.compte_ohada WHEN '571100' THEN '5711'
                                     WHEN '571200' THEN '5712'
                                     WHEN '5711'   THEN '571100'
                                     WHEN '5712'   THEN '571200'
                                     ELSE mm.compte_ohada END
              ) THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account IN (
                mm.compte_ohada,
                CASE mm.compte_ohada WHEN '571100' THEN '5711'
                                     WHEN '571200' THEN '5712'
                                     WHEN '5711'   THEN '571100'
                                     WHEN '5712'   THEN '571200'
                                     ELSE mm.compte_ohada END
              ) THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE mm.tenant_id = p_tenant_id;
END;
$$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION APRÈS — À EXÉCUTER APRÈS LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. La vue doit retourner des soldes non nuls pour les tenants actifs
-- SELECT 'APRES_133_VUE' AS etape, * FROM vue_tresorerie_unifiee
-- WHERE solde_journal != 0 LIMIT 20;

-- 2. Vérification de couverture : toutes les entrées trésorerie sont capturées
-- SELECT
--   'COUVERTURE_133' AS controle,
--   SUM(CASE WHEN debit_account IN ('521','571','571100','571200','512','5711','5712')
--       THEN montant ELSE 0 END) AS capturees_par_vue,
--   SUM(montant) AS total_ecritures_tresorerie
-- FROM journal_entries
-- WHERE debit_account IN ('521','571','571100','571200','512','5711','5712',
--                         '521000','571000','512000');
-- → capturees_par_vue doit = total_ecritures_tresorerie si aucun 6-chiffres résiduel

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ══════════════════════════════════════════════════════════════════════════════

-- Restaurer vue_tresorerie_unifiee version migration 046 :
-- CREATE OR REPLACE VIEW vue_tresorerie_unifiee AS
-- WITH mouvements AS (
--   SELECT tenant_id, debit_account  AS compte, SUM(montant) AS debits, 0::NUMERIC AS credits
--   FROM journal_entries
--   WHERE debit_account IN ('521000','571000','571100','571200','512000')
--   GROUP BY tenant_id, debit_account
--   UNION ALL
--   SELECT tenant_id, credit_account AS compte, 0::NUMERIC AS debits, SUM(montant) AS credits
--   FROM journal_entries
--   WHERE credit_account IN ('521000','571000','571100','571200','512000')
--   GROUP BY tenant_id, credit_account
-- )
-- SELECT m.tenant_id, m.compte, COALESCE(coa.account_name, m.compte) AS libelle,
--   SUM(m.debits) AS total_entrees, SUM(m.credits) AS total_sorties,
--   SUM(m.debits) - SUM(m.credits) AS solde_journal
-- FROM mouvements m
-- LEFT JOIN chart_of_accounts coa
--   ON coa.account_number = m.compte AND (coa.tenant_id = m.tenant_id OR coa.tenant_id IS NULL)
-- GROUP BY m.tenant_id, m.compte, coa.account_name ORDER BY m.tenant_id, m.compte;
--
-- Restaurer fn_sync_tresorerie_soldes version migration 046 (requêtes en 521000, 571000)
