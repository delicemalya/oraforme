-- ============================================================
-- Migration 111 — Module Mise à Disposition du Personnel (MAD)
-- Tables dédiées au secondment / outsourcing RH
-- ============================================================

-- ── 1. Clients MAD ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_clients (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom                     TEXT        NOT NULL,
  secteur_activite        TEXT,
  contact_nom             TEXT,
  contact_email           TEXT,
  contact_tel             TEXT,
  adresse                 TEXT,
  ville                   TEXT,
  taux_facturation_defaut NUMERIC(10,2),
  mode_facturation        TEXT        NOT NULL DEFAULT 'mensuel'
    CHECK (mode_facturation IN ('mensuel','hebdomadaire','journalier','horaire')),
  delai_paiement_jours    INTEGER     DEFAULT 30,
  tva_applicable          BOOLEAN     DEFAULT true,
  actif                   BOOLEAN     DEFAULT true,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mad_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_clients" ON mad_clients
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_clients_tenant_idx ON mad_clients(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_clients TO authenticated;

-- ── 2. Employés mis à disposition ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_employes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom               TEXT        NOT NULL,
  prenom            TEXT        NOT NULL,
  email             TEXT,
  telephone         TEXT,
  date_naissance    DATE,
  numero_cnss       TEXT,
  poste_habituel    TEXT        NOT NULL,
  qualification     TEXT,
  taux_horaire      NUMERIC(10,2),
  salaire_base      NUMERIC(14,2),
  type_contrat      TEXT        NOT NULL DEFAULT 'cdi'
    CHECK (type_contrat IN ('cdi','cdd','interim','vacation')),
  date_embauche     DATE,
  rib               TEXT,
  adresse           TEXT,
  ville             TEXT,
  statut            TEXT        NOT NULL DEFAULT 'disponible'
    CHECK (statut IN ('disponible','affecte','conge','maladie','fin_contrat')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mad_employes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_employes" ON mad_employes
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_employes_tenant_idx  ON mad_employes(tenant_id);
CREATE INDEX IF NOT EXISTS mad_employes_statut_idx  ON mad_employes(tenant_id, statut);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_employes TO authenticated;

-- ── 3. Affectations (cœur du module) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_affectations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id        UUID        NOT NULL REFERENCES mad_employes(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES mad_clients(id) ON DELETE CASCADE,
  poste_client      TEXT        NOT NULL,
  description       TEXT,
  date_debut        DATE        NOT NULL,
  date_fin_prevue   DATE,
  date_fin_reelle   DATE,
  taux_horaire_facture NUMERIC(10,2),
  salaire_mensuel_brut NUMERIC(14,2),
  nb_heures_semaine NUMERIC(5,2) DEFAULT 40,
  statut            TEXT        NOT NULL DEFAULT 'active'
    CHECK (statut IN ('active','terminee','suspendue','en_renouvellement','transfert')),
  motif_fin         TEXT        CHECK (motif_fin IN ('terme','remplacement','transfert','resiliation','depart_volontaire')),
  remplacant_id     UUID        REFERENCES mad_employes(id) ON DELETE SET NULL,
  renouvellements   INTEGER     DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mad_affectations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_affectations" ON mad_affectations
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_affectations_tenant_idx   ON mad_affectations(tenant_id);
CREATE INDEX IF NOT EXISTS mad_affectations_statut_idx   ON mad_affectations(tenant_id, statut);
CREATE INDEX IF NOT EXISTS mad_affectations_date_fin_idx ON mad_affectations(date_fin_prevue);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_affectations TO authenticated;

-- ── 4. Suivi présence mensuel ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_presences (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  affectation_id    UUID        NOT NULL REFERENCES mad_affectations(id) ON DELETE CASCADE,
  employe_id        UUID        NOT NULL REFERENCES mad_employes(id) ON DELETE CASCADE,
  mois              DATE        NOT NULL,
  jours_travailles  NUMERIC(5,2) DEFAULT 0,
  jours_absents     NUMERIC(5,2) DEFAULT 0,
  jours_conges      NUMERIC(5,2) DEFAULT 0,
  heures_normales   NUMERIC(7,2) DEFAULT 0,
  heures_sup        NUMERIC(7,2) DEFAULT 0,
  heures_nuit       NUMERIC(7,2) DEFAULT 0,
  valide            BOOLEAN     DEFAULT false,
  remarques         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (affectation_id, mois)
);

ALTER TABLE mad_presences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_presences" ON mad_presences
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_presences_tenant_idx ON mad_presences(tenant_id);
CREATE INDEX IF NOT EXISTS mad_presences_mois_idx   ON mad_presences(tenant_id, mois);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_presences TO authenticated;

-- ── 5. Factures clients ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_factures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES mad_clients(id) ON DELETE CASCADE,
  reference       TEXT        NOT NULL,
  mois            DATE        NOT NULL,
  date_emission   DATE,
  date_echeance   DATE,
  date_paiement   DATE,
  montant_ht      NUMERIC(14,2) DEFAULT 0,
  tva_taux        NUMERIC(5,2)  DEFAULT 18,
  montant_tva     NUMERIC(14,2) DEFAULT 0,
  montant_ttc     NUMERIC(14,2) DEFAULT 0,
  statut          TEXT        NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','emise','payee','annulee','en_retard')),
  lignes          JSONB       DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mad_factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_factures" ON mad_factures
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_factures_tenant_idx  ON mad_factures(tenant_id);
CREATE INDEX IF NOT EXISTS mad_factures_client_idx  ON mad_factures(client_id);
CREATE INDEX IF NOT EXISTS mad_factures_statut_idx  ON mad_factures(tenant_id, statut);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_factures TO authenticated;

-- ── 6. Fiches de paie ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_paie (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id              UUID        NOT NULL REFERENCES mad_employes(id) ON DELETE CASCADE,
  affectation_id          UUID        REFERENCES mad_affectations(id) ON DELETE SET NULL,
  mois                    DATE        NOT NULL,
  salaire_base            NUMERIC(14,2) DEFAULT 0,
  heures_travaillees      NUMERIC(7,2) DEFAULT 0,
  heures_sup              NUMERIC(7,2) DEFAULT 0,
  taux_heure_sup          NUMERIC(5,2) DEFAULT 1.25,
  prime_presence          NUMERIC(14,2) DEFAULT 0,
  prime_transport         NUMERIC(14,2) DEFAULT 0,
  autres_primes           NUMERIC(14,2) DEFAULT 0,
  salaire_brut            NUMERIC(14,2) DEFAULT 0,
  cotisation_cnss_salarie NUMERIC(14,2) DEFAULT 0,
  cotisation_cnss_patron  NUMERIC(14,2) DEFAULT 0,
  irpp                    NUMERIC(14,2) DEFAULT 0,
  autres_retenues         NUMERIC(14,2) DEFAULT 0,
  salaire_net             NUMERIC(14,2) DEFAULT 0,
  statut                  TEXT        NOT NULL DEFAULT 'calcule'
    CHECK (statut IN ('calcule','valide','paye')),
  date_paiement           DATE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employe_id, mois)
);

ALTER TABLE mad_paie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_paie" ON mad_paie
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_paie_tenant_idx ON mad_paie(tenant_id);
CREATE INDEX IF NOT EXISTS mad_paie_mois_idx   ON mad_paie(tenant_id, mois);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_paie TO authenticated;

-- ── 7. Déclarations CNSS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mad_cnss (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mois                 DATE        NOT NULL,
  nb_employes          INTEGER     DEFAULT 0,
  salaire_brut_total   NUMERIC(14,2) DEFAULT 0,
  cotisation_salarie   NUMERIC(14,2) DEFAULT 0,
  cotisation_patronale NUMERIC(14,2) DEFAULT 0,
  total_cnss           NUMERIC(14,2) DEFAULT 0,
  irpp_total           NUMERIC(14,2) DEFAULT 0,
  date_echeance        DATE,
  statut               TEXT        NOT NULL DEFAULT 'a_declarer'
    CHECK (statut IN ('a_declarer','declare','paye')),
  numero_declaration   TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mois)
);

ALTER TABLE mad_cnss ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_mad_cnss" ON mad_cnss
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));
CREATE INDEX IF NOT EXISTS mad_cnss_tenant_idx ON mad_cnss(tenant_id);
CREATE INDEX IF NOT EXISTS mad_cnss_mois_idx   ON mad_cnss(tenant_id, mois);
GRANT SELECT, INSERT, UPDATE, DELETE ON mad_cnss TO authenticated;
