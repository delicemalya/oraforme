-- ============================================================
-- Migration 010 : Facturation V2 — Congo (TVA 18% + CA 5%)
-- ============================================================

-- Étendre la table factures existante avec les nouvelles colonnes
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS invoice_number  TEXT,
  ADD COLUMN IF NOT EXISTS client_name     TEXT,
  ADD COLUMN IF NOT EXISTS client_address  TEXT,
  ADD COLUMN IF NOT EXISTS client_phone    TEXT,
  ADD COLUMN IF NOT EXISTS date            DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ca              NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS footer_text     TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT;

-- Contrainte statut mise à jour (ajoute 'retard')
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
ALTER TABLE factures ADD CONSTRAINT factures_statut_check
  CHECK (statut IN ('brouillon','envoyee','payee','retard','annulee'));

-- Lignes de facture (remplace le champ items JSONB)
CREATE TABLE IF NOT EXISTS facture_lignes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID REFERENCES factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  price       NUMERIC(12,0) NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 1,
  total       NUMERIC(12,0) NOT NULL DEFAULT 0
);

-- Configuration entreprise (footer des factures)
CREATE TABLE IF NOT EXISTS entreprise_config (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  logo_url         TEXT,
  nom              TEXT,
  adresse          TEXT,
  telephone        TEXT,
  email            TEXT,
  rccm             TEXT,
  sciet            TEXT,
  scien            TEXT,
  capital          TEXT,
  rib              TEXT,
  ville            TEXT DEFAULT 'Pointe-Noire',
  pays             TEXT DEFAULT 'Congo-Brazzaville',
  prefixe_facture  TEXT DEFAULT 'FAC',
  devise           TEXT DEFAULT 'FCFA',
  delai_paiement   INTEGER DEFAULT 30,
  message_defaut   TEXT DEFAULT 'Merci pour votre confiance.',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS facture_lignes
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_fac_lignes" ON facture_lignes
  USING (invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id()));
CREATE POLICY "ins_fac_lignes" ON facture_lignes FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id()));
CREATE POLICY "upd_fac_lignes" ON facture_lignes FOR UPDATE
  USING (invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id()));
CREATE POLICY "del_fac_lignes" ON facture_lignes FOR DELETE
  USING (invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id()));

-- RLS entreprise_config
ALTER TABLE entreprise_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_ent_cfg" ON entreprise_config USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_ent_cfg" ON entreprise_config FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_ent_cfg" ON entreprise_config FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fac_lignes_invoice ON facture_lignes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ent_cfg_tenant     ON entreprise_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_factures_number    ON factures(invoice_number);
CREATE INDEX IF NOT EXISTS idx_factures_statut    ON factures(statut);
