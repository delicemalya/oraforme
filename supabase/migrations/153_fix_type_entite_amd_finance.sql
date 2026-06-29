-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 153 — Corriger type_entite AMD FINANCE (champ réel lu par le code)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE :
--   La migration 152 avait tenté de corriger le champ `type_tenant` mais le
--   code TypeScript (TenantContext.tsx, EntitySwitcher.tsx) lit `type_entite`.
--   Ce sont deux colonnes distinctes. AMD FINANCE affichait "Société" car
--   `type_entite` restait à 'societe'/'standalone'.
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (production)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Diagnostic avant correction ─────────────────────────────────────────────
SELECT
  id,
  nom_entreprise,
  type_entite,
  type_tenant,
  taille_entreprise,
  plan
FROM tenants
WHERE nom_entreprise ILIKE '%amd%'
ORDER BY created_at DESC;

-- ── 2. Correction : type_entite → 'groupe' pour AMD FINANCE ───────────────────
--
-- Le compte AMD FINANCE a été créé avec le plan "Compagnie" (grande entreprise),
-- donc type_entite doit être 'groupe' pour que :
--   - L'EntitySwitcher affiche "Groupe" (pas "Société")
--   - La navigation "Vue Groupe" soit disponible
--   - Les modules Groupe soient accessibles
--
UPDATE tenants
SET
  type_entite = 'groupe',
  type_tenant = 'groupe'  -- harmonisation des deux champs
WHERE nom_entreprise ILIKE '%amd%'
  AND type_entite NOT IN ('groupe');

-- ── 3. Vérification post-correction ────────────────────────────────────────────
SELECT
  id,
  nom_entreprise,
  type_entite,
  type_tenant,
  taille_entreprise
FROM tenants
WHERE nom_entreprise ILIKE '%amd%';
