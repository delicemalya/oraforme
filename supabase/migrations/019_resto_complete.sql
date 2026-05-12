-- ============================================================
-- Migration 019 — Restaurant : Achats, Fournisseurs, Corrections
-- ============================================================

-- ── Fournisseurs restaurant ──────────────────────────────────
CREATE TABLE IF NOT EXISTS resto_fournisseurs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  telephone  TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resto_fournisseurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resto_fourn: select" ON resto_fournisseurs FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_fourn: insert" ON resto_fournisseurs FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_fourn: update" ON resto_fournisseurs FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_fourn: delete" ON resto_fournisseurs FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ── Achats restaurant (lignes stockées en JSONB) ─────────────
CREATE TABLE IF NOT EXISTS resto_achats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fournisseur_nom TEXT        NOT NULL,
  fournisseur_id  UUID        REFERENCES resto_fournisseurs(id) ON DELETE SET NULL,
  date_achat      DATE        NOT NULL DEFAULT CURRENT_DATE,
  total           NUMERIC(12,0) NOT NULL DEFAULT 0,
  mode_paiement   TEXT        NOT NULL DEFAULT 'especes',
  note            TEXT,
  lignes          JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resto_achats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resto_achats: select" ON resto_achats FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_achats: insert" ON resto_achats FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_achats: update" ON resto_achats FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resto_achats: delete" ON resto_achats FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_resto_achats_tenant ON resto_achats(tenant_id, date_achat DESC);
CREATE INDEX IF NOT EXISTS idx_resto_fournisseurs_tenant ON resto_fournisseurs(tenant_id);

-- ── Colonnes supplémentaires resto_commandes ─────────────────
ALTER TABLE resto_commandes
  ADD COLUMN IF NOT EXISTS note_interne TEXT,
  ADD COLUMN IF NOT EXISTS serveur_nom  TEXT;

-- ── Seuil alerte sur stock_articles (si absent) ──────────────
ALTER TABLE stock_articles
  ADD COLUMN IF NOT EXISTS seuil_alerte NUMERIC(10,3);
