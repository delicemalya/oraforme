-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 153 — Corriger type_entite AMD FINANCE (champ réel lu par le code)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE :
--   La migration 152 corrigeait type_tenant (mauvais champ). Le frontend lit
--   type_entite. De plus, la contrainte tenants_groupe_sans_parent empêche
--   type_entite='groupe' quand parent_tenant_id IS NOT NULL.
--   AMD FINANCE est la société propre du compte (pas une filiale), donc
--   parent_tenant_id doit être NULL avant de mettre type_entite='groupe'.
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (production)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── ÉTAPE 1 : Diagnostic — exécuter seul d'abord, lire les résultats ──────────
SELECT
  id,
  nom_entreprise,
  type_entite,
  type_tenant,
  taille_entreprise,
  plan,
  parent_tenant_id
FROM tenants
WHERE nom_entreprise ILIKE '%amd%'
ORDER BY created_at DESC;

-- ── ÉTAPE 2 : Correction — exécuter après avoir vérifié l'étape 1 ─────────────
--
-- Contrainte tenants_groupe_sans_parent :
--   CHECK (type_entite != 'groupe' OR parent_tenant_id IS NULL)
-- AMD FINANCE est la société mère (pas une filiale), on efface parent_tenant_id
-- et on corrige les deux champs type_entite + type_tenant.
--
UPDATE tenants
SET
  parent_tenant_id = NULL,
  type_entite      = 'groupe',
  type_tenant      = 'groupe',
  taille_entreprise = 'grande'
WHERE nom_entreprise ILIKE '%amd%';

-- ── ÉTAPE 3 : Vérification post-correction ─────────────────────────────────────
SELECT
  id,
  nom_entreprise,
  type_entite,
  type_tenant,
  taille_entreprise,
  parent_tenant_id
FROM tenants
WHERE nom_entreprise ILIKE '%amd%';
