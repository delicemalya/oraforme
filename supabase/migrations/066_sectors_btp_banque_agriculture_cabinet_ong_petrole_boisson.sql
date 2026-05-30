-- =============================================================================
-- Migration 066 : Tables secteurs métier
--   BTP, Banque/Microfinance, Agriculture, Cabinet, ONG, Pétrole, Boisson
-- Auteur  : Oraforme ERP
-- Date    : 2026-05-30
-- =============================================================================

-- ===========================================================================
-- BTP & CONSTRUCTION
-- ===========================================================================

CREATE TABLE IF NOT EXISTS btp_chantiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  client_nom    TEXT,
  client_id     UUID,
  description   TEXT,
  adresse       TEXT,
  budget        NUMERIC(15,2) DEFAULT 0,
  montant_depense NUMERIC(15,2) DEFAULT 0,
  avancement_pct INTEGER DEFAULT 0 CHECK (avancement_pct BETWEEN 0 AND 100),
  statut        TEXT NOT NULL DEFAULT 'planifie'
                  CHECK (statut IN ('planifie','en_cours','termine','suspendu','annule')),
  date_debut    DATE,
  date_fin      DATE,
  chef_projet   TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE btp_chantiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY btp_chantiers_tenant ON btp_chantiers
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_btp_chantiers_tenant   ON btp_chantiers(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_btp_chantiers_created  ON btp_chantiers(tenant_id, created_at DESC);

-- ===========================================================================
-- BANQUE & MICROFINANCE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS banque_membres (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_compte   TEXT,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  date_naissance  DATE,
  telephone       TEXT,
  adresse         TEXT,
  type_compte     TEXT NOT NULL DEFAULT 'epargne'
                    CHECK (type_compte IN ('epargne','courant','depot_terme')),
  solde           NUMERIC(15,2) NOT NULL DEFAULT 0,
  date_ouverture  DATE NOT NULL DEFAULT CURRENT_DATE,
  statut          TEXT NOT NULL DEFAULT 'actif'
                    CHECK (statut IN ('actif','suspendu','cloture')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate account number
CREATE OR REPLACE FUNCTION fn_banque_numero_compte()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_num TEXT;
BEGIN
  IF NEW.numero_compte IS NULL OR NEW.numero_compte = '' THEN
    SELECT 'CPT-' || LPAD(COALESCE(COUNT(*)+1, 1)::TEXT, 6, '0')
      INTO v_num FROM banque_membres WHERE tenant_id = NEW.tenant_id;
    NEW.numero_compte := v_num;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_banque_numero_compte ON banque_membres;
CREATE TRIGGER trg_banque_numero_compte
  BEFORE INSERT ON banque_membres
  FOR EACH ROW EXECUTE FUNCTION fn_banque_numero_compte();

ALTER TABLE banque_membres ENABLE ROW LEVEL SECURITY;
CREATE POLICY banque_membres_tenant ON banque_membres
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_banque_membres_tenant ON banque_membres(tenant_id, statut);

CREATE TABLE IF NOT EXISTS banque_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id       UUID NOT NULL REFERENCES banque_membres(id) ON DELETE CASCADE,
  montant         NUMERIC(15,2) NOT NULL,
  taux_interet    NUMERIC(5,2) NOT NULL DEFAULT 12,
  duree_mois      INTEGER NOT NULL DEFAULT 12,
  montant_rembourse NUMERIC(15,2) NOT NULL DEFAULT 0,
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente','accorde','en_cours','solde','rejete')),
  date_octroi     DATE,
  date_echeance   DATE,
  motif           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE banque_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY banque_credits_tenant ON banque_credits
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_banque_credits_tenant ON banque_credits(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_banque_credits_membre ON banque_credits(membre_id);

CREATE TABLE IF NOT EXISTS banque_operations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id     UUID REFERENCES banque_membres(id) ON DELETE SET NULL,
  type          TEXT NOT NULL
                  CHECK (type IN ('depot','retrait','virement','remboursement','interet','frais')),
  montant       NUMERIC(15,2) NOT NULL,
  solde_avant   NUMERIC(15,2),
  solde_apres   NUMERIC(15,2),
  description   TEXT,
  reference     TEXT,
  credit_id     UUID REFERENCES banque_credits(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE banque_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY banque_ops_tenant ON banque_operations
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_banque_ops_tenant  ON banque_operations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_banque_ops_membre  ON banque_operations(membre_id, created_at DESC);

-- ===========================================================================
-- AGRICULTURE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS agriculture_parcelles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  superficie_ha   NUMERIC(10,2) DEFAULT 0,
  culture         TEXT,
  localisation    TEXT,
  statut          TEXT NOT NULL DEFAULT 'active'
                    CHECK (statut IN ('active','jachere','en_preparation','archive')),
  proprietaire    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agriculture_parcelles ENABLE ROW LEVEL SECURITY;
CREATE POLICY agri_parcelles_tenant ON agriculture_parcelles
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_agri_parcelles_tenant ON agriculture_parcelles(tenant_id, statut);

CREATE TABLE IF NOT EXISTS agriculture_recoltes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parcelle_id   UUID REFERENCES agriculture_parcelles(id) ON DELETE SET NULL,
  culture       TEXT NOT NULL,
  quantite_kg   NUMERIC(12,2) NOT NULL DEFAULT 0,
  prix_unitaire NUMERIC(12,2) DEFAULT 0,
  montant_total NUMERIC(15,2) GENERATED ALWAYS AS (quantite_kg * prix_unitaire) STORED,
  date_recolte  DATE NOT NULL DEFAULT CURRENT_DATE,
  destination   TEXT CHECK (destination IN ('vente','stockage','autoconsommation')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agriculture_recoltes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agri_recoltes_tenant ON agriculture_recoltes
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_agri_recoltes_tenant   ON agriculture_recoltes(tenant_id, date_recolte DESC);
CREATE INDEX IF NOT EXISTS idx_agri_recoltes_parcelle ON agriculture_recoltes(parcelle_id);

CREATE TABLE IF NOT EXISTS agriculture_intrants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  type          TEXT NOT NULL
                  CHECK (type IN ('semence','engrais','pesticide','outillage','carburant','autre')),
  stock_actuel  NUMERIC(12,2) DEFAULT 0,
  unite         TEXT DEFAULT 'kg',
  prix_unitaire NUMERIC(12,2) DEFAULT 0,
  seuil_alerte  NUMERIC(12,2) DEFAULT 0,
  fournisseur   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agriculture_intrants ENABLE ROW LEVEL SECURITY;
CREATE POLICY agri_intrants_tenant ON agriculture_intrants
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_agri_intrants_tenant ON agriculture_intrants(tenant_id, type);

-- ===========================================================================
-- CABINET & CONSEIL
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cabinet_projets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom                 TEXT NOT NULL,
  client_nom          TEXT,
  client_id           UUID,
  description         TEXT,
  budget_honoraires   NUMERIC(15,2) DEFAULT 0,
  montant_facture     NUMERIC(15,2) DEFAULT 0,
  statut              TEXT NOT NULL DEFAULT 'en_cours'
                        CHECK (statut IN ('devis','en_cours','termine','annule','suspendu')),
  date_debut          DATE,
  date_fin            DATE,
  chef_projet         TEXT,
  type_mission        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cabinet_projets ENABLE ROW LEVEL SECURITY;
CREATE POLICY cabinet_projets_tenant ON cabinet_projets
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_cabinet_projets_tenant ON cabinet_projets(tenant_id, statut);

-- ===========================================================================
-- ONG & ASSOCIATION
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ong_programmes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  bailleur        TEXT,
  budget_total    NUMERIC(15,2) DEFAULT 0,
  montant_depense NUMERIC(15,2) DEFAULT 0,
  date_debut      DATE,
  date_fin        DATE,
  zone            TEXT,
  objectif        TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_cours'
                    CHECK (statut IN ('proposition','en_cours','cloture','suspendu')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ong_programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ong_programmes_tenant ON ong_programmes
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_ong_programmes_tenant ON ong_programmes(tenant_id, statut);

CREATE TABLE IF NOT EXISTS ong_dons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  programme_id    UUID REFERENCES ong_programmes(id) ON DELETE SET NULL,
  donateur        TEXT NOT NULL,
  type_don        TEXT NOT NULL DEFAULT 'ponctuel'
                    CHECK (type_don IN ('ponctuel','regulier','subvention','materiel')),
  montant         NUMERIC(15,2) NOT NULL DEFAULT 0,
  date_reception  DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement   TEXT DEFAULT 'virement',
  recu_emis       BOOLEAN DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ong_dons ENABLE ROW LEVEL SECURITY;
CREATE POLICY ong_dons_tenant ON ong_dons
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_ong_dons_tenant ON ong_dons(tenant_id, date_reception DESC);

-- ===========================================================================
-- PÉTROLE & MINES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS petrole_sites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom                   TEXT NOT NULL,
  localisation          TEXT,
  type_site             TEXT NOT NULL DEFAULT 'puits'
                          CHECK (type_site IN ('puits','mine','raffinerie','depot','autre')),
  production_journaliere NUMERIC(12,2) DEFAULT 0,
  unite_production      TEXT DEFAULT 'barils',
  statut                TEXT NOT NULL DEFAULT 'actif'
                          CHECK (statut IN ('actif','inactif','maintenance','explore')),
  date_ouverture        DATE,
  operateur             TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE petrole_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY petrole_sites_tenant ON petrole_sites
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_petrole_sites_tenant ON petrole_sites(tenant_id, statut);

-- ===========================================================================
-- BOISSONS & DISTRIBUTION
-- ===========================================================================

CREATE TABLE IF NOT EXISTS boisson_tournees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chauffeur_nom     TEXT NOT NULL,
  vehicule          TEXT,
  zone              TEXT,
  date_tournee      DATE NOT NULL DEFAULT CURRENT_DATE,
  statut            TEXT NOT NULL DEFAULT 'planifiee'
                      CHECK (statut IN ('planifiee','en_cours','terminee','annulee')),
  montant_prevu     NUMERIC(15,2) DEFAULT 0,
  montant_collecte  NUMERIC(15,2) DEFAULT 0,
  nombre_clients    INTEGER DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE boisson_tournees ENABLE ROW LEVEL SECURITY;
CREATE POLICY boisson_tournees_tenant ON boisson_tournees
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
                      ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS idx_boisson_tournees_tenant ON boisson_tournees(tenant_id, date_tournee DESC);

-- Fin migration 066
