-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 079 — MODULE CABINET COMPTABLE COMPLET
-- Architecture : Cabinet → Clients → Documents/Tâches/Messages/Honoraires
-- Système 5 000 FCFA/client actif/mois → oraforme_revenue
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enrichir la table tenants ─────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS type_tenant TEXT
  DEFAULT 'entreprise'
  CHECK (type_tenant IN (
    'entreprise','cabinet_comptable','cabinet_juridique',
    'cabinet_conseil','cabinet_audit','fiduciaire'
  ));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS est_cabinet BOOLEAN DEFAULT FALSE;

-- ── 2. Table clients du cabinet ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinet_clients (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,

  -- Infos entreprise
  nom_entreprise         TEXT NOT NULL,
  forme_juridique        TEXT,
  secteur_activite       TEXT,
  pays                   TEXT DEFAULT 'CG',
  ville                  TEXT,
  adresse                TEXT,
  telephone              TEXT,
  email                  TEXT,
  site_web               TEXT,

  -- Identifiants légaux
  niu                    TEXT,
  rccm                   TEXT,
  sciet                  TEXT,
  scien                  TEXT,
  date_creation_entreprise DATE,

  -- Contact principal
  contact_nom            TEXT,
  contact_prenom         TEXT,
  contact_telephone      TEXT,
  contact_email          TEXT,
  contact_poste          TEXT,

  -- Contrat cabinet-client
  date_debut_mission     DATE DEFAULT CURRENT_DATE,
  date_fin_mission       DATE,
  types_mission          TEXT[] DEFAULT '{}',
  honoraires_mensuel     NUMERIC(12,0) DEFAULT 0,
  devise_honoraires      TEXT DEFAULT 'FCFA',
  periodicite            TEXT DEFAULT 'mensuel'
    CHECK (periodicite IN ('mensuel','trimestriel','semestriel','annuel')),

  -- Frais oraforme (5 000 FCFA/mois par défaut)
  frais_oraforme         NUMERIC(12,0) DEFAULT 5000,
  devise_oraforme        TEXT DEFAULT 'FCFA',

  -- Accès et permissions
  acces_actif            BOOLEAN DEFAULT TRUE,
  modules_autorises      TEXT[] DEFAULT '{}',

  -- Statut
  statut                 TEXT DEFAULT 'actif'
    CHECK (statut IN ('prospect','actif','suspendu','archive','resilie')),

  -- Notes
  notes                  TEXT,
  tags                   TEXT[] DEFAULT '{}',

  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cabinet_clients_policy" ON cabinet_clients;
CREATE POLICY "cabinet_clients_policy" ON cabinet_clients FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cabinet_clients_tenant   ON cabinet_clients(cabinet_tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_cabinet_clients_nom      ON cabinet_clients(cabinet_tenant_id, nom_entreprise);

-- ── 3. Documents partagés cabinet-client ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinet_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  nom                  TEXT NOT NULL,
  type_document        TEXT NOT NULL
    CHECK (type_document IN (
      'bilan','compte_resultat','declaration_tva','declaration_cnss',
      'declaration_patente','declaration_is','rapport_audit','contrat',
      'lettre_mission','facture_honoraires','releve_bancaire','autre'
    )),
  description          TEXT,
  fichier_url          TEXT,
  taille_fichier       INTEGER,

  mois                 INTEGER,
  annee                INTEGER,

  statut               TEXT DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','en_cours','finalise','envoye_client','valide_client')),

  commentaire_cabinet  TEXT,
  commentaire_client   TEXT,

  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cabinet_documents_policy" ON cabinet_documents;
CREATE POLICY "cabinet_documents_policy" ON cabinet_documents FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cabinet_docs_client ON cabinet_documents(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_docs_tenant ON cabinet_documents(cabinet_tenant_id, statut);

-- ── 4. Tâches et missions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinet_taches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id              UUID REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  titre                  TEXT NOT NULL,
  description            TEXT,
  type_tache             TEXT
    CHECK (type_tache IN (
      'declaration_tva','declaration_cnss','declaration_patente',
      'bilan_annuel','audit','conseil','formation','autre'
    )),

  priorite               TEXT DEFAULT 'normale'
    CHECK (priorite IN ('basse','normale','haute','urgente')),
  statut                 TEXT DEFAULT 'a_faire'
    CHECK (statut IN ('a_faire','en_cours','en_attente','termine','annule')),

  assignee_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,

  date_debut             DATE,
  date_echeance          DATE,
  date_completion        DATE,

  temps_estime_heures    NUMERIC(5,1),
  temps_passe_heures     NUMERIC(5,1),

  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_taches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cabinet_taches_policy" ON cabinet_taches;
CREATE POLICY "cabinet_taches_policy" ON cabinet_taches FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cabinet_taches_client  ON cabinet_taches(client_id, statut);
CREATE INDEX IF NOT EXISTS idx_cabinet_taches_tenant  ON cabinet_taches(cabinet_tenant_id, date_echeance);

-- ── 5. Factures honoraires cabinet → client ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinet_factures_honoraires (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id              UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  numero                 TEXT NOT NULL,
  date_facture           DATE DEFAULT CURRENT_DATE,
  date_echeance          DATE,

  periode_debut          DATE,
  periode_fin            DATE,

  lignes                 JSONB DEFAULT '[]',

  montant_ht             NUMERIC(12,0) DEFAULT 0,
  tva                    NUMERIC(12,0) DEFAULT 0,
  ca_additionnel         NUMERIC(12,0) DEFAULT 0,
  montant_ttc            NUMERIC(12,0) DEFAULT 0,

  statut                 TEXT DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','envoyee','payee','retard','annulee')),

  frais_oraforme_inclus  BOOLEAN DEFAULT TRUE,
  frais_oraforme_montant NUMERIC(12,0) DEFAULT 5000,

  pdf_url                TEXT,
  notes                  TEXT,

  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_factures_honoraires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cabinet_factures_policy" ON cabinet_factures_honoraires;
CREATE POLICY "cabinet_factures_policy" ON cabinet_factures_honoraires FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cabinet_fac_client ON cabinet_factures_honoraires(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_fac_tenant ON cabinet_factures_honoraires(cabinet_tenant_id, statut);

-- ── 6. Messages cabinet ↔ client ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinet_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  expediteur           TEXT NOT NULL CHECK (expediteur IN ('cabinet','client')),
  expediteur_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,

  sujet                TEXT,
  contenu              TEXT NOT NULL,
  piece_jointe_url     TEXT,

  lu                   BOOLEAN DEFAULT FALSE,
  lu_at                TIMESTAMPTZ,

  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cabinet_messages_policy" ON cabinet_messages;
CREATE POLICY "cabinet_messages_policy" ON cabinet_messages FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cabinet_msg_client ON cabinet_messages(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_msg_nonlu  ON cabinet_messages(cabinet_tenant_id, lu) WHERE lu = FALSE;

-- ── 7. Revenus oraforme (5 000 FCFA/client/mois) ─────────────────────────────
CREATE TABLE IF NOT EXISTS oraforme_revenue (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  mois                 INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee                INTEGER NOT NULL,
  montant              NUMERIC(12,0) DEFAULT 5000,
  devise               TEXT DEFAULT 'FCFA',

  statut               TEXT DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','facture','paye')),

  date_facturation     DATE,
  date_paiement        DATE,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cabinet_tenant_id, client_id, mois, annee)
);

ALTER TABLE oraforme_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oraforme_revenue_cabinet_policy" ON oraforme_revenue;
CREATE POLICY "oraforme_revenue_cabinet_policy" ON oraforme_revenue FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_oraforme_rev_tenant ON oraforme_revenue(cabinet_tenant_id, annee, mois);

-- ── 8. Fonction : générer revenue mensuel automatique ────────────────────────
CREATE OR REPLACE FUNCTION generer_revenue_mensuel(
  p_cabinet_tenant_id UUID,
  p_mois              INTEGER,
  p_annee             INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, pays, frais_oraforme, devise_oraforme
    FROM cabinet_clients
    WHERE cabinet_tenant_id = p_cabinet_tenant_id
      AND statut = 'actif'
      AND acces_actif = TRUE
  LOOP
    INSERT INTO oraforme_revenue (
      cabinet_tenant_id, client_id, mois, annee,
      montant, devise, statut
    ) VALUES (
      p_cabinet_tenant_id, r.id, p_mois, p_annee,
      COALESCE(r.frais_oraforme, 5000),
      COALESCE(r.devise_oraforme, 'FCFA'),
      'en_attente'
    ) ON CONFLICT (cabinet_tenant_id, client_id, mois, annee) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
