-- ============================================================
-- Migration 005 : CV Screening IA
-- À exécuter dans Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS offres_emploi (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  titre            TEXT NOT NULL,
  description      TEXT,
  criteres         JSONB DEFAULT '{}',
  mots_cles        TEXT[] DEFAULT '{}',
  niveau_requis    TEXT,
  experience_min   INTEGER DEFAULT 0,
  langues_requises TEXT[] DEFAULT '{}',
  statut           TEXT DEFAULT 'active',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cv_candidats (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  offre_id            UUID REFERENCES offres_emploi(id) ON DELETE SET NULL,
  nom                 TEXT,
  email               TEXT,
  telephone           TEXT,
  niveau_etudes       TEXT,
  annees_experience   INTEGER DEFAULT 0,
  langues             TEXT[] DEFAULT '{}',
  competences         TEXT[] DEFAULT '{}',
  score               INTEGER DEFAULT 0,
  resume_court        TEXT,
  points_forts        TEXT[] DEFAULT '{}',
  points_faibles      TEXT[] DEFAULT '{}',
  recommande          BOOLEAN DEFAULT false,
  statut              TEXT DEFAULT 'nouveau',
  fichier_url         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE offres_emploi ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_candidats  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_offres" ON offres_emploi
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_candidats" ON cv_candidats
  USING (tenant_id = get_my_tenant_id());

-- INSERT policies
CREATE POLICY "insert_offres" ON offres_emploi FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "insert_candidats" ON cv_candidats FOR INSERT
  WITH CHECK (true); -- service_role uniquement via API

-- Index performance
CREATE INDEX IF NOT EXISTS idx_offres_tenant    ON offres_emploi(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidats_tenant  ON cv_candidats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidats_offre   ON cv_candidats(offre_id);
CREATE INDEX IF NOT EXISTS idx_candidats_score   ON cv_candidats(score DESC);

-- Bucket Storage : créer manuellement dans Supabase Dashboard
-- Storage → New bucket → "cv-files" → Private
