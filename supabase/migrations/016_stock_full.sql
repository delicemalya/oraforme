-- ============================================================
-- 016 : Stock & Inventaire complet
-- Tables : products, warehouses, stock_movements, suppliers,
--          purchases, purchase_items
-- Fonction : get_product_stock(UUID)
-- ============================================================

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  categorie    TEXT,
  sku          TEXT,
  code_barre   TEXT,
  unite        TEXT NOT NULL DEFAULT 'pièce',
  prix_achat   NUMERIC(12,2) NOT NULL DEFAULT 0,
  prix_vente   NUMERIC(12,2) NOT NULL DEFAULT 0,
  seuil_alerte NUMERIC(12,3) NOT NULL DEFAULT 0,
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

-- ── Warehouses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  localisation TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Stock Movements ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  quantite     NUMERIC(12,3) NOT NULL,
  reference    TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Suppliers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  telephone  TEXT,
  email      TEXT,
  adresse    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Purchases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  montant_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut        TEXT NOT NULL DEFAULT 'reçu' CHECK (statut IN ('commande', 'reçu', 'annule')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Purchase Items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantite    NUMERIC(12,3) NOT NULL,
  prix        NUMERIC(12,2) NOT NULL
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_tenant        ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant      ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant       ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant       ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purch   ON purchase_items(purchase_id);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items   ENABLE ROW LEVEL SECURITY;

-- Products
CREATE POLICY "products: select" ON products FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "products: insert" ON products FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "products: update" ON products FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "products: delete" ON products FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Warehouses
CREATE POLICY "warehouses: select" ON warehouses FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "warehouses: insert" ON warehouses FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "warehouses: update" ON warehouses FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "warehouses: delete" ON warehouses FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Stock movements
CREATE POLICY "stock_movements: select" ON stock_movements FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "stock_movements: insert" ON stock_movements FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Suppliers
CREATE POLICY "suppliers: select" ON suppliers FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "suppliers: insert" ON suppliers FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "suppliers: update" ON suppliers FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "suppliers: delete" ON suppliers FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Purchases
CREATE POLICY "purchases: select" ON purchases FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "purchases: insert" ON purchases FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "purchases: update" ON purchases FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- Purchase items (via parent purchase)
CREATE POLICY "purchase_items: select" ON purchase_items FOR SELECT
  USING (purchase_id IN (SELECT id FROM purchases WHERE tenant_id = get_my_tenant_id()));
CREATE POLICY "purchase_items: insert" ON purchase_items FOR INSERT
  WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE tenant_id = get_my_tenant_id()));

-- ── Stock computation function ───────────────────────────────
CREATE OR REPLACE FUNCTION get_product_stock(p_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type = 'IN'         THEN  quantite
      WHEN type = 'OUT'        THEN -quantite
      WHEN type = 'ADJUSTMENT' THEN  quantite
      ELSE 0
    END
  ), 0)
  FROM stock_movements
  WHERE product_id = p_id;
$$;
