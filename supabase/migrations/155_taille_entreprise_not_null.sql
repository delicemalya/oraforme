-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 155 — taille_entreprise NOT NULL + backfill
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLÈME :
--   taille_entreprise peut être NULL dans tenants.
--   lib/plan-access.ts applique `taille ?? 'tpe'` silencieusement →
--   un tenant Compagnie avec taille NULL perd tous ses modules avancés.
--
-- CAUSE :
--   1. api/admin/tenant/create ne renseignait pas taille_entreprise (corrigé en 155)
--   2. La colonne n'avait pas de contrainte NOT NULL ni de valeur par défaut
--
-- ACTIONS :
--   A. Backfill : déduire taille_entreprise depuis la colonne plan existante
--   B. Contrainte CHECK sur les 3 valeurs autorisées
--   C. DEFAULT 'tpe' + NOT NULL
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (production)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── A. Backfill — dériver taille depuis plan pour les tenants existants ────────
UPDATE tenants
SET taille_entreprise = CASE
  WHEN plan IN ('grande', 'enterprise', 'compagnie') THEN 'grande'
  WHEN plan IN ('pme', 'pro', 'business')            THEN 'pme'
  ELSE                                                    'tpe'
END
WHERE taille_entreprise IS NULL;

-- ── B. Contrainte CHECK ────────────────────────────────────────────────────────
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_taille_entreprise_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_taille_entreprise_check
  CHECK (taille_entreprise IN ('tpe', 'pme', 'grande'));

-- ── C. DEFAULT + NOT NULL ─────────────────────────────────────────────────────
ALTER TABLE tenants
  ALTER COLUMN taille_entreprise SET DEFAULT 'tpe';

ALTER TABLE tenants
  ALTER COLUMN taille_entreprise SET NOT NULL;

-- ── Vérification ──────────────────────────────────────────────────────────────
-- Après exécution, ce SELECT doit retourner 0 lignes :
-- SELECT id, nom_entreprise, taille_entreprise FROM tenants WHERE taille_entreprise IS NULL;
