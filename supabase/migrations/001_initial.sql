-- ============================================================
-- ORAFORME - Initial Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TENANTS
-- ============================================================
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom_entreprise  TEXT NOT NULL,
  nif             TEXT,
  logo_url        TEXT,
  plan            TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  modules_actifs  TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('owner', 'admin', 'membre')),
  nom         TEXT NOT NULL,
  prenom      TEXT NOT NULL,
  telephone   TEXT,
  UNIQUE (user_id)
);

-- ============================================================
-- 3. CLIENTS
-- ============================================================
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  email       TEXT,
  telephone   TEXT,
  adresse     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. FACTURES
-- ============================================================
CREATE TABLE factures (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_nom     TEXT NOT NULL,
  client_email   TEXT,
  items          JSONB NOT NULL DEFAULT '[]',
  montant_ht     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tva            NUMERIC(5, 2) NOT NULL DEFAULT 18,
  total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  statut         TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'annulee')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. STOCK ARTICLES
-- ============================================================
CREATE TABLE stock_articles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  categorie      TEXT,
  quantite       NUMERIC(12, 3) NOT NULL DEFAULT 0,
  prix_unitaire  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  seuil_alerte   NUMERIC(12, 3) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. EMPLOYES
-- ============================================================
CREATE TABLE employes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  poste        TEXT,
  salaire_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
  contrat      TEXT NOT NULL DEFAULT 'cdi' CHECK (contrat IN ('cdi', 'cdd', 'stage', 'freelance')),
  cnss         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. RESTO MENU
-- ============================================================
CREATE TABLE resto_menu (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  categorie   TEXT,
  prix        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  emoji       TEXT,
  disponible  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. RESTO COMMANDES
-- ============================================================
CREATE TABLE resto_commandes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_num   TEXT,
  mode        TEXT NOT NULL DEFAULT 'sur_place' CHECK (mode IN ('sur_place', 'emporter', 'livraison')),
  items       JSONB NOT NULL DEFAULT '[]',
  statut      TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_preparation', 'pret', 'livre', 'annule')),
  total       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_articles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE resto_menu       ENABLE ROW LEVEL SECURITY;
ALTER TABLE resto_commandes  ENABLE ROW LEVEL SECURITY;

-- Helper function : retourne le tenant_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid();
$$;

-- ============================================================
-- POLICIES : tenants
-- ============================================================
CREATE POLICY "tenants: voir son tenant"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id());

CREATE POLICY "tenants: modifier son tenant"
  ON tenants FOR UPDATE
  USING (id = auth_tenant_id());

-- ============================================================
-- POLICIES : profiles
-- ============================================================
CREATE POLICY "profiles: voir les profils de son tenant"
  ON profiles FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "profiles: insérer son propre profil"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles: modifier son profil"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- POLICIES : clients
-- ============================================================
CREATE POLICY "clients: select"
  ON clients FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "clients: insert"
  ON clients FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "clients: update"
  ON clients FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "clients: delete"
  ON clients FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- POLICIES : factures
-- ============================================================
CREATE POLICY "factures: select"
  ON factures FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "factures: insert"
  ON factures FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "factures: update"
  ON factures FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "factures: delete"
  ON factures FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- POLICIES : stock_articles
-- ============================================================
CREATE POLICY "stock: select"
  ON stock_articles FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "stock: insert"
  ON stock_articles FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "stock: update"
  ON stock_articles FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "stock: delete"
  ON stock_articles FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- POLICIES : employes
-- ============================================================
CREATE POLICY "employes: select"
  ON employes FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "employes: insert"
  ON employes FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "employes: update"
  ON employes FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "employes: delete"
  ON employes FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- POLICIES : resto_menu
-- ============================================================
CREATE POLICY "resto_menu: select"
  ON resto_menu FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "resto_menu: insert"
  ON resto_menu FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "resto_menu: update"
  ON resto_menu FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "resto_menu: delete"
  ON resto_menu FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- POLICIES : resto_commandes
-- ============================================================
CREATE POLICY "resto_commandes: select"
  ON resto_commandes FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "resto_commandes: insert"
  ON resto_commandes FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "resto_commandes: update"
  ON resto_commandes FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "resto_commandes: delete"
  ON resto_commandes FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_profiles_user_id       ON profiles(user_id);
CREATE INDEX idx_profiles_tenant_id     ON profiles(tenant_id);
CREATE INDEX idx_clients_tenant_id      ON clients(tenant_id);
CREATE INDEX idx_factures_tenant_id     ON factures(tenant_id);
CREATE INDEX idx_factures_statut        ON factures(statut);
CREATE INDEX idx_stock_tenant_id        ON stock_articles(tenant_id);
CREATE INDEX idx_employes_tenant_id     ON employes(tenant_id);
CREATE INDEX idx_resto_menu_tenant_id   ON resto_menu(tenant_id);
CREATE INDEX idx_resto_cmd_tenant_id    ON resto_commandes(tenant_id);
CREATE INDEX idx_resto_cmd_statut       ON resto_commandes(statut);
