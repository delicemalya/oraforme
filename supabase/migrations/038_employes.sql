-- 038: table employes — dossier RH complet et centralisé
DROP TABLE IF EXISTS employes CASCADE;

CREATE TABLE employes (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identité
  nom                    TEXT        NOT NULL,
  postnom                TEXT        DEFAULT NULL,
  prenom                 TEXT        NOT NULL,
  sexe                   TEXT        DEFAULT NULL,
  date_naissance         DATE        DEFAULT NULL,
  nationalite            TEXT        DEFAULT NULL,
  situation_matrimoniale TEXT        DEFAULT NULL,
  nb_enfants             INTEGER     NOT NULL DEFAULT 0,

  -- Coordonnées
  telephone              TEXT        DEFAULT NULL,
  telephone2             TEXT        DEFAULT NULL,
  email_pro              TEXT        DEFAULT NULL,
  adresse                TEXT        DEFAULT NULL,
  ville                  TEXT        DEFAULT NULL,
  pays                   TEXT        DEFAULT NULL,
  photo_url              TEXT        DEFAULT NULL,

  -- Poste
  poste                  TEXT        NOT NULL,
  departement            TEXT        DEFAULT NULL,
  type_employe           TEXT        NOT NULL DEFAULT 'permanent',
  statut                 TEXT        NOT NULL DEFAULT 'actif',
  date_recrutement       DATE        DEFAULT NULL,
  date_debut_contrat     DATE        DEFAULT NULL,
  date_fin_contrat       DATE        DEFAULT NULL,
  periode_essai          INTEGER     DEFAULT NULL,

  -- Formateur
  matieres               TEXT[]      DEFAULT NULL,
  filieres               TEXT[]      DEFAULT NULL,
  heures_prevues         INTEGER     DEFAULT NULL,

  -- Accès système
  email_connexion        TEXT        DEFAULT NULL,
  roles_systeme          JSONB       NOT NULL DEFAULT '{}',
  permissions            JSONB       NOT NULL DEFAULT '{}',

  -- Rémunération
  salaire_base           INTEGER     NOT NULL DEFAULT 0,
  taux_horaire           INTEGER     DEFAULT NULL,
  prime_logement         INTEGER     NOT NULL DEFAULT 0,
  prime_transport        INTEGER     NOT NULL DEFAULT 0,
  prime_risque           INTEGER     NOT NULL DEFAULT 0,
  prime_rendement        INTEGER     NOT NULL DEFAULT 0,
  numero_cnss            TEXT        DEFAULT NULL,
  numero_fiscal          TEXT        DEFAULT NULL,

  -- Paiement
  mode_paiement          TEXT        NOT NULL DEFAULT 'banque',
  banque                 TEXT        DEFAULT NULL,
  rib                    TEXT        DEFAULT NULL,
  mobile_money_type      TEXT        DEFAULT NULL,
  mobile_money_numero    TEXT        DEFAULT NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE employes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_employes" ON employes
  USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Index
CREATE INDEX IF NOT EXISTS employes_tenant_idx ON employes (tenant_id);
CREATE INDEX IF NOT EXISTS employes_statut_idx ON employes (tenant_id, statut);
