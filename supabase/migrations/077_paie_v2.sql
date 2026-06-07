-- Migration 077 — Paie v2 complète (CREATE IF NOT EXISTS + ALTER idempotent)
-- Fonctionne que bulletins_paie existe ou non

-- ── Table bulletins_paie (création complète) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bulletins_paie (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id            UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  mois                  INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee                 INTEGER NOT NULL,
  -- Salaire de base
  salaire_base          NUMERIC(12,0) NOT NULL DEFAULT 0,
  -- Gains variables
  primes                NUMERIC(12,0) DEFAULT 0,
  heures_sup            NUMERIC(6,2)  DEFAULT 0,
  taux_horaire          NUMERIC(10,0) DEFAULT 0,
  prime_rendement       NUMERIC(12,0) DEFAULT 0,
  prime_anciennete      NUMERIC(12,0) DEFAULT 0,
  prime_transport       NUMERIC(12,0) DEFAULT 0,
  prime_logement        NUMERIC(12,0) DEFAULT 0,
  prime_responsabilite  NUMERIC(12,0) DEFAULT 0,
  indemnite_deplacement NUMERIC(12,0) DEFAULT 0,
  avantages_nature      NUMERIC(12,0) DEFAULT 0,
  autres_gains          NUMERIC(12,0) DEFAULT 0,
  -- Brut
  brut                  NUMERIC(12,0) DEFAULT 0,
  -- Retenues salariales
  cnss_salarie          NUMERIC(12,0) DEFAULT 0,
  cnss_taux             NUMERIC(6,4)  DEFAULT 0.0504,
  irpp                  NUMERIC(12,0) DEFAULT 0,
  mutuelle              NUMERIC(12,0) DEFAULT 0,
  acompte               NUMERIC(12,0) DEFAULT 0,
  opposition            NUMERIC(12,0) DEFAULT 0,
  autres_retenues       NUMERIC(12,0) DEFAULT 0,
  total_retenues        NUMERIC(12,0) DEFAULT 0,
  -- Net
  net                   NUMERIC(12,0) DEFAULT 0,
  -- Charges patronales
  cnss_patronal         NUMERIC(12,0) DEFAULT 0,
  tus_patronal          NUMERIC(12,0) DEFAULT 0,
  medecine_travail      NUMERIC(12,0) DEFAULT 0,
  cout_total_employeur  NUMERIC(12,0) DEFAULT 0,
  -- Paiement
  statut                TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','generee','validee','payee','annule')),
  mode_paiement         TEXT DEFAULT 'virement',
  reference_paiement    TEXT,
  notes                 TEXT,
  genere_par            TEXT DEFAULT 'manuel',
  -- Audit
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  -- Unicité par employé/mois/année
  UNIQUE (employe_id, mois, annee)
);

-- Colonnes supplémentaires pour comptes existants (idempotent)
ALTER TABLE bulletins_paie
  ADD COLUMN IF NOT EXISTS prime_rendement       NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_anciennete      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_transport       NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_logement        NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_responsabilite  NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indemnite_deplacement NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avantages_nature      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autres_gains          NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cnss_taux             NUMERIC(6,4)  DEFAULT 0.0504,
  ADD COLUMN IF NOT EXISTS total_retenues        NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mutuelle              NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acompte               NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opposition            NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autres_retenues       NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tus_patronal          NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medecine_travail      NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cout_total_employeur  NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode_paiement         TEXT DEFAULT 'virement',
  ADD COLUMN IF NOT EXISTS reference_paiement    TEXT,
  ADD COLUMN IF NOT EXISTS notes                 TEXT,
  ADD COLUMN IF NOT EXISTS genere_par            TEXT DEFAULT 'manuel';

-- Contrainte statut (recrée proprement)
ALTER TABLE bulletins_paie
  DROP CONSTRAINT IF EXISTS bulletins_paie_statut_check;
ALTER TABLE bulletins_paie
  ADD CONSTRAINT bulletins_paie_statut_check
    CHECK (statut IN ('brouillon','generee','validee','payee','annule'));

-- RLS
ALTER TABLE bulletins_paie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulletins_tenant_isolation" ON bulletins_paie;
CREATE POLICY "bulletins_tenant_isolation" ON bulletins_paie FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

GRANT ALL ON bulletins_paie TO authenticated, service_role;

-- Index
CREATE INDEX IF NOT EXISTS idx_bulletins_tenant_periode
  ON bulletins_paie (tenant_id, annee, mois);
CREATE INDEX IF NOT EXISTS idx_bulletins_employe
  ON bulletins_paie (employe_id, annee, mois);

-- ── Acomptes sur salaires ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acomptes_salaires (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id    UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  montant       NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  date_acompte  DATE NOT NULL DEFAULT CURRENT_DATE,
  mois_impute   INTEGER CHECK (mois_impute BETWEEN 1 AND 12),
  annee_imputee INTEGER,
  statut        TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','impute','annule')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID
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

CREATE INDEX IF NOT EXISTS idx_acomptes_employe
  ON acomptes_salaires (employe_id, annee_imputee, mois_impute);
CREATE INDEX IF NOT EXISTS idx_acomptes_tenant
  ON acomptes_salaires (tenant_id, statut);

-- ── Configuration paie par tenant ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_paie (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  taux_cnss_employe    NUMERIC(6,4) DEFAULT 0.0504,
  taux_cnss_patronal   NUMERIC(6,4) DEFAULT 0.1436,
  taux_tus             NUMERIC(6,4) DEFAULT 0.0450,
  taux_medecine        NUMERIC(6,4) DEFAULT 0.0050,
  plafond_cnss         NUMERIC(12,0) DEFAULT 3375000,
  jour_paiement        INTEGER DEFAULT 25,
  devise               TEXT DEFAULT 'FCFA',
  prime_transport_fixe NUMERIC(12,0) DEFAULT 0,
  mutuelle_fixe        NUMERIC(12,0) DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
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
