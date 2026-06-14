-- ============================================================
-- 100 — Transport, Commerce & Université
-- ============================================================

-- ── 1. Transport : véhicules ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transport_vehicules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  immatriculation  TEXT NOT NULL,
  marque           TEXT NOT NULL,
  modele           TEXT,
  annee            INT,
  type             TEXT,
  chauffeur_id     UUID REFERENCES chauffeurs(id) ON DELETE SET NULL,
  chauffeur_nom    TEXT,
  km_actuel        INT NOT NULL DEFAULT 0,
  km_vidange       INT,
  km_revision      INT,
  statut           TEXT NOT NULL DEFAULT 'actif'
                     CHECK (statut IN ('actif','maintenance','hors_service','vendu')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tvehicules_tenant ON transport_vehicules (tenant_id);

ALTER TABLE transport_vehicules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_vehicules_own" ON transport_vehicules
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 2. Transport : carburant ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transport_carburant (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicule_id    UUID REFERENCES transport_vehicules(id) ON DELETE SET NULL,
  vehicule_imm   TEXT,
  chauffeur_id   UUID REFERENCES chauffeurs(id) ON DELETE SET NULL,
  chauffeur_nom  TEXT,
  litres         NUMERIC(8,2) NOT NULL DEFAULT 0,
  prix_litre     NUMERIC(8,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  km_au_plein    INT,
  type_carburant TEXT NOT NULL DEFAULT 'diesel'
                   CHECK (type_carburant IN ('diesel','essence','gpl')),
  station        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcarburant_tenant ON transport_carburant (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tcarburant_date   ON transport_carburant (tenant_id, date);

ALTER TABLE transport_carburant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_carburant_own" ON transport_carburant
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 3. Commerce : ventes (tickets de caisse) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS ventes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero          TEXT,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  mode_paiement   TEXT NOT NULL DEFAULT 'especes',
  caissier_id     UUID,
  caissier_nom    TEXT,
  nb_articles     INT NOT NULL DEFAULT 0,
  statut          TEXT NOT NULL DEFAULT 'validee'
                    CHECK (statut IN ('en_cours','validee','annulee','remboursee')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventes_tenant ON ventes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventes_date   ON ventes (tenant_id, created_at);

ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ventes_own" ON ventes
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 4. Commerce : lignes de vente ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vente_lignes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vente_id     UUID NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id   UUID,
  produit_nom  TEXT NOT NULL,
  qte          NUMERIC(10,3) NOT NULL DEFAULT 1,
  prix         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sous_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente ON vente_lignes (vente_id);

ALTER TABLE vente_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vente_lignes_own" ON vente_lignes
  FOR ALL USING (
    vente_id IN (
      SELECT id FROM ventes WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ── 5. Commerce : clients fidèles ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commerce_clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  telephone    TEXT,
  email        TEXT,
  adresse      TEXT,
  points       INT NOT NULL DEFAULT 0,
  total_achats NUMERIC(14,2) NOT NULL DEFAULT 0,
  nb_visites   INT NOT NULL DEFAULT 0,
  statut       TEXT NOT NULL DEFAULT 'actif'
                 CHECK (statut IN ('actif','inactif','vip')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cclients_tenant ON commerce_clients (tenant_id);

ALTER TABLE commerce_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commerce_clients_own" ON commerce_clients
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 6. Université : thèses & mémoires ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecole_theses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titre                TEXT NOT NULL,
  etudiant_nom         TEXT NOT NULL,
  etudiant_id          UUID,
  directeur_nom        TEXT,
  co_directeur_nom     TEXT,
  domaine              TEXT,
  niveau               TEXT,
  annee_universitaire  TEXT,
  statut               TEXT NOT NULL DEFAULT 'en_cours'
                         CHECK (statut IN ('en_cours','soumise','validee','soutenue','abandonnee')),
  date_depot           DATE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etheses_tenant ON ecole_theses (tenant_id);

ALTER TABLE ecole_theses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecole_theses_own" ON ecole_theses
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 6. Université : soutenances ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecole_soutenances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  these_id        UUID REFERENCES ecole_theses(id) ON DELETE SET NULL,
  etudiant_nom    TEXT NOT NULL,
  titre           TEXT NOT NULL,
  niveau          TEXT,
  date_soutenance DATE,
  heure           TEXT,
  salle           TEXT,
  directeur_nom   TEXT,
  jury            TEXT[],
  mention         TEXT,
  note            NUMERIC(5,2),
  statut          TEXT NOT NULL DEFAULT 'planifiee'
                    CHECK (statut IN ('planifiee','en_cours','validee','ajournee','annulee')),
  observations    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esoutenances_tenant ON ecole_soutenances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_esoutenances_date   ON ecole_soutenances (tenant_id, date_soutenance);

ALTER TABLE ecole_soutenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecole_soutenances_own" ON ecole_soutenances
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 7. Université : registre des diplômes ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecole_diplomes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_nom     TEXT NOT NULL,
  etudiant_id      UUID,
  type             TEXT NOT NULL,
  intitule         TEXT NOT NULL,
  mention          TEXT,
  note             NUMERIC(5,2),
  annee_obtention  INT NOT NULL,
  numero_diplome   TEXT,
  date_emission    DATE,
  statut           TEXT NOT NULL DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente','emis','remis','annule')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero_diplome)
);

CREATE INDEX IF NOT EXISTS idx_edipl_tenant ON ecole_diplomes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_edipl_annee  ON ecole_diplomes (tenant_id, annee_obtention);

ALTER TABLE ecole_diplomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecole_diplomes_own" ON ecole_diplomes
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── Trigger updated_at générique ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['transport_vehicules','ecole_theses','ecole_soutenances','ecole_diplomes'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_upd ON %I; CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- À exécuter dans le SQL Editor Supabase
-- Après les migrations 097, 098, 099
-- ============================================================
