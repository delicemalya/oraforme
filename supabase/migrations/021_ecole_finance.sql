-- ============================================================
-- Migration 021 : Intégration financière école + corrections
-- ============================================================

-- Add source tracking to transactions table.
-- Required by: restaurant purchases (source='achat_resto')
--              school payments    (source='paiement_scolaire')
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source    TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_source
  ON transactions(tenant_id, source)
  WHERE source IS NOT NULL;
