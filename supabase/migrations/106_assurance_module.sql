-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 106 — Module Assurance Oraforme
-- Vie / Non-vie · Compagnies · Courtiers · Agents
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PRODUITS ASSURANCE (catalogue tarifaire) ───────────────────────────────
CREATE TABLE IF NOT EXISTS ass_produits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom_produit      TEXT NOT NULL,
  type_police      TEXT NOT NULL CHECK (type_police IN (
    'vie','auto','habitation','sante','responsabilite_civile',
    'transport','agricole','maritime','aviation','voyage','incendie'
  )),
  description      TEXT,
  garanties        JSONB    DEFAULT '[]',
  exclusions       JSONB    DEFAULT '[]',
  prime_base       NUMERIC(15,2) DEFAULT 0,
  franchise_defaut NUMERIC(15,2) DEFAULT 0,
  duree_mois       INT      DEFAULT 12,
  actif            BOOLEAN  DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 2. AGENTS & COURTIERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ass_agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom              TEXT NOT NULL,
  prenom           TEXT,
  type_agent       TEXT NOT NULL CHECK (type_agent IN ('agent','courtier','apporteur')),
  numero_agrement  TEXT,
  telephone        TEXT,
  email            TEXT,
  adresse          TEXT,
  taux_commission  NUMERIC(5,2) DEFAULT 10.00 CHECK (taux_commission BETWEEN 0 AND 100),
  actif            BOOLEAN  DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 3. POLICES (contrats d'assurance) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ass_polices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_police    TEXT,
  produit_id       UUID REFERENCES ass_produits(id) ON DELETE SET NULL,
  type_police      TEXT NOT NULL CHECK (type_police IN (
    'vie','auto','habitation','sante','responsabilite_civile',
    'transport','agricole','maritime','aviation','voyage','incendie'
  )),

  -- Assuré
  assure_nom       TEXT NOT NULL,
  assure_email     TEXT,
  assure_telephone TEXT,
  assure_type      TEXT DEFAULT 'particulier' CHECK (assure_type IN ('particulier','entreprise','groupe')),

  -- Distribution
  agent_id         UUID REFERENCES ass_agents(id) ON DELETE SET NULL,

  -- Dates
  date_effet       DATE NOT NULL,
  date_echeance    DATE NOT NULL,

  -- Financier
  prime_montant    NUMERIC(15,2) NOT NULL DEFAULT 0,
  prime_frequence  TEXT DEFAULT 'annuelle' CHECK (prime_frequence IN ('mensuelle','trimestrielle','semestrielle','annuelle')),
  capital_assure   NUMERIC(15,2) DEFAULT 0,
  franchise        NUMERIC(15,2) DEFAULT 0,

  -- Bénéficiaires (vie)
  beneficiaires    JSONB DEFAULT '[]',

  -- Statut
  statut           TEXT DEFAULT 'en_attente' CHECK (statut IN ('active','suspendue','resiliee','expiree','en_attente')),

  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 4. SINISTRES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ass_sinistres (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  police_id           UUID NOT NULL REFERENCES ass_polices(id) ON DELETE CASCADE,
  numero_sinistre     TEXT,

  date_declaration    DATE NOT NULL DEFAULT CURRENT_DATE,
  date_survenance     DATE,

  type_sinistre       TEXT,
  description         TEXT,

  montant_estime      NUMERIC(15,2) DEFAULT 0,
  montant_expertise   NUMERIC(15,2) DEFAULT 0,
  montant_paye        NUMERIC(15,2) DEFAULT 0,

  statut              TEXT DEFAULT 'declare' CHECK (statut IN (
    'declare','en_instruction','expertise','accepte','refuse','clos'
  )),

  expert_nom          TEXT,
  expert_rapport      TEXT,
  documents           JSONB DEFAULT '[]',
  historique_statuts  JSONB DEFAULT '[]',

  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 5. PARTENAIRES (réassureurs, garages, experts, cliniques, avocats) ────────
CREATE TABLE IF NOT EXISTS ass_partenaires (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom              TEXT NOT NULL,
  type_partenaire  TEXT NOT NULL CHECK (type_partenaire IN (
    'reassureur','garage','expert','hopital','avocat','clinique','autre'
  )),
  contact_nom      TEXT,
  telephone        TEXT,
  email            TEXT,
  adresse          TEXT,
  contrat_cadre    TEXT,
  taux_commission  NUMERIC(5,2) DEFAULT 0,
  conditions       TEXT,
  actif            BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 6. COMMISSIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ass_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  police_id        UUID NOT NULL REFERENCES ass_polices(id) ON DELETE CASCADE,
  agent_id         UUID NOT NULL REFERENCES ass_agents(id) ON DELETE CASCADE,
  montant          NUMERIC(15,2) NOT NULL DEFAULT 0,
  taux             NUMERIC(5,2)  DEFAULT 0,
  statut_paiement  TEXT DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente','paye','annule')),
  date_paiement    DATE,
  periode          TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 7. RÉASSURANCE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ass_reassurance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  police_id        UUID REFERENCES ass_polices(id) ON DELETE SET NULL,
  partenaire_id    UUID REFERENCES ass_partenaires(id) ON DELETE SET NULL,
  type_traite      TEXT DEFAULT 'proportionnelle' CHECK (type_traite IN (
    'proportionnelle','non_proportionnelle','facultative','obligatoire'
  )),
  quote_part       NUMERIC(5,2)  DEFAULT 0 CHECK (quote_part BETWEEN 0 AND 100),
  montant_cede     NUMERIC(15,2) DEFAULT 0,
  prime_cedee      NUMERIC(15,2) DEFAULT 0,
  statut           TEXT DEFAULT 'actif' CHECK (statut IN ('actif','expire','resilie')),
  date_debut       DATE,
  date_fin         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── Auto-numérotation polices ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_ass_police_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(numero_police, '[^0-9]', '', 'g') AS INT)), 0
  ) + 1 INTO v_seq
  FROM ass_polices
  WHERE tenant_id = NEW.tenant_id AND numero_police IS NOT NULL;
  NEW.numero_police := 'POL-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_ass_police_numero
  BEFORE INSERT ON ass_polices
  FOR EACH ROW WHEN (NEW.numero_police IS NULL)
  EXECUTE FUNCTION fn_ass_police_numero();

-- ── Auto-numérotation sinistres ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_ass_sinistre_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(numero_sinistre, '[^0-9]', '', 'g') AS INT)), 0
  ) + 1 INTO v_seq
  FROM ass_sinistres
  WHERE tenant_id = NEW.tenant_id AND numero_sinistre IS NOT NULL;
  NEW.numero_sinistre := 'SIN-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_ass_sinistre_numero
  BEFORE INSERT ON ass_sinistres
  FOR EACH ROW WHEN (NEW.numero_sinistre IS NULL)
  EXECUTE FUNCTION fn_ass_sinistre_numero();

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ass_polices_tenant    ON ass_polices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ass_polices_statut    ON ass_polices(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_ass_polices_type      ON ass_polices(tenant_id, type_police);
CREATE INDEX IF NOT EXISTS idx_ass_sinistres_tenant  ON ass_sinistres(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ass_sinistres_police  ON ass_sinistres(police_id);
CREATE INDEX IF NOT EXISTS idx_ass_sinistres_statut  ON ass_sinistres(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_ass_commissions_agent ON ass_commissions(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_ass_produits_type     ON ass_produits(tenant_id, type_police);

-- ── RLS (Row Level Security) — isolation par tenant ───────────────────────────
ALTER TABLE ass_produits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_polices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_sinistres   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_partenaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ass_reassurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_ass_produits"
  ON ass_produits USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_agents"
  ON ass_agents USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_polices"
  ON ass_polices USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_sinistres"
  ON ass_sinistres USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_partenaires"
  ON ass_partenaires USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_commissions"
  ON ass_commissions USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_iso_ass_reassurance"
  ON ass_reassurance USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
