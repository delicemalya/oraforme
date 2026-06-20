-- Migration 116 : Éléments de paie dynamiques + correction cnss_taux
-- Remplace les primes hardcodées par un système configurable par tenant

-- 1. Corriger cnss_taux dans bulletins_paie (était 0.0504, doit être 0.04 LF2026)
ALTER TABLE bulletins_paie
  ALTER COLUMN cnss_taux SET DEFAULT 0.04;

UPDATE bulletins_paie
  SET cnss_taux = 0.04
  WHERE cnss_taux = 0.0504;

-- 2. Table des éléments de paie configurables
CREATE TABLE IF NOT EXISTS elements_paie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,                -- ex: 'PRIME_ANCIENNETE'
  libelle         TEXT NOT NULL,                -- ex: 'Prime d'ancienneté'
  categorie       TEXT NOT NULL CHECK (categorie IN (
                    'imposable',       -- CNSS + IRPP
                    'non_imposable',   -- exonéré CNSS+IRPP (transport, repas…)
                    'avantage_nature', -- voiture, logement en nature
                    'retenue',         -- déduction (avance, saisie…)
                    'bonus',           -- one-shot imposable
                    'commission',      -- % CA
                    'prime_exceptionnelle'
                  )),
  mode_calcul     TEXT NOT NULL DEFAULT 'fixe' CHECK (mode_calcul IN ('fixe', 'pourcentage_salaire', 'pourcentage_ca')),
  valeur          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- montant fixe ou %
  plafond         NUMERIC(15,2),                      -- plafond mensuel optionnel
  pays            TEXT DEFAULT 'CG',
  actif           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_elements_paie_tenant ON elements_paie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_elements_paie_categorie ON elements_paie(tenant_id, categorie);

-- RLS
ALTER TABLE elements_paie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_elements_paie" ON elements_paie
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() ORDER BY created_at LIMIT 1));

-- 3. Liaison bulletin ↔ éléments appliqués
CREATE TABLE IF NOT EXISTS bulletin_elements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id     UUID NOT NULL REFERENCES bulletins_paie(id) ON DELETE CASCADE,
  element_id      UUID REFERENCES elements_paie(id) ON DELETE SET NULL,
  libelle         TEXT NOT NULL,
  categorie       TEXT NOT NULL,
  montant         NUMERIC(15,2) NOT NULL,
  est_imposable   BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulletin_elements_bulletin ON bulletin_elements(bulletin_id);

ALTER TABLE bulletin_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_bulletin_elements" ON bulletin_elements
  USING (
    bulletin_id IN (
      SELECT bp.id FROM bulletins_paie bp
      JOIN employes e ON e.id = bp.employe_id
      WHERE e.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() ORDER BY created_at LIMIT 1)
    )
  );

-- 4. Éléments prédéfinis Congo LF 2026 (seront dupliqués pour chaque tenant via app)
-- (aucun INSERT ici — les valeurs sont injectées au onboarding)

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_elements_paie_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_elements_paie_updated_at
  BEFORE UPDATE ON elements_paie
  FOR EACH ROW EXECUTE FUNCTION update_elements_paie_updated_at();
