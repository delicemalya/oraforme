-- ============================================================
-- Migration 007 : Système de paie Congo-Brazzaville
-- ============================================================

CREATE TABLE IF NOT EXISTS bulletins_paie (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID REFERENCES employes(id) ON DELETE SET NULL,
  mois            INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee           INTEGER NOT NULL,
  salaire_base    DECIMAL(12,0) NOT NULL,
  primes          DECIMAL(12,0) DEFAULT 0,
  heures_sup      DECIMAL(6,2) DEFAULT 0,
  taux_horaire    DECIMAL(10,0) DEFAULT 0,
  brut            DECIMAL(12,0) NOT NULL,
  cnss_salarie    DECIMAL(12,0) NOT NULL,
  cnss_patronal   DECIMAL(12,0) NOT NULL,
  irpp            DECIMAL(12,0) NOT NULL,
  net             DECIMAL(12,0) NOT NULL,
  statut          TEXT DEFAULT 'generee',  -- generee | validee | payee
  date_paiement   DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employe_id, mois, annee)
);

-- RLS
ALTER TABLE bulletins_paie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_paie"     ON bulletins_paie USING (tenant_id = get_my_tenant_id());
CREATE POLICY "insert_paie"     ON bulletins_paie FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "update_paie"     ON bulletins_paie FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "delete_paie"     ON bulletins_paie FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Index
CREATE INDEX IF NOT EXISTS idx_paie_tenant   ON bulletins_paie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paie_employe  ON bulletins_paie(employe_id);
CREATE INDEX IF NOT EXISTS idx_paie_periode  ON bulletins_paie(annee, mois);
