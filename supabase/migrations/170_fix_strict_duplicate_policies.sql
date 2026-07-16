-- Migration 170 — Fix advisor performance WARN "multiple_permissive_policies" (sous-ensemble sûr)
--
-- Contexte : l'advisor signale ~344 cas de policies permissives multiples
-- pour un même rôle/action sur une même table (Postgres évalue TOUTES les
-- policies permissives applicables et les combine en OR, au lieu d'une
-- seule évaluation). La grande majorité de ces 344 cas correspond à des
-- policies FONCTIONNELLEMENT DIFFÉRENTES qui se recoupent légitimement
-- (ex: une policy "owner" + une policy "membre" sur le même SELECT) —
-- les fusionner exige une revue au cas par cas, hors scope de cette
-- migration automatisée.
--
-- Cette migration ne traite QUE le sous-ensemble sûr : les paires de
-- policies STRICTEMENT IDENTIQUES (même table, même cmd, même rôles,
-- même qual, même with_check — vérifié par GROUP BY exact sur ces 5
-- colonnes dans pg_policies) — de purs doublons de nommage créés à des
-- moments différents de l'historique des migrations, sans aucune
-- différence de logique. 7 paires identifiées, une policy conservée par
-- paire (celle dont le nom est le plus explicite/complet), l'autre
-- supprimée.

DROP POLICY IF EXISTS "cost_centers: tenant read"    ON cost_centers;
DROP POLICY IF EXISTS "ecole_wallet_mvt: all"          ON ecole_wallet_movements;
DROP POLICY IF EXISTS "fiscal_years: tenant read"      ON fiscal_years;
DROP POLICY IF EXISTS "tenant_own"                     ON miaa_notifications;
DROP POLICY IF EXISTS "tenant_own"                     ON miaa_rapports;
DROP POLICY IF EXISTS "profiles_insert"                ON profiles;
DROP POLICY IF EXISTS "tenants_insert"                 ON tenants;

DO $$
BEGIN
  RAISE NOTICE 'Migration 170 OK — 7 policies dupliquées strictes supprimées';
END $$;
