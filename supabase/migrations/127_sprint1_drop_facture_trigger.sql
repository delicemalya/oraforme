-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 127 — Sprint 1 : Suppression trg_facture_to_transaction (031)
-- ─────────────────────────────────────────────────────────────────────────────
-- Problème : fn_facture_to_transaction (migration 031) insère dans transactions
-- quand statut → 'payee', en doublon de fn_facture_paid_to_journal (046).
-- La migration 046 n'a pas supprimé ce trigger → double écriture transactions.
--
-- Doublons pour une facture payée AVANT ce fix :
--   1. trg_facture_to_transaction (031) → transactions (source='factures')
--   2. fn_facture_paid_to_journal (046)  → transactions (source='factures_paiement')
--      + trg_auto_journal_entry (026)    → journal_entries (déjà supprimé en 124)
--
-- Après ce fix : seul fn_facture_paid_to_journal (046) écrit dans transactions.
-- fn_facture_paid_to_journal a sa propre garde idempotente (source='factures_paiement').
--
-- Note : fn_facture_to_transaction utilise la colonne 'date_operation' qui
-- n'existe pas dans transactions (migration 014 définit 'date') → les inserts
-- de ce trigger échouent silencieusement ou créent des NULL selon la version.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER  IF EXISTS trg_facture_to_transaction ON factures;
DROP FUNCTION IF EXISTS fn_facture_to_transaction();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_facture_to_transaction'
  ) THEN
    RAISE EXCEPTION 'Echec : trg_facture_to_transaction existe encore';
  END IF;
  RAISE NOTICE 'Migration 127 OK — trg_facture_to_transaction supprimé';
END $$;
