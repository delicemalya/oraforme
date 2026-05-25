-- =============================================================================
-- MIGRATION 051: STOCKS — Modules complémentaires
-- Tables: stock_transferts, unit_conversions
-- Complète les 19 modules du système stock enterprise
-- =============================================================================

-- ============================================================
-- 1. STOCK TRANSFERTS (Transferts inter-entrepôts)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transferts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero                   TEXT NOT NULL,
  source_warehouse_id      UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id               UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantite                 NUMERIC(12,2) NOT NULL CHECK (quantite > 0),
  statut                   TEXT NOT NULL DEFAULT 'validé'
                           CHECK (statut IN ('en_attente','validé','annulé')),
  motif                    TEXT,
  notes                    TEXT,
  date_transfert           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_transferts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_transferts" ON stock_transferts
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_stock_transferts_tenant  ON stock_transferts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transferts_source  ON stock_transferts(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transferts_dest    ON stock_transferts(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transferts_product ON stock_transferts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transferts_date    ON stock_transferts(date_transfert);
CREATE INDEX IF NOT EXISTS idx_stock_transferts_statut  ON stock_transferts(statut);

-- ============================================================
-- 2. UNIT CONVERSIONS (Multi-unités)
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_conversions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unite_source TEXT NOT NULL,
  unite_cible  TEXT NOT NULL,
  facteur      NUMERIC(18,6) NOT NULL CHECK (facteur > 0),
  categorie    TEXT NOT NULL DEFAULT 'quantite'
               CHECK (categorie IN ('masse','volume','longueur','surface','quantite','temps','personnalise')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, unite_source, unite_cible)
);

ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_unit_conversions" ON unit_conversions
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_unit_conversions_tenant ON unit_conversions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unit_conversions_source ON unit_conversions(unite_source);

-- ============================================================
-- 3. Contrainte de type stock_movements (idempotente)
-- Au cas où la migration 050 n'a pas pu s'exécuter complètement
-- ============================================================
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('entree','sortie','ajustement','transfert','reception','retour'));

-- ============================================================
-- FIN DE LA MIGRATION 051
-- ============================================================
