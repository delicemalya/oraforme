-- ============================================================
-- Migration 006 : RH Lifecycle — statuts, congés, retraite
-- ============================================================

-- Colonnes supplémentaires sur employes
ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS statut          TEXT DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS telephone       TEXT,
  ADD COLUMN IF NOT EXISTS date_embauche   DATE,
  ADD COLUMN IF NOT EXISTS date_naissance  DATE,
  ADD COLUMN IF NOT EXISTS date_fin_contrat DATE,
  ADD COLUMN IF NOT EXISTS date_retraite_prevue DATE,
  ADD COLUMN IF NOT EXISTS solde_conges    INTEGER DEFAULT 26,
  ADD COLUMN IF NOT EXISTS notes           TEXT;

-- Table congés
CREATE TABLE IF NOT EXISTS conges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id  UUID REFERENCES employes(id) ON DELETE CASCADE,
  type_conge  TEXT DEFAULT 'annuel',   -- annuel | maladie | maternite | exceptionnel
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  nb_jours    INTEGER NOT NULL,
  statut      TEXT DEFAULT 'en_attente', -- en_attente | approuve | refuse
  motif       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE conges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_conges" ON conges USING (tenant_id = get_my_tenant_id());
CREATE POLICY "insert_conges" ON conges FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "update_conges" ON conges FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "delete_conges" ON conges FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Index
CREATE INDEX IF NOT EXISTS idx_conges_tenant   ON conges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conges_employe  ON conges(employe_id);
CREATE INDEX IF NOT EXISTS idx_employes_statut ON employes(statut);
