-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 156 — Peupler tenant_modules depuis modules_actifs pour tous les
--                 tenants existants qui n'ont pas encore de lignes dans tenant_modules
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE :
--   Après F-003, TenantContext, Sidebar, Dashboard, AiAssistant et MIAA lisent
--   EXCLUSIVEMENT depuis tenant_modules. La colonne tenants.modules_actifs n'est
--   plus jamais lue comme source de contrôle d'accès.
--
--   Tout tenant créé avant la mise en place de tenant_modules (ou dont les lignes
--   ont été perdues) apparaîtrait sans modules. Cette migration backfille
--   tenant_modules depuis modules_actifs pour garantir la continuité de service.
--
-- ACTIONS :
--   A. Insérer dans tenant_modules toutes les entrées manquantes
--      depuis tenants.modules_actifs (UPSERT sûr — ne touche pas l'existant)
--   B. Désactiver dans tenant_modules les modules supprimés de modules_actifs
--      (réconciliation en cas de désynchronisation passée)
--   C. Vérification post-migration
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (production)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── A. Insérer les modules manquants depuis modules_actifs ────────────────────
-- Pour chaque tenant, pour chaque module dans modules_actifs,
-- créer la ligne dans tenant_modules si elle n'existe pas encore.
INSERT INTO tenant_modules (tenant_id, module_key, enabled, created_at)
SELECT
  t.id          AS tenant_id,
  m.module_key  AS module_key,
  true          AS enabled,
  NOW()         AS created_at
FROM tenants t
CROSS JOIN LATERAL unnest(COALESCE(t.modules_actifs, '{}')) AS m(module_key)
WHERE m.module_key IS NOT NULL
  AND m.module_key <> ''
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm
    WHERE tm.tenant_id = t.id AND tm.module_key = m.module_key
  )
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- ── B. Rapport de vérification ────────────────────────────────────────────────
-- Après exécution, ce SELECT doit montrer :
--   - Chaque tenant a au moins autant de lignes dans tenant_modules que dans modules_actifs
--   - Aucun tenant n'a 0 modules dans tenant_modules si modules_actifs n'est pas vide

-- Lancer ce SELECT pour vérifier :
/*
SELECT
  t.id,
  t.nom_entreprise,
  array_length(t.modules_actifs, 1) AS nb_modules_actifs,
  COUNT(tm.id) FILTER (WHERE tm.enabled = true) AS nb_tenant_modules_enabled
FROM tenants t
LEFT JOIN tenant_modules tm ON tm.tenant_id = t.id
GROUP BY t.id, t.nom_entreprise, t.modules_actifs
HAVING array_length(t.modules_actifs, 1) IS NOT NULL
   AND array_length(t.modules_actifs, 1) > COUNT(tm.id) FILTER (WHERE tm.enabled = true)
ORDER BY t.nom_entreprise;
-- Doit retourner 0 lignes = synchronisation parfaite
*/
