-- =====================================================================
-- 017 : RH Complet — Départements, Postes, Contrats, Matricules
-- =====================================================================

-- ── Départements ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  description TEXT,
  couleur     TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Postes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  departement_id UUID REFERENCES departements(id) ON DELETE SET NULL,
  titre          TEXT NOT NULL,
  niveau         TEXT NOT NULL DEFAULT 'agent'
                 CHECK (niveau IN ('direction', 'cadre', 'technicien', 'agent')),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Enrichissement de la table employes ───────────────────────────────
ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS matricule      TEXT,
  ADD COLUMN IF NOT EXISTS agent_code     TEXT,
  ADD COLUMN IF NOT EXISTS nationalite    TEXT DEFAULT 'Congolaise',
  ADD COLUMN IF NOT EXISTS adresse        TEXT,
  ADD COLUMN IF NOT EXISTS photo_url      TEXT,
  ADD COLUMN IF NOT EXISTS departement_id UUID REFERENCES departements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id     UUID REFERENCES employes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employes_matricule
  ON employes(tenant_id, matricule)
  WHERE matricule IS NOT NULL;

-- ── Contrats ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contrats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id     UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  type_contrat   TEXT NOT NULL DEFAULT 'cdi'
                 CHECK (type_contrat IN ('cdi', 'cdd', 'stage', 'freelance')),
  date_debut     DATE NOT NULL,
  date_fin       DATE,
  salaire_base   NUMERIC(12,2) NOT NULL DEFAULT 0,
  primes         NUMERIC(12,2) NOT NULL DEFAULT 0,
  periode_essai  INTEGER NOT NULL DEFAULT 0,
  lieu_travail   TEXT,
  description    TEXT,
  clauses        TEXT,
  statut         TEXT NOT NULL DEFAULT 'actif'
                 CHECK (statut IN ('actif', 'termine', 'suspendu')),
  signe_le       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Paramètres de paie configurables ─────────────────────────────────
CREATE TABLE IF NOT EXISTS parametres_paie (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  taux_cnss_salarie  NUMERIC(6,4) NOT NULL DEFAULT 0.0504,
  taux_cnss_patronal NUMERIC(6,4) NOT NULL DEFAULT 0.1416,
  plafond_cnss       NUMERIC(12,0) NOT NULL DEFAULT 3375000,
  tranches_irpp      JSONB NOT NULL DEFAULT '[
    {"min":0,"max":50000,"taux":0},
    {"min":50000,"max":100000,"taux":0.01},
    {"min":100000,"max":250000,"taux":0.10},
    {"min":250000,"max":500000,"taux":0.20},
    {"min":500000,"max":null,"taux":0.30}
  ]'::jsonb,
  abattement_irpp    NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_departements_tenant ON departements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_postes_tenant        ON postes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_postes_dept          ON postes(departement_id);
CREATE INDEX IF NOT EXISTS idx_contrats_tenant      ON contrats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contrats_employe     ON contrats(employe_id);
CREATE INDEX IF NOT EXISTS idx_employes_manager     ON employes(manager_id);
CREATE INDEX IF NOT EXISTS idx_employes_dept        ON employes(departement_id);

-- ── Row Level Security ─────────────────────────────────────────────────
ALTER TABLE departements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE postes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametres_paie ENABLE ROW LEVEL SECURITY;

-- Départements
CREATE POLICY "depts: select" ON departements FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "depts: insert" ON departements FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "depts: update" ON departements FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "depts: delete" ON departements FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Postes
CREATE POLICY "postes: select" ON postes FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "postes: insert" ON postes FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "postes: update" ON postes FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "postes: delete" ON postes FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Contrats
CREATE POLICY "contrats: select" ON contrats FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "contrats: insert" ON contrats FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "contrats: update" ON contrats FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "contrats: delete" ON contrats FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Paramètres paie
CREATE POLICY "params_paie: all" ON parametres_paie
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── Fonction : génération automatique du matricule ────────────────────
CREATE OR REPLACE FUNCTION generate_matricule(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year  TEXT;
  v_count INTEGER;
BEGIN
  v_year := to_char(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM employes
  WHERE tenant_id = p_tenant_id
    AND matricule LIKE 'EMP-' || v_year || '-%';
  RETURN 'EMP-' || v_year || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;
