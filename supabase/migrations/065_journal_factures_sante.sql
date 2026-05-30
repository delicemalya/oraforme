-- =============================================================================
-- Migration 065 : Journal Entries — piece_number + API Santé + Factures OHADA
-- Auteur       : Oraforme ERP
-- Date         : 2026-05-30
-- Idempotente  : IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- =============================================================================

-- =============================================================================
-- 1. JOURNAL ENTRIES — Ajouter colonne piece_number
--    Permet de lier une écriture au numéro de pièce comptable (N° facture,
--    N° chèque, N° virement, etc.) pour faciliter le rapprochement.
-- =============================================================================

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS piece_number TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_entries_piece
  ON journal_entries(tenant_id, piece_number)
  WHERE piece_number IS NOT NULL;

-- =============================================================================
-- 2. JOURNAL ENTRIES — Index composite source + tenant (pour déduplication)
--    Utilisé par les routes API /api/factures/[id] pour éviter les doublons
--    d'écritures OHADA quand une facture est marquée payée.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_source
  ON journal_entries(tenant_id, source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- =============================================================================
-- 3. TRANSACTIONS — Index sur source_id pour déduplication
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_source_id
  ON transactions(tenant_id, source_id)
  WHERE source_id IS NOT NULL;

-- =============================================================================
-- 4. CLINIQUE PATIENTS — Index texte pour recherche full-text rapide
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_clinique_pat_search
  ON clinique_patients(tenant_id, nom, prenom, actif);

-- =============================================================================
-- 5. CLINIQUE CONSULTATIONS — Index pour vue par patient
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_clinique_cons_patient
  ON clinique_consultations(tenant_id, patient_id, date_consult DESC);

-- =============================================================================
-- 6. CLINIQUE RDV — Index par statut pour le calendrier
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_clinique_rdv_statut
  ON clinique_rdv(tenant_id, statut, date_heure);

-- =============================================================================
-- 7. RLS : Politiques pour supabaseAdmin (pas de bypass — les API utilisent
--    tenant_id explicite dans chaque requête)
--    Aucune politique supplémentaire n'est nécessaire car :
--    - journal_entries : politiques SELECT/INSERT existantes (migration 026)
--    - clinique_* : politiques existantes (migration 061)
--    - transactions : politiques existantes (migration 014)
-- =============================================================================

-- Fin de migration
