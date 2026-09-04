-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 178 — Trésorerie : compte bancaire/caisse principal, fin du triplement
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-002 · résidu P0-04 (« Résidu relevé sur 133 ») · docs/REPAIR-LOG.md
--
-- CONTEXTE
--   fn_sync_tresorerie_soldes(tenant) (migrations 046, corrigée en 133) affecte
--   à CHAQUE comptes_bancaires/caisses d'un tenant la somme TOTALE des
--   mouvements '521'/'571' du tenant — il n'existe aucune notion de compte
--   bancaire précis dans le moteur comptable (fn_ae_resolve_treasury ne résout
--   qu'un code de classe OHADA générique depuis le moyen de paiement). Un
--   tenant à plusieurs comptes voit donc le même solde total dupliqué sur
--   chacun. Diagnostiqué pour AMD FINANCE (b93b7c3d-815b-4336-bbb2-ac24cda0edb2,
--   2026-09-04) : 3 comptes bancaires à 314 488 246 F chacun (au lieu d'un seul
--   compte réel à ce montant), 1 caisse (pas concernée, un seul compte).
--
--   Vraie ventilation par compte impossible sans historique (aucune donnée ne
--   permet de savoir rétroactivement à quel compte physique une écriture
--   '521' générique appartenait) et hors périmètre choisi : on désigne UN
--   compte principal par tenant, seul suivi automatiquement par le moteur ;
--   les autres redeviennent manuels (page Trésorerie › Banques, bouton
--   « Modifier solde », déjà existant).
--
--   Compte principal choisi pour AMD FINANCE, sur confirmation utilisateur
--   (2026-09-04) : LCB Congo — Compte courant LCB (521002), id
--   9823195f-4eff-4eeb-912c-547a54cc8a3b. BGFI (exploitation, 521001) et
--   BOCEC (épargne, 521003) repassent à 0, à ressaisir manuellement si leur
--   solde réel diffère.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fou : état diagnostiqué le 2026-09-04 pour AMD FINANCE
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM comptes_bancaires
  WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
    AND id IN ('c1df75b5-1cf6-416b-b951-d99f4022c548',
               '9823195f-4eff-4eeb-912c-547a54cc8a3b',
               '760466a6-0bee-47ff-9c90-561e1fe677ba')
    AND solde = 314488246.00;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Attendu 3 comptes AMD FINANCE à 314 488 246 F, trouvé % — état différent du diagnostic du 2026-09-04', n;
  END IF;
END $$;

-- 1. Colonne compte_principal (un seul compte par tenant suivi par le moteur)
ALTER TABLE comptes_bancaires ADD COLUMN IF NOT EXISTS compte_principal boolean NOT NULL DEFAULT false;
ALTER TABLE caisses           ADD COLUMN IF NOT EXISTS compte_principal boolean NOT NULL DEFAULT false;

-- 2. AMD FINANCE — choix explicite validé par l'utilisateur
UPDATE comptes_bancaires
SET    compte_principal = true
WHERE  id = '9823195f-4eff-4eeb-912c-547a54cc8a3b';

-- 3. Tous les autres tenants — backfill par défaut (compte actif le plus
--    ancien). Les tenants à un seul compte marquent trivialement leur unique
--    ligne ; pas d'effet pratique pour eux (déjà correct). À ajuster tenant
--    par tenant si besoin via UPDATE ... SET compte_principal = true.
WITH ranked_cb AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY actif DESC, created_at ASC, id ASC) AS rn
  FROM   comptes_bancaires
)
UPDATE comptes_bancaires cb
SET    compte_principal = true
FROM   ranked_cb r
WHERE  cb.id = r.id AND r.rn = 1
  AND  NOT EXISTS (
         SELECT 1 FROM comptes_bancaires x
         WHERE x.tenant_id = cb.tenant_id AND x.compte_principal
       );

WITH ranked_ca AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY actif DESC, created_at ASC, id ASC) AS rn
  FROM   caisses
)
UPDATE caisses ca
SET    compte_principal = true
FROM   ranked_ca r
WHERE  ca.id = r.id AND r.rn = 1
  AND  NOT EXISTS (
         SELECT 1 FROM caisses x
         WHERE x.tenant_id = ca.tenant_id AND x.compte_principal
       );

-- 4. Un seul compte principal par tenant (garde-fou permanent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_comptes_bancaires_principal_unique
  ON comptes_bancaires (tenant_id) WHERE compte_principal;
CREATE UNIQUE INDEX IF NOT EXISTS idx_caisses_principal_unique
  ON caisses (tenant_id) WHERE compte_principal;

-- 5. fn_sync_tresorerie_soldes ne met plus à jour que le compte principal.
--    Wallets mobile money inchangés : compte_ohada distingue déjà chaque
--    wallet (5711 Airtel / 5712 MTN), pas de collision constatée.
CREATE OR REPLACE FUNCTION fn_sync_tresorerie_soldes(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE comptes_bancaires cb
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = '521' THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = '521' THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE cb.tenant_id = p_tenant_id AND cb.compte_principal;

  UPDATE caisses ca
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE ca.tenant_id = p_tenant_id AND ca.compte_principal;

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

-- 6. Nettoyage AMD FINANCE : les 2 comptes non retenus portaient la même
--    valeur triplée par l'ancien fn_sync_tresorerie_soldes, pas un solde réel
--    saisi manuellement (confirmé par le diagnostic du 2026-09-04) — remis à
--    0, à ressaisir via Trésorerie › Banques si leur solde réel diffère.
UPDATE comptes_bancaires
SET    solde = 0
WHERE  id IN ('c1df75b5-1cf6-416b-b951-d99f4022c548',
              '760466a6-0bee-47ff-9c90-561e1fe677ba');

-- 7. Resynchroniser le compte principal AMD FINANCE avec la fonction corrigée
SELECT fn_sync_tresorerie_soldes('b93b7c3d-815b-4336-bbb2-ac24cda0edb2'::uuid);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (une seule instruction, lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT '1_amd_finance_comptes' AS section,
         banque || ' — ' || intitule AS cle,
         'principal=' || compte_principal::text || ' · solde=' || solde::text
  FROM   comptes_bancaires WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '2_tenants_sans_principal_comptes', 'comptes_bancaires',
         count(DISTINCT tenant_id)::text
  FROM   comptes_bancaires cb
  WHERE  NOT EXISTS (SELECT 1 FROM comptes_bancaires x WHERE x.tenant_id = cb.tenant_id AND x.compte_principal)
  UNION ALL
  SELECT '3_tenants_sans_principal_caisses', 'caisses',
         count(DISTINCT tenant_id)::text
  FROM   caisses ca
  WHERE  NOT EXISTS (SELECT 1 FROM caisses x WHERE x.tenant_id = ca.tenant_id AND x.compte_principal)
) d ORDER BY section, cle;

-- Attendu :
--   1_amd_finance_comptes   BGFI/BOCEC → principal=false · solde=0
--                            LCB        → principal=true  · solde=314488246 (recalculé, inchangé)
--   2/3_tenants_sans_principal   0 (tout tenant avec ≥1 compte a désormais un principal)

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE (ne pas exécuter sauf besoin)
-- ═════════════════════════════════════════════════════════════════════════════
-- UPDATE comptes_bancaires SET solde = 314488246.00
--   WHERE id IN ('c1df75b5-1cf6-416b-b951-d99f4022c548','760466a6-0bee-47ff-9c90-561e1fe677ba');
-- ALTER TABLE comptes_bancaires DROP COLUMN compte_principal;
-- ALTER TABLE caisses           DROP COLUMN compte_principal;
-- Restaurer fn_sync_tresorerie_soldes version migration 133 (sans filtre compte_principal).
