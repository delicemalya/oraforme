-- ============================================================
-- Migration 011 : École & Université — complément
-- Adds attendance tracking + missing policies
-- ============================================================

-- Table absences (présences/absences par étudiant)
CREATE TABLE IF NOT EXISTS absences_etudiants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  date_absence DATE NOT NULL DEFAULT CURRENT_DATE,
  matiere     TEXT,
  justifiee   BOOLEAN DEFAULT false,
  motif       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE absences_etudiants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_absences" ON absences_etudiants           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_absences" ON absences_etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_absences" ON absences_etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_absences" ON absences_etudiants FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_abs_tenant ON absences_etudiants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_etu    ON absences_etudiants(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_abs_date   ON absences_etudiants(date_absence);

-- Index for fast code_deblocage lookup
CREATE INDEX IF NOT EXISTS idx_etu_code ON etudiants(code_deblocage) WHERE code_deblocage IS NOT NULL;

-- Note: Create a public "logos" bucket in Supabase Storage dashboard
-- for school and company logo uploads (used by parametres page).
-- Storage → New bucket → name: logos → Public: true
