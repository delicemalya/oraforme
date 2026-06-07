-- Migration 077 — Paie v2 : colonnes détaillées + acomptes + config
-- Compatibilité : bulletins_paie existe déjà (migration 007)

-- ── Colonnes supplémentaires bulletins_paie ────────────────────────────────────
ALTER TABLE bulletins_paie
  ADD COLUMN IF NOT EXISTS prime_rendement      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_anciennete     NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_transport      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_logement       NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_responsabilite NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indemnite_deplacement NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avantages_nature     NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autres_gains         NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cnss_taux            NUMERIC(6,4) DEFAULT 0.0504,
  ADD COLUMN IF NOT EXISTS total_retenues       NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mutuelle             NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acompte              NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opposition           NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autres_retenues      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tus_patronal         NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medecine_travail     NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cout_total_employeur NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode_paiement        TEXT DEFAULT 'virement',
  ADD COLUMN IF NOT EXISTS reference_paiement   TEXT,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS genere_par           TEXT DEFAULT 'manuel';

-- Corriger la contrainte statut si besoin (idempotent)
ALTER TABLE bulletins_paie
  DROP CONSTRAINT IF EXISTS bulletins_paie_statut_check;

ALTER TABLE bulletins_paie
  ADD CONSTRAINT bulletins_paie_statut_check
    CHECK (statut IN ('generee', 'validee', 'payee', 'brouillon', 'annule'));

-- ── Acomptes sur salaires ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acomptes_salaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  montant NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  date_acompte DATE NOT NULL DEFAULT CURRENT_DATE,
  mois_impute INTEGER CHECK (mois_impute BETWEEN 1 AND 12),
  annee_imputee INTEGER,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'impute', 'annule')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

ALTER TABLE acomptes_salaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acomptes_tenant_isolation" ON acomptes_salaires;
CREATE POLICY "acomptes_tenant_isolation" ON acomptes_salaires FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

GRANT ALL ON acomptes_salaires TO authenticated, service_role;

-- ── Configuration paie par tenant ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_paie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  taux_cnss_employe   NUMERIC(6,4) DEFAULT 0.0504,
  taux_cnss_patronal  NUMERIC(6,4) DEFAULT 0.1436,
  taux_tus            NUMERIC(6,4) DEFAULT 0.0450,
  taux_medecine       NUMERIC(6,4) DEFAULT 0.0050,
  plafond_cnss        NUMERIC(12,0) DEFAULT 3375000,
  jour_paiement       INTEGER DEFAULT 25,
  devise              TEXT DEFAULT 'FCFA',
  prime_transport_fixe NUMERIC(12,0) DEFAULT 0,
  mutuelle_fixe       NUMERIC(12,0) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE config_paie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_paie_tenant_isolation" ON config_paie;
CREATE POLICY "config_paie_tenant_isolation" ON config_paie FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

GRANT ALL ON config_paie TO authenticated, service_role;

-- ── Index performance ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_acomptes_employe ON acomptes_salaires (employe_id, annee_imputee, mois_impute);
CREATE INDEX IF NOT EXISTS idx_acomptes_tenant  ON acomptes_salaires (tenant_id, statut);
