-- ============================================================
-- Migration 109 — Secteur Recrutement & Placement RH
-- Tables spécifiques au secteur recrutement (préfixe rh_)
-- Les tables existantes (offres_emploi, candidatures, entretiens,
-- cv_candidats) restent inchangées pour la compatibilité.
-- ============================================================

-- ── 1. Placements ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rh_placements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id       UUID        REFERENCES cv_candidats(id) ON DELETE SET NULL,
  offre_id          UUID        REFERENCES offres_emploi(id) ON DELETE SET NULL,
  entreprise_cliente TEXT        NOT NULL,
  poste             TEXT        NOT NULL,
  type_contrat      TEXT        NOT NULL CHECK (type_contrat IN ('cdi','cdd','stage','interim','freelance','alternance','vacation')),
  date_debut        DATE,
  date_fin          DATE,
  salaire_mensuel   NUMERIC(14,2),
  commission_fcfa   NUMERIC(14,2),
  statut            TEXT        NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','essai','termine','annule')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_placements" ON rh_placements
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_placements_tenant_idx ON rh_placements(tenant_id);
CREATE INDEX IF NOT EXISTS rh_placements_statut_idx  ON rh_placements(tenant_id, statut);

-- ── 2. Partenaires RH ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rh_partenaires (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom              TEXT        NOT NULL,
  type             TEXT        NOT NULL CHECK (type IN ('client_entreprise','source_candidats','partenaire_rh','sous_traitant')),
  secteur_activite TEXT,
  contact_nom      TEXT,
  contact_email    TEXT,
  contact_tel      TEXT,
  site_web         TEXT,
  commission_taux  NUMERIC(5,2),
  nb_placements    INTEGER     NOT NULL DEFAULT 0,
  ca_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  actif            BOOLEAN     NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_partenaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_partenaires" ON rh_partenaires
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_partenaires_tenant_idx ON rh_partenaires(tenant_id);

-- ── 3. Contrats d'embauche émis par l'agence ─────────────────────────────────

CREATE TABLE IF NOT EXISTS rh_contrats (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference           TEXT        NOT NULL,
  candidat_id         UUID        REFERENCES cv_candidats(id) ON DELETE SET NULL,
  placement_id        UUID        REFERENCES rh_placements(id) ON DELETE SET NULL,
  entreprise_cliente  TEXT        NOT NULL,
  poste               TEXT        NOT NULL,
  type_contrat        TEXT        NOT NULL,
  date_signature      DATE,
  salaire_brut        NUMERIC(14,2),
  statut              TEXT        NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','signe','refuse','expire')),
  document_url        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_contrats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_contrats" ON rh_contrats
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_contrats_tenant_idx ON rh_contrats(tenant_id);

-- ── 4. Vivier de talents (profils passifs pré-qualifiés) ──────────────────────

CREATE TABLE IF NOT EXISTS rh_vivier (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id          UUID          REFERENCES cv_candidats(id) ON DELETE SET NULL,
  secteurs_interet     TEXT[],
  competences_cles     TEXT[],
  type_contrat_souhaite TEXT,
  salaire_min          NUMERIC(14,2),
  salaire_max          NUMERIC(14,2),
  disponibilite        DATE,
  localisation         TEXT,
  statut               TEXT          NOT NULL DEFAULT 'disponible' CHECK (statut IN ('disponible','en_poste','non_disponible')),
  dernier_contact      TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE rh_vivier ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_vivier" ON rh_vivier
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_vivier_tenant_idx  ON rh_vivier(tenant_id);
CREATE INDEX IF NOT EXISTS rh_vivier_statut_idx  ON rh_vivier(tenant_id, statut);

-- ── 5. Missions intérim / Mise à disposition ──────────────────────────────────

CREATE TABLE IF NOT EXISTS rh_missions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id         UUID        REFERENCES cv_candidats(id) ON DELETE SET NULL,
  partenaire_id       UUID        REFERENCES rh_partenaires(id) ON DELETE SET NULL,
  intitule            TEXT        NOT NULL,
  entreprise_utilisatrice TEXT    NOT NULL,
  date_debut          DATE        NOT NULL,
  date_fin            DATE,
  taux_journalier     NUMERIC(10,2),
  taux_horaire        NUMERIC(10,2),
  statut              TEXT        NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','terminee','interrompue','suspendue')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_missions" ON rh_missions
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_missions_tenant_idx ON rh_missions(tenant_id);

-- ── 6. Analytics recrutement (snapshots mensuels) ────────────────────────────

CREATE TABLE IF NOT EXISTS rh_analytics_snapshots (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periode                   DATE        NOT NULL,
  nb_offres_publiees        INTEGER     DEFAULT 0,
  nb_candidatures           INTEGER     DEFAULT 0,
  nb_entretiens             INTEGER     DEFAULT 0,
  nb_placements             INTEGER     DEFAULT 0,
  taux_transformation       NUMERIC(5,2),
  delai_moyen_recrutement   INTEGER,
  cout_moyen_recrutement    NUMERIC(14,2),
  score_moyen_candidats     NUMERIC(5,2),
  ca_commissions            NUMERIC(14,2) DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rh_analytics" ON rh_analytics_snapshots
  USING (tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() ORDER BY created_at LIMIT 1));

CREATE INDEX IF NOT EXISTS rh_analytics_tenant_idx   ON rh_analytics_snapshots(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS rh_analytics_period_idx ON rh_analytics_snapshots(tenant_id, periode);

-- ── 7. Extension table offres_emploi (colonnes supplémentaires) ───────────────
-- Ajout de colonnes optionnelles si elles n'existent pas encore

ALTER TABLE offres_emploi
  ADD COLUMN IF NOT EXISTS nombre_postes     INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS salaire_min       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS salaire_max       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS date_fermeture_prevue DATE,
  ADD COLUMN IF NOT EXISTS type_contrat      TEXT,
  ADD COLUMN IF NOT EXISTS localisation      TEXT,
  ADD COLUMN IF NOT EXISTS niveau_etudes     TEXT,
  ADD COLUMN IF NOT EXISTS experience_requise TEXT;

-- ── 8. Extension table entretiens (colonnes supplémentaires) ─────────────────
ALTER TABLE entretiens
  ADD COLUMN IF NOT EXISTS type    TEXT DEFAULT 'presentiel',
  ADD COLUMN IF NOT EXISTS statut  TEXT DEFAULT 'planifie',
  ADD COLUMN IF NOT EXISTS notes   TEXT,
  ADD COLUMN IF NOT EXISTS evaluateur TEXT;

-- ── Grants pour les rôles supabase ────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_placements          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_partenaires         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_contrats            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_vivier              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_missions            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rh_analytics_snapshots TO authenticated;
