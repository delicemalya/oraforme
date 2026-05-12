-- ============================================================
-- Migration 015 — Pack Restaurant COMPLET
-- ============================================================

-- ── Ajouts sur transactions (source traçabilité) ──────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source    TEXT DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(tenant_id, source);

-- ── Ajouts sur resto_commandes (reçu + paiement) ─────────────
ALTER TABLE resto_commandes
  ADD COLUMN IF NOT EXISTS numero_recu   TEXT,
  ADD COLUMN IF NOT EXISTS mode_paiement TEXT DEFAULT 'especes';

-- ── Ingrédients JSON sur le menu (affichage POS) ─────────────
ALTER TABLE resto_menu
  ADD COLUMN IF NOT EXISTS ingredients JSONB DEFAULT '[]';

-- ── TABLE : rapport_caisse journalier ────────────────────────
CREATE TABLE IF NOT EXISTS rapport_caisse (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  ca_brut         NUMERIC(12,0) DEFAULT 0,
  ca_net          NUMERIC(12,0) DEFAULT 0,
  nb_commandes    INTEGER DEFAULT 0,
  total_especes   NUMERIC(12,0) DEFAULT 0,
  total_airtel    NUMERIC(12,0) DEFAULT 0,
  total_mtn       NUMERIC(12,0) DEFAULT 0,
  total_depenses  NUMERIC(12,0) DEFAULT 0,
  benefice_net    NUMERIC(12,0) DEFAULT 0,
  cloture_par     TEXT,
  cloture_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

ALTER TABLE rapport_caisse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rapport_caisse: select"
  ON rapport_caisse FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "rapport_caisse: insert"
  ON rapport_caisse FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "rapport_caisse: update"
  ON rapport_caisse FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_rapport_caisse_tenant_date ON rapport_caisse(tenant_id, date DESC);

-- ── Mise à jour modules POLYVALON (Pack Restaurant) ──────────
UPDATE tenants
SET modules_actifs = ARRAY[
  'facturation', 'tresorerie', 'stock', 'rh',
  'restaurant', 'achats', 'depenses', 'rapports'
]
WHERE nom_entreprise = 'POLYVALON';
