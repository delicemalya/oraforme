-- ============================================================
-- Migration 070 : Déclaration de Patente 721M — Congo-Brazzaville
-- Formulaire officiel DGID · Direction Générale des Impôts et des Domaines
-- Calculs conformes au CGI Congo (Art. 235 et suivants)
-- ============================================================

CREATE TABLE IF NOT EXISTS declarations_patente (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annee                   INT         NOT NULL,

  -- Section A : Identification de l'entreprise
  niu                     TEXT,
  scien                   TEXT,
  rccm                    TEXT,
  denomination            TEXT,
  forme_juridique         TEXT,
  secteur_activite        TEXT,
  adresse_siege           TEXT,
  telephone               TEXT,
  email                   TEXT,
  representant_legal      TEXT,
  qualite_representant    TEXT,

  -- Section B : Calcul de la patente
  nature_activite         TEXT,
  date_debut_activite     DATE,
  nb_etablissements       INT         NOT NULL DEFAULT 1,
  ca_annuel               BIGINT      NOT NULL DEFAULT 0,
  ca_exonere              BIGINT      NOT NULL DEFAULT 0,
  ca_imposable            BIGINT      NOT NULL DEFAULT 0,
  taux_applicable         NUMERIC(5,4) NOT NULL DEFAULT 0,
  patente_liquidee        BIGINT      NOT NULL DEFAULT 0,
  est_societe_petroliere  BOOLEAN     NOT NULL DEFAULT FALSE,
  montant_reduction       BIGINT      NOT NULL DEFAULT 0,
  patente_apres_reduction BIGINT      NOT NULL DEFAULT 0,
  centimes_additionnels   BIGINT      NOT NULL DEFAULT 0,
  camu                    BIGINT      NOT NULL DEFAULT 0,
  credit_n1               BIGINT      NOT NULL DEFAULT 0,
  patente_nette           BIGINT      NOT NULL DEFAULT 0,
  montant_en_lettres      TEXT,

  -- Section C : Répartition par département
  -- Format : [{ code, nom, ca, pourcentage }]
  repartition_departements JSONB      NOT NULL DEFAULT '[]'::JSONB,

  -- Signature
  lieu_signature          TEXT,
  date_signature          DATE,

  -- Workflow
  statut                  TEXT        NOT NULL DEFAULT 'brouillon'
                          CHECK (statut IN ('brouillon', 'complete', 'soumise')),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, annee)
);

ALTER TABLE declarations_patente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_declarations_patente" ON declarations_patente
  FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_declarations_patente_tenant ON declarations_patente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_declarations_patente_annee  ON declarations_patente(tenant_id, annee DESC);

CREATE OR REPLACE FUNCTION update_declarations_patente_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_declarations_patente_updated_at
  BEFORE UPDATE ON declarations_patente
  FOR EACH ROW EXECUTE FUNCTION update_declarations_patente_updated_at();
