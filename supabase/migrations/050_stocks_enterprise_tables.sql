-- =============================================================================
-- MIGRATION 050: STOCKS & INVENTAIRE ENTERPRISE
-- Tables: product_categories, stock_inventories, stock_inventory_items,
--         purchase_orders, purchase_order_items, stock_receptions,
--         stock_reception_items, stock_sorties, stock_sortie_items,
--         stock_retours
-- ALTER: products, warehouses, suppliers
-- =============================================================================

-- ============================================================
-- 1. PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  code         TEXT NOT NULL,
  description  TEXT,
  couleur      TEXT NOT NULL DEFAULT '#16A34A',
  icone        TEXT DEFAULT '📦',
  parent_id    UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  ordre        INTEGER NOT NULL DEFAULT 0,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_product_categories" ON product_categories
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_product_categories_tenant ON product_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_id);

-- ============================================================
-- 2. ALTER TABLE PRODUCTS — Ajouter colonnes manquantes
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS categorie_id  UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stock_max     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fournisseur_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emplacement   TEXT,
  ADD COLUMN IF NOT EXISTS statut        TEXT NOT NULL DEFAULT 'actif'
                                         CHECK (statut IN ('actif', 'inactif', 'archive')),
  ADD COLUMN IF NOT EXISTS taxe_pct      NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url     TEXT,
  ADD COLUMN IF NOT EXISTS code_barre    TEXT,
  ADD COLUMN IF NOT EXISTS prix_vente    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seuil_alerte  NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_categorie_id ON products(categorie_id);
CREATE INDEX IF NOT EXISTS idx_products_fournisseur_id ON products(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_products_statut ON products(statut);

-- ============================================================
-- 3. ALTER TABLE WAREHOUSES — Ajouter colonnes manquantes
-- ============================================================
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS code          TEXT,
  ADD COLUMN IF NOT EXISTS responsable   TEXT,
  ADD COLUMN IF NOT EXISTS telephone     TEXT,
  ADD COLUMN IF NOT EXISTS ville         TEXT,
  ADD COLUMN IF NOT EXISTS adresse       TEXT,
  ADD COLUMN IF NOT EXISTS capacite_max  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actif         BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 4. ALTER TABLE SUPPLIERS — Ajouter colonnes manquantes
-- ============================================================
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS code                TEXT,
  ADD COLUMN IF NOT EXISTS contact_nom         TEXT,
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS site_web            TEXT,
  ADD COLUMN IF NOT EXISTS conditions_paiement TEXT DEFAULT '30 jours',
  ADD COLUMN IF NOT EXISTS delai_livraison     INTEGER,
  ADD COLUMN IF NOT EXISTS note                SMALLINT CHECK (note BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pays                TEXT,
  ADD COLUMN IF NOT EXISTS ville               TEXT,
  ADD COLUMN IF NOT EXISTS adresse             TEXT,
  ADD COLUMN IF NOT EXISTS actif               BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 5. ALTER TABLE PURCHASES — Ajouter statut si manquant
-- ============================================================
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS statut        TEXT NOT NULL DEFAULT 'brouillon'
                                         CHECK (statut IN ('brouillon','commandé','reçu','payé','annulé')),
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS reference     TEXT;

-- ============================================================
-- 6. STOCK INVENTORIES (Inventaires physiques)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_inventories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  statut       TEXT NOT NULL DEFAULT 'brouillon'
               CHECK (statut IN ('brouillon','en_cours','terminé','validé')),
  date_debut   DATE,
  date_fin     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_inventories" ON stock_inventories
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_stock_inventories_tenant ON stock_inventories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_inventories_statut ON stock_inventories(statut);

-- ============================================================
-- 7. STOCK INVENTORY ITEMS (Lignes d'inventaire)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventaire_id     UUID NOT NULL REFERENCES stock_inventories(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_theorique   NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_physique    NUMERIC(12,2),
  ecart             NUMERIC(12,2),
  unit_cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_inventaire ON stock_inventory_items(inventaire_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON stock_inventory_items(product_id);

-- ============================================================
-- 8. PURCHASE ORDERS (Bons de commande)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero               TEXT NOT NULL,
  supplier_id          UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  date_commande        DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  statut               TEXT NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon','envoyé','confirmé','reçu','annulé')),
  total_ht             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc            NUMERIC(14,2) NOT NULL DEFAULT 0,
  taux_tva             NUMERIC(5,2) NOT NULL DEFAULT 16,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_purchase_orders" ON purchase_orders
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_statut ON purchase_orders(statut);

-- ============================================================
-- 9. PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantite       NUMERIC(12,2) NOT NULL DEFAULT 1,
  prix_unitaire  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON purchase_order_items(product_id);

-- ============================================================
-- 10. STOCK RECEPTIONS (Réceptions de marchandises)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_receptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero            TEXT NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id       UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id      UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  date_reception    DATE NOT NULL DEFAULT CURRENT_DATE,
  statut            TEXT NOT NULL DEFAULT 'validé'
                    CHECK (statut IN ('en_attente','validé','rejeté')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_receptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_receptions" ON stock_receptions
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_stock_receptions_tenant ON stock_receptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_receptions_supplier ON stock_receptions(supplier_id);

-- ============================================================
-- 11. STOCK RECEPTION ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_reception_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id      UUID NOT NULL REFERENCES stock_receptions(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantite_attendue NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantite_recue    NUMERIC(12,2) NOT NULL DEFAULT 0,
  prix_unitaire     NUMERIC(14,2) NOT NULL DEFAULT 0,
  conformite        TEXT NOT NULL DEFAULT 'conforme'
                    CHECK (conformite IN ('conforme','non_conforme','partiel')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reception_items_reception ON stock_reception_items(reception_id);
CREATE INDEX IF NOT EXISTS idx_reception_items_product ON stock_reception_items(product_id);

-- ============================================================
-- 12. STOCK SORTIES (Sorties de stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_sorties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero       TEXT NOT NULL,
  type_sortie  TEXT NOT NULL DEFAULT 'vente'
               CHECK (type_sortie IN ('vente','consommation','transfert','perte','don','usage_interne')),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  destinataire TEXT,
  date_sortie  DATE NOT NULL DEFAULT CURRENT_DATE,
  statut       TEXT NOT NULL DEFAULT 'validé',
  motif        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_sorties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_sorties" ON stock_sorties
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_stock_sorties_tenant ON stock_sorties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_sorties_type ON stock_sorties(type_sortie);
CREATE INDEX IF NOT EXISTS idx_stock_sorties_date ON stock_sorties(date_sortie);

-- ============================================================
-- 13. STOCK SORTIE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_sortie_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sortie_id      UUID NOT NULL REFERENCES stock_sorties(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantite       NUMERIC(12,2) NOT NULL DEFAULT 1,
  prix_unitaire  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sortie_items_sortie ON stock_sortie_items(sortie_id);
CREATE INDEX IF NOT EXISTS idx_sortie_items_product ON stock_sortie_items(product_id);

-- ============================================================
-- 14. STOCK RETOURS (Retours client/fournisseur)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_retours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero       TEXT NOT NULL,
  type_retour  TEXT NOT NULL DEFAULT 'client'
               CHECK (type_retour IN ('client','fournisseur')),
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  quantite     NUMERIC(12,2) NOT NULL DEFAULT 1,
  motif        TEXT NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'en_attente'
               CHECK (statut IN ('en_attente','validé','remboursé','rejeté')),
  valeur       NUMERIC(14,2) NOT NULL DEFAULT 0,
  date_retour  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_retours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_retours" ON stock_retours
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_stock_retours_tenant ON stock_retours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_retours_type ON stock_retours(type_retour);
CREATE INDEX IF NOT EXISTS idx_stock_retours_statut ON stock_retours(statut);

-- ============================================================
-- 15. ALTER STOCK_MOVEMENTS — Ajouter colonnes manquantes
-- ============================================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference  TEXT,
  ADD COLUMN IF NOT EXISTS notes      TEXT;

-- Étendre les types de mouvements autorisés
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('entree','sortie','ajustement','transfert','reception','retour'));

-- ============================================================
-- 16. TRIGGER: updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'product_categories', 'stock_inventories', 'purchase_orders'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 17. TRIGGER: Alerte stock bas après mise à jour produit
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_stock_alerte()
RETURNS TRIGGER AS $$
BEGIN
  -- On pourrait ici insérer dans une table d'alertes si stock < seuil_alerte
  -- Pour l'instant, le calcul se fait côté frontend
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_products_check_stock
  AFTER UPDATE OF stock_actuel ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_stock_alerte();

-- ============================================================
-- 18. VIEW: stock_valorisation_view
-- ============================================================
CREATE OR REPLACE VIEW stock_valorisation_view AS
SELECT
  p.id,
  p.tenant_id,
  p.nom,
  p.sku,
  p.categorie,
  c.nom          AS categorie_nom,
  p.unite,
  p.stock_actuel,
  p.prix_achat,
  p.prix_vente,
  p.seuil_alerte,
  p.stock_max,
  p.statut,
  p.stock_actuel * p.prix_achat AS valeur_stock,
  p.prix_vente - p.prix_achat   AS marge_brute,
  CASE WHEN p.prix_vente > 0
    THEN ROUND(((p.prix_vente - p.prix_achat) / p.prix_vente) * 100, 2)
    ELSE 0
  END AS pct_marge,
  CASE
    WHEN p.stock_actuel <= 0 THEN 'Rupture'
    WHEN p.stock_actuel <= COALESCE(p.seuil_alerte, 0) THEN 'Faible'
    WHEN p.stock_max IS NOT NULL AND p.stock_actuel >= p.stock_max THEN 'Surplus'
    ELSE 'OK'
  END AS statut_stock
FROM products p
LEFT JOIN product_categories c ON c.id = p.categorie_id;

-- ============================================================
-- 19. VIEW: stocks_dashboard_summary
-- ============================================================
CREATE OR REPLACE VIEW stocks_dashboard_summary AS
SELECT
  p.tenant_id,
  COUNT(p.id)                              AS total_produits,
  COUNT(p.id) FILTER (WHERE p.stock_actuel <= 0)                      AS ruptures,
  COUNT(p.id) FILTER (WHERE p.stock_actuel > 0 AND p.stock_actuel <= COALESCE(p.seuil_alerte, 0)) AS stock_faible,
  SUM(p.stock_actuel * p.prix_achat)       AS valeur_stock_total,
  COUNT(DISTINCT w.id)                     AS nb_entrepots
FROM products p
LEFT JOIN warehouses w ON w.tenant_id = p.tenant_id AND w.actif = TRUE
GROUP BY p.tenant_id;

-- ============================================================
-- FIN DE LA MIGRATION 050
-- ============================================================
