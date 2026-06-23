-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 128 — Sprint 2A : Backfill factures.tva_montant
-- ─────────────────────────────────────────────────────────────────────────────
-- Problème : la colonne tva_montant (ajoutée par migration 046) n'a jamais été
-- peuplée par aucune route API. Les factures historiques ont tva_montant = 0
-- alors que tva > 0. Le trigger fn_facture_issued_to_journal lit tva_montant
-- pour créer l'écriture OHADA 441 (TVA collectée) — elle n'a donc jamais été
-- créée pour aucune facture existante.
--
-- Cette migration synchronise tva_montant = tva pour toutes les factures
-- historiques concernées.
--
-- Note : ce backfill ne déclenche PAS les triggers (AFTER UPDATE OF statut) —
-- les JE historiques manquantes ne sont pas recréées. Seules les nouvelles
-- factures créées après Sprint 2A auront leur écriture 441.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE factures
SET tva_montant = tva
WHERE tva > 0
  AND (tva_montant IS NULL OR tva_montant = 0);

DO $$
DECLARE v_updated INT;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Migration 128 OK — % factures backfillées (tva_montant = tva)', v_updated;

  -- Vérification résiduelle
  PERFORM 1 FROM factures
  WHERE tva > 0 AND (tva_montant IS NULL OR tva_montant = 0)
  LIMIT 1;

  IF FOUND THEN
    RAISE WARNING 'Des factures avec tva>0 et tva_montant=0 subsistent — vérifier';
  END IF;
END $$;

COMMIT;
