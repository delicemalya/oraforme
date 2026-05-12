-- =====================================================================
-- 018 : École Complet — Enseignants, Classes, Planning, Portail
-- =====================================================================

-- ── Enseignants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enseignants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  prenom      TEXT NOT NULL,
  matiere     TEXT,
  telephone   TEXT,
  email       TEXT,
  statut      TEXT NOT NULL DEFAULT 'actif'
              CHECK (statut IN ('actif', 'conge', 'inactif')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Classes / Sections ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes_ecole (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  niveau         TEXT NOT NULL DEFAULT 'lycee',
  annee_scolaire TEXT NOT NULL DEFAULT '2024-2025',
  enseignant_id  UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  nb_places      INTEGER NOT NULL DEFAULT 30,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Planning & Calendrier scolaire ────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_ecole (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titre       TEXT NOT NULL,
  description TEXT,
  date_debut  DATE NOT NULL,
  date_fin    DATE,
  type        TEXT NOT NULL DEFAULT 'evenement'
              CHECK (type IN ('examen', 'conge_scolaire', 'evenement', 'conseil', 'autre')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Enrichissement : notes publiées ───────────────────────────────────
ALTER TABLE notes_etudiants
  ADD COLUMN IF NOT EXISTS publie BOOLEAN NOT NULL DEFAULT false;

-- ── Enrichissement : notification parent pour absence ─────────────────
ALTER TABLE absences_etudiants
  ADD COLUMN IF NOT EXISTS notifie_parent BOOLEAN NOT NULL DEFAULT false;

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enseignants_tenant ON enseignants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant     ON classes_ecole(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planning_tenant    ON planning_ecole(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planning_date      ON planning_ecole(date_debut);

-- ── Row Level Security ─────────────────────────────────────────────────
ALTER TABLE enseignants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes_ecole  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_ecole ENABLE ROW LEVEL SECURITY;

-- Enseignants
CREATE POLICY "enseignants: select" ON enseignants FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "enseignants: insert" ON enseignants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "enseignants: update" ON enseignants FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "enseignants: delete" ON enseignants FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Classes
CREATE POLICY "classes: select" ON classes_ecole FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "classes: insert" ON classes_ecole FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "classes: update" ON classes_ecole FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "classes: delete" ON classes_ecole FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Planning
CREATE POLICY "planning: select" ON planning_ecole FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "planning: insert" ON planning_ecole FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "planning: update" ON planning_ecole FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "planning: delete" ON planning_ecole FOR DELETE USING (tenant_id = get_my_tenant_id());
