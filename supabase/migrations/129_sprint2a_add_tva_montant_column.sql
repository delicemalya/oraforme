-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 129 — Sprint 2A : Ajouter colonne tva_montant sur factures et devis
-- ─────────────────────────────────────────────────────────────────────────────
-- tva_montant était ajouté par migration 046 (ligne 72) mais celle-ci n'est pas
-- appliquée en production. Cette migration ajoute uniquement la colonne,
-- sans toucher aux triggers ni aux autres changements de 046.
--
-- Ordre d'exécution :
--   1. Migration 129 (cette migration) — ajouter les colonnes
--   2. Migration 128  — backfill tva_montant = tva sur les lignes existantes
-- ─────────────────────────────────────────────────────────────────────────────

-- Colonne sur factures (déjà dans 046 mais 046 non appliqué)
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS tva_montant NUMERIC(14,2) DEFAULT 0;

-- Colonne sur devis (058 ne l'inclut pas)
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS tva_montant NUMERIC(14,2) DEFAULT 0;

DO $$
BEGIN
  RAISE NOTICE 'Migration 129 OK — tva_montant ajouté sur factures et devis';
END $$;
