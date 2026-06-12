-- =============================================================================
-- MIGRATION 091 — MODULE SANTÉ : Ordonnances, Actes Médicaux, Dispensations
-- Ajoute uniquement les tables MANQUANTES et colonnes MANQUANTES.
-- 100% idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- NE PAS modifier les tables existantes hors ADD COLUMN.
-- =============================================================================

-- ==================== COLONNES MANQUANTES : clinique_consultations ====================
-- Constantes vitales supplémentaires et code diagnostic ICD-10

ALTER TABLE clinique_consultations
  ADD COLUMN IF NOT EXISTS pouls          NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS saturation_o2  NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS frequence_resp NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS code_cim10     TEXT;

-- ==================== COLONNES MANQUANTES : clinique_patients ====================

ALTER TABLE clinique_patients
  ADD COLUMN IF NOT EXISTS situation_matrimoniale TEXT
    CHECK (situation_matrimoniale IN ('celibataire','marie','divorce','veuf','union_libre') OR situation_matrimoniale IS NULL),
  ADD COLUMN IF NOT EXISTS profession TEXT;

-- ==================== ACTES MÉDICAUX ====================
-- Nomenclature des actes facturables (consultations, petite chirurgie, soins...)

CREATE TABLE IF NOT EXISTS his_actes_medicaux (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code             TEXT          NOT NULL,
  libelle          TEXT          NOT NULL,
  categorie        TEXT          NOT NULL DEFAULT 'consultation'
                                 CHECK (categorie IN ('consultation','chirurgie','soins_infirmiers',
                                                       'imagerie','labo','kinesitherapie','acouchement',
                                                       'vaccination','autre')),
  prix_unitaire    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
  taux_tva         NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva >= 0),
  taux_cnss        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  actif            BOOLEAN       NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE his_actes_medicaux ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "actes_select" ON his_actes_medicaux FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "actes_insert" ON his_actes_medicaux FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "actes_update" ON his_actes_medicaux FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "actes_delete" ON his_actes_medicaux FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_actes_tenant   ON his_actes_medicaux(tenant_id);
CREATE INDEX IF NOT EXISTS idx_actes_code     ON his_actes_medicaux(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_actes_categorie ON his_actes_medicaux(tenant_id, categorie) WHERE actif = true;

CREATE OR REPLACE FUNCTION fn_actes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_actes_updated_at ON his_actes_medicaux;
CREATE TRIGGER trg_actes_updated_at
  BEFORE UPDATE ON his_actes_medicaux
  FOR EACH ROW EXECUTE FUNCTION fn_actes_updated_at();


-- ==================== ORDONNANCES ====================
-- Prescriptions structurées issues d'une consultation

CREATE TABLE IF NOT EXISTS his_ordonnances (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id       UUID          NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  consultation_id  UUID          REFERENCES clinique_consultations(id) ON DELETE SET NULL,
  medecin_id       UUID          REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  numero           TEXT,
  date_prescription TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  validite_jours   INTEGER       NOT NULL DEFAULT 30,
  diagnostic       TEXT,
  instructions     TEXT,
  statut           TEXT          NOT NULL DEFAULT 'active'
                                 CHECK (statut IN ('active','dispensee','expiree','annulee')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE his_ordonnances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ord_select" ON his_ordonnances FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ord_insert" ON his_ordonnances FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ord_update" ON his_ordonnances FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ord_delete" ON his_ordonnances FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ord_tenant  ON his_ordonnances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ord_patient ON his_ordonnances(patient_id);
CREATE INDEX IF NOT EXISTS idx_ord_consult ON his_ordonnances(consultation_id);
CREATE INDEX IF NOT EXISTS idx_ord_date    ON his_ordonnances(tenant_id, date_prescription);

-- Auto-numérotation
CREATE OR REPLACE FUNCTION fn_ordonnance_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INT)), 0) + 1
      INTO v_seq FROM his_ordonnances WHERE tenant_id = NEW.tenant_id AND numero IS NOT NULL;
    NEW.numero := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ordonnance_numero ON his_ordonnances;
CREATE TRIGGER trg_ordonnance_numero
  BEFORE INSERT ON his_ordonnances
  FOR EACH ROW EXECUTE FUNCTION fn_ordonnance_numero();

-- Expire automatiquement les ordonnances dépassées
CREATE OR REPLACE FUNCTION fn_ordonnances_expire()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE his_ordonnances
  SET statut = 'expiree'
  WHERE statut = 'active'
    AND (date_prescription + (validite_jours || ' days')::INTERVAL) < NOW();
END $$;


-- ==================== LIGNES D'ORDONNANCE ====================

CREATE TABLE IF NOT EXISTS his_ordonnance_lignes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ordonnance_id   UUID          NOT NULL REFERENCES his_ordonnances(id) ON DELETE CASCADE,
  medicament_id   UUID          REFERENCES pharmacie_medicaments(id) ON DELETE SET NULL,
  nom_medicament  TEXT          NOT NULL,
  dosage          TEXT,
  forme           TEXT,
  posologie       TEXT          NOT NULL,
  duree_jours     INTEGER,
  quantite        INTEGER       NOT NULL DEFAULT 1 CHECK (quantite > 0),
  instructions    TEXT,
  ordre           INTEGER       NOT NULL DEFAULT 1
);

ALTER TABLE his_ordonnance_lignes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ordl_select" ON his_ordonnance_lignes FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM his_ordonnances o
      WHERE o.id = ordonnance_id AND o.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ordl_insert" ON his_ordonnance_lignes FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM his_ordonnances o
      WHERE o.id = ordonnance_id AND o.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ordl_update" ON his_ordonnance_lignes FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM his_ordonnances o
      WHERE o.id = ordonnance_id AND o.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ordl_delete" ON his_ordonnance_lignes FOR DELETE
    USING (EXISTS (
      SELECT 1 FROM his_ordonnances o
      WHERE o.id = ordonnance_id AND o.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ordl_ordonnance ON his_ordonnance_lignes(ordonnance_id);
CREATE INDEX IF NOT EXISTS idx_ordl_medicament ON his_ordonnance_lignes(medicament_id);


-- ==================== DISPENSATIONS PHARMACIE ====================
-- Dispensation formelle liée à une ordonnance (distinct des ventes POS pharmacie_ventes)

CREATE TABLE IF NOT EXISTS his_dispensations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ordonnance_id   UUID          REFERENCES his_ordonnances(id) ON DELETE SET NULL,
  patient_id      UUID          NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  pharmacien_id   UUID          REFERENCES his_personnel(id) ON DELETE SET NULL,
  date_dispensation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statut          TEXT          NOT NULL DEFAULT 'complete'
                                CHECK (statut IN ('partielle','complete','refusee')),
  notes           TEXT,
  montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
  mode_paiement   TEXT          DEFAULT 'especes'
                                CHECK (mode_paiement IN ('especes','mobile_money','carte','assurance','credit')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE his_dispensations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "disp_select" ON his_dispensations FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "disp_insert" ON his_dispensations FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "disp_update" ON his_dispensations FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "disp_delete" ON his_dispensations FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_disp_tenant     ON his_dispensations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disp_ordonnance ON his_dispensations(ordonnance_id);
CREATE INDEX IF NOT EXISTS idx_disp_patient    ON his_dispensations(patient_id);
CREATE INDEX IF NOT EXISTS idx_disp_date       ON his_dispensations(tenant_id, date_dispensation);


-- ==================== LIGNES DE DISPENSATION ====================

CREATE TABLE IF NOT EXISTS his_dispensation_lignes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id UUID          NOT NULL REFERENCES his_dispensations(id) ON DELETE CASCADE,
  medicament_id   UUID          NOT NULL REFERENCES pharmacie_medicaments(id) ON DELETE RESTRICT,
  quantite_prescrite INTEGER,
  quantite_dispensee INTEGER     NOT NULL DEFAULT 0 CHECK (quantite_dispensee >= 0),
  prix_unitaire   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ligne     NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes           TEXT
);

ALTER TABLE his_dispensation_lignes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "displ_select" ON his_dispensation_lignes FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM his_dispensations d
      WHERE d.id = dispensation_id AND d.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "displ_insert" ON his_dispensation_lignes FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM his_dispensations d
      WHERE d.id = dispensation_id AND d.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "displ_update" ON his_dispensation_lignes FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM his_dispensations d
      WHERE d.id = dispensation_id AND d.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "displ_delete" ON his_dispensation_lignes FOR DELETE
    USING (EXISTS (
      SELECT 1 FROM his_dispensations d
      WHERE d.id = dispensation_id AND d.tenant_id = get_my_tenant_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_displ_dispensation ON his_dispensation_lignes(dispensation_id);
CREATE INDEX IF NOT EXISTS idx_displ_medicament   ON his_dispensation_lignes(medicament_id);

-- Trigger: déduire le stock pharmacie à la dispensation
CREATE OR REPLACE FUNCTION fn_dispensation_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE pharmacie_medicaments
  SET stock_actuel = GREATEST(0, stock_actuel - NEW.quantite_dispensee)
  WHERE id = NEW.medicament_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispensation_stock ON his_dispensation_lignes;
CREATE TRIGGER trg_dispensation_stock
  AFTER INSERT ON his_dispensation_lignes
  FOR EACH ROW EXECUTE FUNCTION fn_dispensation_stock();


-- ==================== RLS SUR his_lits / his_sejours / his_urgences ====================
-- 084 n'avait pas activé RLS sur ces tables

ALTER TABLE his_lits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_sejours       ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_urgences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_examens_labo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_resultats_labo ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_examens_imagerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_factures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_lignes_facture ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_assurances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_dossiers_assurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_personnel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_gardes        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "lits_select" ON his_lits FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lits_insert" ON his_lits FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lits_update" ON his_lits FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "lits_delete" ON his_lits FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "sej_select" ON his_sejours FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sej_insert" ON his_sejours FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sej_update" ON his_sejours FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sej_delete" ON his_sejours FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "urg_select" ON his_urgences FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "urg_insert" ON his_urgences FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "urg_update" ON his_urgences FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "exlb_select" ON his_examens_labo FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "exlb_insert" ON his_examens_labo FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "exlb_update" ON his_examens_labo FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "rslb_select" ON his_resultats_labo FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rslb_insert" ON his_resultats_labo FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rslb_update" ON his_resultats_labo FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "exim_select" ON his_examens_imagerie FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "exim_insert" ON his_examens_imagerie FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "exim_update" ON his_examens_imagerie FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "intv_select" ON his_interventions FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "intv_insert" ON his_interventions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "intv_update" ON his_interventions FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hfac_select" ON his_factures FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hfac_insert" ON his_factures FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hfac_update" ON his_factures FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hfacl_select" ON his_lignes_facture FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hfacl_insert" ON his_lignes_facture FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hfacl_update" ON his_lignes_facture FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hass_select" ON his_assurances FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hass_insert" ON his_assurances FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hass_update" ON his_assurances FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hdoss_select" ON his_dossiers_assurance FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hdoss_insert" ON his_dossiers_assurance FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hdoss_update" ON his_dossiers_assurance FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hpers_select" ON his_personnel FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hpers_insert" ON his_personnel FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hpers_update" ON his_personnel FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hgard_select" ON his_gardes FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hgard_insert" ON his_gardes FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hgard_update" ON his_gardes FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==================== INDEX MANQUANTS sur tables HIS ====================

CREATE INDEX IF NOT EXISTS idx_lits_tenant    ON his_lits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lits_statut    ON his_lits(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_sej_tenant     ON his_sejours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sej_patient    ON his_sejours(patient_id);
CREATE INDEX IF NOT EXISTS idx_sej_statut     ON his_sejours(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_urg_tenant     ON his_urgences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_urg_statut     ON his_urgences(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_exlb_tenant    ON his_examens_labo(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exlb_patient   ON his_examens_labo(patient_id);
CREATE INDEX IF NOT EXISTS idx_exim_tenant    ON his_examens_imagerie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intv_tenant    ON his_interventions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hfac_tenant    ON his_factures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hfac_patient   ON his_factures(patient_id);
CREATE INDEX IF NOT EXISTS idx_hfac_statut    ON his_factures(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_hfacl_facture  ON his_lignes_facture(facture_id);
CREATE INDEX IF NOT EXISTS idx_hass_tenant    ON his_assurances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hdoss_tenant   ON his_dossiers_assurance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hdoss_patient  ON his_dossiers_assurance(patient_id);
CREATE INDEX IF NOT EXISTS idx_hpers_tenant   ON his_personnel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hgard_tenant   ON his_gardes(tenant_id);
