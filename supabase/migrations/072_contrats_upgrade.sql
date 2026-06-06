-- ============================================================
-- Migration 072 — Contrats table upgrade
-- Oraforme ERP · Congo-Brazzaville
-- Date: 2026-06-06
--
-- Changements :
--   - Ajout types 'vacation' et 'apprentissage' dans type_contrat
--   - Ajout statuts 'expire', 'resilie', 'brouillon' dans statut
--   - Nouvelles colonnes : avantages, signe_employe, signe_employeur,
--     notes, updated_at, created_by, contrat_precedent_id
--   - Trigger updated_at
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. Étendre les CHECK constraints
-- ─────────────────────────────────────────────────────────
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS contrats_type_contrat_check;
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS contrats_statut_check;

ALTER TABLE contrats
  ADD CONSTRAINT contrats_type_contrat_check
    CHECK (type_contrat IN ('cdi', 'cdd', 'stage', 'freelance', 'vacation', 'apprentissage'));

ALTER TABLE contrats
  ADD CONSTRAINT contrats_statut_check
    CHECK (statut IN ('actif', 'termine', 'suspendu', 'expire', 'resilie', 'brouillon'));

-- ─────────────────────────────────────────────────────────
-- 2. Nouvelles colonnes
-- ─────────────────────────────────────────────────────────
ALTER TABLE contrats
  ADD COLUMN IF NOT EXISTS avantages            JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signe_employe        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS signe_employeur      BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by           UUID,
  ADD COLUMN IF NOT EXISTS contrat_precedent_id UUID         REFERENCES contrats(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────
-- 3. Trigger updated_at
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_contrats_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrats_updated_at ON contrats;
CREATE TRIGGER trg_contrats_updated_at
  BEFORE UPDATE ON contrats
  FOR EACH ROW EXECUTE FUNCTION update_contrats_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. Grants
-- ─────────────────────────────────────────────────────────
GRANT ALL ON contrats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON contrats TO authenticated;

-- ─────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION 072
-- À exécuter dans Supabase SQL Editor
-- ─────────────────────────────────────────────────────────
