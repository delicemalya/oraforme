-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 117 — Dossier Employé Professionnel (SAP/Workday level)
-- Étend la table employes + crée primes_employe + avantages_nature_employe
-- Compatible multi-pays via CountryConfig — aucune valeur fiscale hardcodée
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extension table employes ──────────────────────────────────────────────────

-- Identité complémentaire
ALTER TABLE employes ADD COLUMN IF NOT EXISTS lieu_naissance       TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS email_personnel      TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS signature_url        TEXT    DEFAULT NULL;

-- Coordonnées étendues
ALTER TABLE employes ADD COLUMN IF NOT EXISTS region               TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS quartier             TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS contact_urgence_nom  TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS contact_urgence_tel  TEXT    DEFAULT NULL;

-- Organisation étendue
ALTER TABLE employes ADD COLUMN IF NOT EXISTS filiale              TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS agence               TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS direction            TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS service              TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS equipe               TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS site_travail         TEXT    DEFAULT NULL;

-- manager_id (référence auto-jointure — nullable, pas de contrainte CASCADE pour éviter orphelins)
ALTER TABLE employes ADD COLUMN IF NOT EXISTS manager_id           UUID    DEFAULT NULL
  REFERENCES employes(id) ON DELETE SET NULL;

-- Poste & Convention
ALTER TABLE employes ADD COLUMN IF NOT EXISTS metier               TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS famille_metier       TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS niveau_hierarchique  TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS categorie_convention TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS echelon              TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS grade                TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS coefficient          NUMERIC DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS code_secteur         TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS salaire_conventionnel INTEGER DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS motif_sortie         TEXT    DEFAULT NULL;

-- Fiscal étendu
ALTER TABLE employes ADD COLUMN IF NOT EXISTS pays_fiscal          TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS residence_fiscale    TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS numero_cnss_centre   TEXT    DEFAULT NULL;

-- Paiement étendu
ALTER TABLE employes ADD COLUMN IF NOT EXISTS iban                 TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS swift                TEXT    DEFAULT NULL;

-- Médical
ALTER TABLE employes ADD COLUMN IF NOT EXISTS groupe_sanguin       TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS allergies            TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS handicap             BOOLEAN DEFAULT FALSE;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS medecin_traitant     TEXT    DEFAULT NULL;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS date_visite_medicale DATE    DEFAULT NULL;

-- Index pour les nouvelles colonnes fréquemment filtrées
CREATE INDEX IF NOT EXISTS employes_manager_id_idx    ON employes (manager_id);
CREATE INDEX IF NOT EXISTS employes_code_secteur_idx  ON employes (tenant_id, code_secteur);
CREATE INDEX IF NOT EXISTS employes_filiale_idx       ON employes (tenant_id, filiale);

-- ── Table primes_employe — Bibliothèque de primes dynamique ──────────────────

CREATE TABLE IF NOT EXISTS primes_employe (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID        NOT NULL REFERENCES employes(id) ON DELETE CASCADE,

  code            TEXT        NOT NULL,   -- 'anciennete', 'transport', 'rendement', etc.
  nom             TEXT        NOT NULL,   -- Libellé affiché
  categorie       TEXT        NOT NULL DEFAULT 'rh',
  -- 'rh' | 'logistique' | 'social' | 'technique' | 'commercial' | 'medical' | 'personnalise'

  montant         NUMERIC(12,0) NOT NULL DEFAULT 0,
  type            TEXT        NOT NULL DEFAULT 'fixe',
  -- 'fixe' | 'pct_brut' | 'pct_base'

  periodicite     TEXT        NOT NULL DEFAULT 'mensuel',
  -- 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel'

  -- Règles fiscales/sociales (lues depuis CountryConfig par le moteur)
  imposable       BOOLEAN     NOT NULL DEFAULT TRUE,
  soumis_cnss     BOOLEAN     NOT NULL DEFAULT TRUE,
  soumis_irpp     BOOLEAN     NOT NULL DEFAULT TRUE,
  conventionnelle BOOLEAN     NOT NULL DEFAULT FALSE,

  actif           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT primes_employe_categorie_check CHECK (
    categorie IN ('rh','logistique','social','technique','commercial','medical','personnalise')
  ),
  CONSTRAINT primes_employe_type_check CHECK (
    type IN ('fixe','pct_brut','pct_base')
  ),
  CONSTRAINT primes_employe_periodicite_check CHECK (
    periodicite IN ('mensuel','trimestriel','annuel','ponctuel')
  )
);

ALTER TABLE primes_employe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_primes_employe" ON primes_employe
  USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

CREATE INDEX IF NOT EXISTS primes_employe_employe_idx ON primes_employe (employe_id, actif);
CREATE INDEX IF NOT EXISTS primes_employe_tenant_idx  ON primes_employe (tenant_id);

-- ── Table avantages_nature_employe — Avantages en nature ─────────────────────

CREATE TABLE IF NOT EXISTS avantages_nature_employe (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id          UUID        NOT NULL REFERENCES employes(id) ON DELETE CASCADE,

  type                TEXT        NOT NULL,
  -- 'logement' | 'vehicule' | 'carburant' | 'telephone' | 'internet'
  -- | 'nourriture' | 'assurance_sante' | 'assurance_vie' | 'autre'

  libelle             TEXT        NOT NULL,
  valeur              NUMERIC(12,0) NOT NULL DEFAULT 0,

  -- Règles (à vérifier selon CountryConfig du pays de l'employé)
  imposable           BOOLEAN     NOT NULL DEFAULT TRUE,
  soumis_cotisations  BOOLEAN     NOT NULL DEFAULT TRUE,

  actif               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT avantages_nature_type_check CHECK (
    type IN ('logement','vehicule','carburant','telephone','internet',
             'nourriture','assurance_sante','assurance_vie','autre')
  )
);

ALTER TABLE avantages_nature_employe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_avantages_nature_employe" ON avantages_nature_employe
  USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

CREATE INDEX IF NOT EXISTS avantages_nature_employe_idx ON avantages_nature_employe (employe_id, actif);

-- ── Trigger updated_at pour primes_employe ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_primes_employe_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_primes_employe_updated_at ON primes_employe;
CREATE TRIGGER trg_primes_employe_updated_at
  BEFORE UPDATE ON primes_employe
  FOR EACH ROW EXECUTE FUNCTION update_primes_employe_updated_at();
