-- ============================================================
-- Migration 101 — BTP phases, ONG bailleurs, Boisson commandes, Pétrole production
-- ============================================================

-- ── BTP Phases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS btp_phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chantier_id UUID NOT NULL REFERENCES btp_chantiers(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  ordre       INT  NOT NULL DEFAULT 1,
  avancement_pct INT NOT NULL DEFAULT 0 CHECK (avancement_pct BETWEEN 0 AND 100),
  statut      TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire','en_cours','termine','bloque')),
  date_prevue DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE btp_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "btp_phases_tenant" ON btp_phases USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER trg_btp_phases_upd BEFORE UPDATE ON btp_phases
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── ONG Bailleurs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ong_bailleurs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  type_bailleur   TEXT NOT NULL DEFAULT 'prive'
    CHECK (type_bailleur IN ('gouvernement','multilateral','bilateral','fondation','prive','diaspora','autre')),
  pays            TEXT,
  contact_nom     TEXT,
  contact_email   TEXT,
  contact_tel     TEXT,
  montant_engage  NUMERIC(18,2) NOT NULL DEFAULT 0,
  devise          TEXT NOT NULL DEFAULT 'XAF',
  statut          TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','inactif','potentiel')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ong_bailleurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ong_bailleurs_tenant" ON ong_bailleurs USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER trg_ong_bailleurs_upd BEFORE UPDATE ON ong_bailleurs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Boisson Commandes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boisson_commandes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_nom        TEXT NOT NULL,
  client_telephone  TEXT,
  adresse_livraison TEXT,
  date_livraison    DATE,
  montant_total     NUMERIC(18,2) NOT NULL DEFAULT 0,
  statut            TEXT NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle','confirmee','en_livraison','livree','annulee')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE boisson_commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boisson_commandes_tenant" ON boisson_commandes USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER trg_boisson_commandes_upd BEFORE UPDATE ON boisson_commandes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Pétrole Production ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS petrole_production (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES petrole_sites(id) ON DELETE CASCADE,
  date_production   DATE NOT NULL,
  quantite          NUMERIC(18,4) NOT NULL,
  unite             TEXT NOT NULL DEFAULT 'barils',
  type_hydrocarbure TEXT NOT NULL DEFAULT 'brut'
    CHECK (type_hydrocarbure IN ('brut','gaz','condensat','raffine','autre')),
  prix_unitaire     NUMERIC(12,4),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE petrole_production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "petrole_production_tenant" ON petrole_production USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);
CREATE TRIGGER trg_petrole_production_upd BEFORE UPDATE ON petrole_production
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Index performances
CREATE INDEX IF NOT EXISTS idx_btp_phases_chantier   ON btp_phases(tenant_id, chantier_id);
CREATE INDEX IF NOT EXISTS idx_ong_bailleurs_tenant   ON ong_bailleurs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_boisson_commandes_date ON boisson_commandes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_petrole_prod_date      ON petrole_production(tenant_id, date_production DESC);
CREATE INDEX IF NOT EXISTS idx_petrole_prod_site      ON petrole_production(tenant_id, site_id);
