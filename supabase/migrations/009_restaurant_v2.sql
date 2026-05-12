-- ============================================================
-- Migration 009 : Restaurant V2 — Tables, QR, Stock, Livraison
-- ============================================================

-- Tables physiques du restaurant (pour QR codes)
CREATE TABLE IF NOT EXISTS resto_tables (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  numero     INTEGER NOT NULL,
  nom        TEXT,
  capacite   INTEGER DEFAULT 4,
  statut     TEXT DEFAULT 'libre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

-- Lien ingrédients / plats (recettes)
CREATE TABLE IF NOT EXISTS resto_recettes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id         UUID REFERENCES resto_menu(id) ON DELETE CASCADE,
  article_id           UUID REFERENCES stock_articles(id) ON DELETE SET NULL,
  article_nom          TEXT NOT NULL,
  quantite_par_portion DECIMAL(10,3) NOT NULL DEFAULT 1,
  unite                TEXT DEFAULT 'unité',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes supplémentaires sur commandes
ALTER TABLE resto_commandes
  ADD COLUMN IF NOT EXISTS paiement          TEXT DEFAULT 'especes',
  ADD COLUMN IF NOT EXISTS client_nom        TEXT,
  ADD COLUMN IF NOT EXISTS client_tel        TEXT,
  ADD COLUMN IF NOT EXISTS adresse_livraison TEXT,
  ADD COLUMN IF NOT EXISTS note_client       TEXT,
  ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'caisse';

-- Slug sur tenant pour URL publique
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- RLS Tables
ALTER TABLE resto_tables   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_tables"   ON resto_tables USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_tables"   ON resto_tables FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_tables"   ON resto_tables FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_tables"   ON resto_tables FOR DELETE USING (tenant_id = get_my_tenant_id());

-- RLS Recettes
ALTER TABLE resto_recettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_recettes" ON resto_recettes USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_recettes" ON resto_recettes FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_recettes" ON resto_recettes FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_recettes" ON resto_recettes FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Politique publique : clients peuvent lire le menu disponible
DROP POLICY IF EXISTS "public_menu_read" ON resto_menu;
CREATE POLICY "public_menu_read" ON resto_menu FOR SELECT USING (disponible = true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tables_tenant   ON resto_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recettes_menu   ON resto_recettes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recettes_tenant ON resto_recettes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmd_source      ON resto_commandes(source);
