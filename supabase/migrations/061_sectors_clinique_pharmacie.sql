-- =============================================================================
-- Migration 061 : Secteurs Métiers — Clinique, Pharmacie, Hôtel+, Sub-tenants
-- Auteur       : Oraforme ERP
-- Date         : 2026-05-29
-- Idempotente  : IF NOT EXISTS / OR REPLACE / DO $$ EXCEPTION $$
-- =============================================================================


-- =============================================================================
-- SECTION 1 — HÔTEL : table housekeeping
-- =============================================================================

CREATE TABLE IF NOT EXISTS hotel_housekeeping (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chambre_id    UUID          REFERENCES hotel_chambres(id) ON DELETE SET NULL,
  chambre_numero TEXT,
  statut        TEXT          NOT NULL DEFAULT 'a_nettoyer'
                              CHECK (statut IN ('a_nettoyer','en_cours','propre','inspecte','hors_service')),
  priorite      TEXT          NOT NULL DEFAULT 'normale'
                              CHECK (priorite IN ('basse','normale','haute','urgente')),
  assignee      TEXT,
  notes         TEXT,
  date_tache    DATE          NOT NULL DEFAULT CURRENT_DATE,
  heure_debut   TIME,
  heure_fin     TIME,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE hotel_housekeeping ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "hk_select" ON hotel_housekeeping FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "hk_insert" ON hotel_housekeeping FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "hk_update" ON hotel_housekeeping FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "hk_delete" ON hotel_housekeeping FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_hk_tenant   ON hotel_housekeeping(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hk_date     ON hotel_housekeeping(tenant_id, date_tache);
CREATE INDEX IF NOT EXISTS idx_hk_statut   ON hotel_housekeeping(tenant_id, statut);

CREATE OR REPLACE FUNCTION fn_hotel_hk_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_hotel_hk_updated_at ON hotel_housekeeping;
CREATE TRIGGER trg_hotel_hk_updated_at
  BEFORE UPDATE ON hotel_housekeeping
  FOR EACH ROW EXECUTE FUNCTION fn_hotel_hk_updated_at();


-- =============================================================================
-- SECTION 2 — CLINIQUE : médecins
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinique_medecins (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom           TEXT          NOT NULL,
  prenom        TEXT          NOT NULL,
  specialite    TEXT          NOT NULL,
  telephone     TEXT,
  email         TEXT,
  numero_ordre  TEXT,
  horaires      JSONB         NOT NULL DEFAULT '{}',
  actif         BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE clinique_medecins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "med_select" ON clinique_medecins FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_insert" ON clinique_medecins FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_update" ON clinique_medecins FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_delete" ON clinique_medecins FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_med_tenant ON clinique_medecins(tenant_id);


-- =============================================================================
-- SECTION 3 — CLINIQUE : patients
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinique_patients (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_dossier  TEXT,
  nom             TEXT          NOT NULL,
  prenom          TEXT          NOT NULL,
  date_naissance  DATE,
  sexe            TEXT          CHECK (sexe IN ('M','F','autre')),
  telephone       TEXT,
  email           TEXT,
  adresse         TEXT,
  groupe_sanguin  TEXT          CHECK (groupe_sanguin IN ('A+','A-','B+','B-','AB+','AB-','O+','O-',NULL)),
  antecedents     TEXT,
  allergies       TEXT,
  medecin_id      UUID          REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  assurance       TEXT,
  numero_assurance TEXT,
  actif           BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE clinique_patients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "pat_select" ON clinique_patients FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pat_insert" ON clinique_patients FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pat_update" ON clinique_patients FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pat_delete" ON clinique_patients FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pat_tenant ON clinique_patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pat_nom    ON clinique_patients(tenant_id, nom, prenom);

CREATE OR REPLACE FUNCTION fn_patients_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_patients_updated_at ON clinique_patients;
CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON clinique_patients
  FOR EACH ROW EXECUTE FUNCTION fn_patients_updated_at();

-- Auto-générer numéro dossier
CREATE OR REPLACE FUNCTION fn_patient_numero_dossier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE seq INT;
BEGIN
  IF NEW.numero_dossier IS NULL THEN
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_dossier,'[^0-9]','','g') AS INT)),0)+1
    INTO seq FROM clinique_patients WHERE tenant_id = NEW.tenant_id AND numero_dossier IS NOT NULL;
    NEW.numero_dossier := 'PAT-' || LPAD(seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_patient_dossier ON clinique_patients;
CREATE TRIGGER trg_patient_dossier
  BEFORE INSERT ON clinique_patients
  FOR EACH ROW EXECUTE FUNCTION fn_patient_numero_dossier();


-- =============================================================================
-- SECTION 4 — CLINIQUE : rendez-vous
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinique_rdv (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id    UUID          NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  medecin_id    UUID          REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  date_heure    TIMESTAMPTZ   NOT NULL,
  duree_minutes INTEGER       NOT NULL DEFAULT 30,
  motif         TEXT          NOT NULL,
  statut        TEXT          NOT NULL DEFAULT 'planifie'
                              CHECK (statut IN ('planifie','confirme','arrive','en_cours','termine','annule','absent')),
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE clinique_rdv ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rdv_select" ON clinique_rdv FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rdv_insert" ON clinique_rdv FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rdv_update" ON clinique_rdv FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rdv_delete" ON clinique_rdv FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_rdv_tenant   ON clinique_rdv(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdv_date     ON clinique_rdv(tenant_id, date_heure);
CREATE INDEX IF NOT EXISTS idx_rdv_patient  ON clinique_rdv(patient_id);
CREATE INDEX IF NOT EXISTS idx_rdv_medecin  ON clinique_rdv(medecin_id);


-- =============================================================================
-- SECTION 5 — CLINIQUE : consultations
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinique_consultations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      UUID          NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  medecin_id      UUID          REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  rdv_id          UUID          REFERENCES clinique_rdv(id) ON DELETE SET NULL,
  date_consult    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  motif           TEXT          NOT NULL,
  examen          TEXT,
  diagnostic      TEXT,
  traitement      TEXT,
  ordonnance      TEXT,
  pression_art    TEXT,
  temperature     NUMERIC(4,1),
  poids           NUMERIC(5,1),
  taille          NUMERIC(5,1),
  montant         NUMERIC(15,2) NOT NULL DEFAULT 0,
  statut_paiement TEXT          NOT NULL DEFAULT 'en_attente'
                                CHECK (statut_paiement IN ('en_attente','paye','assurance','partiel')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE clinique_consultations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cons_select" ON clinique_consultations FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cons_insert" ON clinique_consultations FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cons_update" ON clinique_consultations FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cons_delete" ON clinique_consultations FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cons_tenant  ON clinique_consultations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cons_date    ON clinique_consultations(tenant_id, date_consult);
CREATE INDEX IF NOT EXISTS idx_cons_patient ON clinique_consultations(patient_id);


-- =============================================================================
-- SECTION 6 — PHARMACIE : médicaments
-- =============================================================================

CREATE TABLE IF NOT EXISTS pharmacie_medicaments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom_commercial      TEXT          NOT NULL,
  dci                 TEXT,
  forme               TEXT          CHECK (forme IN ('comprime','gelule','sirop','injectable','pommade','gouttes','spray','autre')),
  dosage              TEXT,
  laboratoire         TEXT,
  code_barre          TEXT,
  prix_achat          NUMERIC(15,2) NOT NULL DEFAULT 0,
  prix_vente          NUMERIC(15,2) NOT NULL DEFAULT 0,
  stock_actuel        INTEGER       NOT NULL DEFAULT 0,
  stock_min           INTEGER       NOT NULL DEFAULT 5,
  ordonnance_requise  BOOLEAN       NOT NULL DEFAULT false,
  date_expiration     DATE,
  emplacement         TEXT,
  actif               BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE pharmacie_medicaments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "med_ph_select" ON pharmacie_medicaments FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_ph_insert" ON pharmacie_medicaments FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_ph_update" ON pharmacie_medicaments FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "med_ph_delete" ON pharmacie_medicaments FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_phmed_tenant ON pharmacie_medicaments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phmed_nom    ON pharmacie_medicaments(tenant_id, nom_commercial);
CREATE INDEX IF NOT EXISTS idx_phmed_exp    ON pharmacie_medicaments(date_expiration) WHERE actif = true;

CREATE OR REPLACE FUNCTION fn_phmed_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_phmed_updated_at ON pharmacie_medicaments;
CREATE TRIGGER trg_phmed_updated_at
  BEFORE UPDATE ON pharmacie_medicaments
  FOR EACH ROW EXECUTE FUNCTION fn_phmed_updated_at();


-- =============================================================================
-- SECTION 7 — PHARMACIE : ventes / ordonnances
-- =============================================================================

CREATE TABLE IF NOT EXISTS pharmacie_ventes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_ticket   TEXT,
  client_nom      TEXT,
  client_telephone TEXT,
  medecin_nom     TEXT,
  avec_ordonnance BOOLEAN       NOT NULL DEFAULT false,
  montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
  mode_paiement   TEXT          NOT NULL DEFAULT 'especes'
                                CHECK (mode_paiement IN ('especes','mobile_money','carte','assurance','credit')),
  statut          TEXT          NOT NULL DEFAULT 'valide'
                                CHECK (statut IN ('valide','annule','rembourse')),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacie_vente_lignes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id        UUID          NOT NULL REFERENCES pharmacie_ventes(id) ON DELETE CASCADE,
  medicament_id   UUID          NOT NULL REFERENCES pharmacie_medicaments(id) ON DELETE RESTRICT,
  quantite        INTEGER       NOT NULL DEFAULT 1,
  prix_unitaire   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ligne     NUMERIC(15,2) NOT NULL DEFAULT 0
);

ALTER TABLE pharmacie_ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacie_vente_lignes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "phv_select" ON pharmacie_ventes FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "phv_insert" ON pharmacie_ventes FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "phvl_select" ON pharmacie_vente_lignes
    FOR SELECT USING (EXISTS (SELECT 1 FROM pharmacie_ventes v WHERE v.id = vente_id AND v.tenant_id = get_my_tenant_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "phvl_insert" ON pharmacie_vente_lignes
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM pharmacie_ventes v WHERE v.id = vente_id AND v.tenant_id = get_my_tenant_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_phv_tenant   ON pharmacie_ventes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phv_date     ON pharmacie_ventes(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_phvl_vente   ON pharmacie_vente_lignes(vente_id);

-- Trigger : décrémenter stock à la vente
CREATE OR REPLACE FUNCTION fn_phvente_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pharmacie_medicaments
  SET stock_actuel = stock_actuel - NEW.quantite
  WHERE id = NEW.medicament_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_phvente_stock ON pharmacie_vente_lignes;
CREATE TRIGGER trg_phvente_stock
  AFTER INSERT ON pharmacie_vente_lignes
  FOR EACH ROW EXECUTE FUNCTION fn_phvente_stock();

-- Ticket auto
CREATE OR REPLACE FUNCTION fn_phvente_ticket()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_ticket IS NULL THEN
    NEW.numero_ticket := 'TICK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 100000)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_phvente_ticket ON pharmacie_ventes;
CREATE TRIGGER trg_phvente_ticket
  BEFORE INSERT ON pharmacie_ventes
  FOR EACH ROW EXECUTE FUNCTION fn_phvente_ticket();


-- =============================================================================
-- SECTION 8 — SUB-TENANTS (Cabinets comptables, juridiques, audit)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sub_tenants (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  child_tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type_relation   TEXT          NOT NULL DEFAULT 'client'
                                CHECK (type_relation IN ('client','filiale','partenaire')),
  statut          TEXT          NOT NULL DEFAULT 'actif'
                                CHECK (statut IN ('actif','suspendu','archive')),
  permissions     JSONB         NOT NULL DEFAULT '{"comptabilite":true,"paie":false,"declarations":false,"audit":false}',
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (parent_tenant_id, child_tenant_id)
);

ALTER TABLE sub_tenants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sub_select" ON sub_tenants
    FOR SELECT USING (parent_tenant_id = get_my_tenant_id() OR child_tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sub_insert" ON sub_tenants
    FOR INSERT WITH CHECK (parent_tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sub_update" ON sub_tenants
    FOR UPDATE USING (parent_tenant_id = get_my_tenant_id()) WITH CHECK (parent_tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sub_delete" ON sub_tenants
    FOR DELETE USING (parent_tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_sub_parent ON sub_tenants(parent_tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_child  ON sub_tenants(child_tenant_id);


-- =============================================================================
-- SECTION 9 — SECTOR_ROLES : rôles dynamiques par secteur
-- =============================================================================

CREATE TABLE IF NOT EXISTS sector_roles (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id     TEXT          NOT NULL,
  role_key      TEXT          NOT NULL,
  role_label    TEXT          NOT NULL,
  role_label_fr TEXT,
  permissions   JSONB         NOT NULL DEFAULT '{}',
  couleur       TEXT          DEFAULT '#64748B',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (sector_id, role_key)
);

-- Seed rôles hôtel
INSERT INTO sector_roles (sector_id, role_key, role_label, role_label_fr, couleur, permissions) VALUES
  ('hotel', 'manager',       'Hotel Manager',     'Manager Hôtel',     '#2563EB', '{"chambres":true,"reservations":true,"housekeeping":true,"caisse":true,"rapports":true}'),
  ('hotel', 'receptionniste','Receptionist',      'Réceptionniste',    '#16A34A', '{"chambres":false,"reservations":true,"housekeeping":false,"caisse":true,"rapports":false}'),
  ('hotel', 'housekeeping',  'Housekeeping Staff','Femme de chambre',  '#D97706', '{"chambres":false,"reservations":false,"housekeeping":true,"caisse":false,"rapports":false}')
ON CONFLICT (sector_id, role_key) DO NOTHING;

-- Seed rôles clinique/sante
INSERT INTO sector_roles (sector_id, role_key, role_label, role_label_fr, couleur, permissions) VALUES
  ('sante', 'directeur_med', 'Medical Director',  'Directeur Médical', '#7C3AED', '{"patients":true,"consultations":true,"medecins":true,"rdv":true,"caisse":true,"rapports":true}'),
  ('sante', 'medecin',       'Doctor',            'Médecin',           '#2563EB', '{"patients":true,"consultations":true,"medecins":false,"rdv":true,"caisse":false,"rapports":false}'),
  ('sante', 'infirmier',     'Nurse',             'Infirmier(ère)',     '#16A34A', '{"patients":true,"consultations":false,"medecins":false,"rdv":true,"caisse":false,"rapports":false}'),
  ('sante', 'caissier',      'Cashier',           'Caissier(ère)',      '#D97706', '{"patients":false,"consultations":false,"medecins":false,"rdv":false,"caisse":true,"rapports":false}'),
  ('sante', 'secretaire',    'Secretary',         'Secrétaire médicale','#64748B', '{"patients":true,"consultations":false,"medecins":false,"rdv":true,"caisse":false,"rapports":false}')
ON CONFLICT (sector_id, role_key) DO NOTHING;

-- Seed rôles pharmacie
INSERT INTO sector_roles (sector_id, role_key, role_label, role_label_fr, couleur, permissions) VALUES
  ('pharmacie', 'pharmacien',  'Pharmacist',       'Pharmacien',        '#2563EB', '{"medicaments":true,"ventes":true,"ordonnances":true,"caisse":true,"rapports":true}'),
  ('pharmacie', 'preparateur', 'Pharmacy Tech',    'Préparateur',       '#16A34A', '{"medicaments":true,"ventes":true,"ordonnances":false,"caisse":false,"rapports":false}'),
  ('pharmacie', 'caissier',    'Cashier',          'Caissier(ère)',      '#D97706', '{"medicaments":false,"ventes":true,"ordonnances":false,"caisse":true,"rapports":false}')
ON CONFLICT (sector_id, role_key) DO NOTHING;

-- Seed rôles restaurant
INSERT INTO sector_roles (sector_id, role_key, role_label, role_label_fr, couleur, permissions) VALUES
  ('restaurant', 'gerant',    'Manager',           'Gérant',            '#2563EB', '{"menus":true,"tables":true,"commandes":true,"caisse":true,"rapports":true,"stock":true}'),
  ('restaurant', 'serveur',   'Waiter',            'Serveur',           '#16A34A', '{"menus":false,"tables":true,"commandes":true,"caisse":false,"rapports":false,"stock":false}'),
  ('restaurant', 'cuisinier', 'Cook',              'Cuisinier',         '#EA580C', '{"menus":true,"tables":false,"commandes":true,"caisse":false,"rapports":false,"stock":true}'),
  ('restaurant', 'caissier',  'Cashier',           'Caissier(ère)',      '#D97706', '{"menus":false,"tables":false,"commandes":false,"caisse":true,"rapports":false,"stock":false}')
ON CONFLICT (sector_id, role_key) DO NOTHING;


-- =============================================================================
-- SECTION 10 — VUES UTILES
-- =============================================================================

-- RDV du jour
CREATE OR REPLACE VIEW v_rdv_today AS
SELECT r.*,
  p.nom AS patient_nom, p.prenom AS patient_prenom, p.telephone AS patient_tel,
  m.nom AS medecin_nom, m.prenom AS medecin_prenom, m.specialite
FROM clinique_rdv r
LEFT JOIN clinique_patients p ON p.id = r.patient_id
LEFT JOIN clinique_medecins m ON m.id = r.medecin_id
WHERE DATE(r.date_heure AT TIME ZONE 'Africa/Brazzaville') = CURRENT_DATE
  AND r.statut NOT IN ('annule','absent');

-- Stock pharmacie faible
CREATE OR REPLACE VIEW v_pharmacie_stock_faible AS
SELECT * FROM pharmacie_medicaments
WHERE stock_actuel <= stock_min AND actif = true;

-- Taux occupation hôtel (aujourd'hui)
CREATE OR REPLACE VIEW v_hotel_occupation AS
SELECT
  COUNT(*) FILTER (WHERE statut = 'disponible') AS disponibles,
  COUNT(*) FILTER (WHERE statut = 'occupee')    AS occupees,
  COUNT(*) FILTER (WHERE statut = 'reservee')   AS reservees,
  COUNT(*) FILTER (WHERE statut = 'maintenance') AS maintenance,
  COUNT(*)                                       AS total,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE statut = 'occupee') * 100.0 / COUNT(*), 1)
    ELSE 0 END AS taux_occupation
FROM hotel_chambres;


-- =============================================================================
-- FIN MIGRATION 061
-- =============================================================================
