-- ============================================================
-- Migration 012 : RH Recrutement — politiques manquantes
-- Complète migration 005 (cv_screening) avec UPDATE/DELETE
-- ============================================================

-- UPDATE/DELETE for offres_emploi (missing from 005)
CREATE POLICY "upd_offres"  ON offres_emploi FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_offres"  ON offres_emploi FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Fix INSERT for cv_candidats: restrict to tenant (005 used WITH CHECK (true))
DROP POLICY IF EXISTS "insert_candidats" ON cv_candidats;
CREATE POLICY "insert_candidats" ON cv_candidats FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

-- UPDATE/DELETE for cv_candidats
CREATE POLICY "upd_candidats" ON cv_candidats FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_candidats" ON cv_candidats FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Table entretiens (scheduling interviews after CV screening)
CREATE TABLE IF NOT EXISTS entretiens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  candidat_id  UUID REFERENCES cv_candidats(id) ON DELETE CASCADE,
  offre_id     UUID REFERENCES offres_emploi(id) ON DELETE SET NULL,
  date_heure   TIMESTAMPTZ NOT NULL,
  lieu         TEXT,
  type         TEXT DEFAULT 'presentiel', -- presentiel | visio | telephone
  statut       TEXT DEFAULT 'planifie',   -- planifie | effectue | annule | reporte
  notes        TEXT,
  evaluateur   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entretiens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_entretiens" ON entretiens           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_entretiens" ON entretiens FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_entretiens" ON entretiens FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_entretiens" ON entretiens FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_entr_tenant    ON entretiens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entr_candidat  ON entretiens(candidat_id);
CREATE INDEX IF NOT EXISTS idx_entr_date      ON entretiens(date_heure);

-- Note: Create a private "cv-files" bucket in Supabase Storage dashboard
-- Storage → New bucket → name: cv-files → Public: false
-- Used by recrutement page for CV file uploads.
