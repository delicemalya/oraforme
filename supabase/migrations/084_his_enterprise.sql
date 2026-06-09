-- =============================================================
-- MIGRATION 084 — HIS ENTERPRISE (Hospital Information System)
-- Nouveaux modules: Lits, Séjours, Urgences, Labo, Imagerie,
--                   Bloc Opératoire, Facturation, Assurances,
--                   Personnel, Gardes
-- =============================================================

-- ==================== LITS ====================
CREATE TABLE his_lits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service    TEXT NOT NULL DEFAULT 'medecine_generale',
  numero     TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'standard'
             CHECK (type IN ('standard','vip','reanimation','isole','pediatrique')),
  statut     TEXT NOT NULL DEFAULT 'libre'
             CHECK (statut IN ('libre','occupe','reserve','maintenance','desinfection')),
  etage      INTEGER DEFAULT 1,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SÉJOURS ====================
CREATE TABLE his_sejours (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id            UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  lit_id                UUID REFERENCES his_lits(id) ON DELETE SET NULL,
  medecin_referent_id   UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  numero_sejour         TEXT,
  date_entree           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_sortie_prevue    DATE,
  date_sortie_effective TIMESTAMPTZ,
  motif_admission       TEXT NOT NULL,
  diagnostic_entree     TEXT,
  diagnostic_sortie     TEXT,
  type_sortie           TEXT CHECK (type_sortie IN ('guerison','transfert','deces','contre_avis','rendez_vous')),
  statut                TEXT NOT NULL DEFAULT 'en_cours'
                        CHECK (statut IN ('en_cours','sorti','transfere')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fn_sejour_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_sejour, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO v_seq FROM his_sejours WHERE tenant_id = NEW.tenant_id AND numero_sejour IS NOT NULL;
  NEW.numero_sejour := 'SEJ-' || LPAD(v_seq::TEXT, 5, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sejour_numero
  BEFORE INSERT ON his_sejours FOR EACH ROW EXECUTE FUNCTION fn_sejour_numero();

-- ==================== URGENCES ====================
CREATE TABLE his_urgences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id         UUID REFERENCES clinique_patients(id) ON DELETE SET NULL,
  nom_complet        TEXT,
  age_estime         INTEGER,
  sexe               TEXT DEFAULT 'inconnu' CHECK (sexe IN ('M','F','inconnu')),
  heure_arrivee      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode_arrivee       TEXT DEFAULT 'propres_moyens'
                     CHECK (mode_arrivee IN ('ambulance','propres_moyens','samu','transfert','pompiers')),
  priorite           INTEGER NOT NULL DEFAULT 3 CHECK (priorite BETWEEN 1 AND 4),
  ccmu               INTEGER DEFAULT 3 CHECK (ccmu BETWEEN 1 AND 5),
  motif              TEXT NOT NULL,
  constantes_vitales JSONB DEFAULT '{}',
  medecin_id         UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  statut             TEXT NOT NULL DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente','triage_fait','en_soins','hospitalise','sorti','deces')),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== LABORATOIRE ====================
CREATE TABLE his_examens_labo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  consultation_id   UUID REFERENCES clinique_consultations(id) ON DELETE SET NULL,
  sejour_id         UUID REFERENCES his_sejours(id) ON DELETE SET NULL,
  medecin_id        UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  date_prescription TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type_examen       TEXT NOT NULL
                    CHECK (type_examen IN ('NFS','Biochimie','Bacteriologie','Serologie','Hormones','Coagulation','Urines','Autres')),
  examens           JSONB DEFAULT '[]',
  statut            TEXT NOT NULL DEFAULT 'prescrit'
                    CHECK (statut IN ('prescrit','en_cours','resultat_partiel','resultat_complet','annule')),
  urgence           BOOLEAN DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE his_resultats_labo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  examen_id      UUID NOT NULL REFERENCES his_examens_labo(id) ON DELETE CASCADE,
  parametre      TEXT NOT NULL,
  valeur         TEXT NOT NULL,
  unite          TEXT,
  valeur_normale TEXT,
  interpretation TEXT CHECK (interpretation IN ('normal','bas','eleve','critique')),
  date_resultat  TIMESTAMPTZ DEFAULT NOW(),
  technicien     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== IMAGERIE ====================
CREATE TABLE his_examens_imagerie (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  consultation_id   UUID REFERENCES clinique_consultations(id) ON DELETE SET NULL,
  sejour_id         UUID REFERENCES his_sejours(id) ON DELETE SET NULL,
  medecin_id        UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  date_prescription TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type_examen       TEXT NOT NULL
                    CHECK (type_examen IN ('radiographie','echographie','scanner','irm','mammographie','panoramique','autre')),
  region            TEXT,
  urgence           BOOLEAN DEFAULT false,
  statut            TEXT NOT NULL DEFAULT 'prescrit'
                    CHECK (statut IN ('prescrit','planifie','realise','interprete','annule')),
  rapport           TEXT,
  date_realisation  TIMESTAMPTZ,
  technicien        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== BLOC OPÉRATOIRE ====================
CREATE TABLE his_interventions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  sejour_id         UUID REFERENCES his_sejours(id) ON DELETE SET NULL,
  chirurgien_id     UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  anesthesiste_id   UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  date_prevue       TIMESTAMPTZ,
  date_debut        TIMESTAMPTZ,
  date_fin          TIMESTAMPTZ,
  type_anesthesie   TEXT CHECK (type_anesthesie IN ('generale','loco_regionale','locale','rachianesthesie','aucune')),
  type_intervention TEXT NOT NULL,
  description       TEXT,
  statut            TEXT NOT NULL DEFAULT 'programme'
                    CHECK (statut IN ('programme','en_cours','termine','annule','reporte')),
  complications     TEXT,
  notes_post_op     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== FACTURATION ====================
CREATE TABLE his_factures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES clinique_consultations(id) ON DELETE SET NULL,
  sejour_id       UUID REFERENCES his_sejours(id) ON DELETE SET NULL,
  numero_facture  TEXT,
  date_facture    DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance   DATE,
  montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
  montant_paye    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),
  remise          NUMERIC(15,2) DEFAULT 0,
  mode_paiement   TEXT CHECK (mode_paiement IN ('especes','mobile_money','carte','assurance','credit','mixte')),
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','partielle','payee','annulee')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE his_lignes_facture (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facture_id    UUID NOT NULL REFERENCES his_factures(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantite      INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant_ligne NUMERIC(15,2) NOT NULL DEFAULT 0,
  categorie     TEXT DEFAULT 'autre'
                CHECK (categorie IN ('consultation','hospitalisation','pharmacie','labo','imagerie','bloc','autre'))
);

CREATE OR REPLACE FUNCTION fn_facture_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_facture, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO v_seq FROM his_factures WHERE tenant_id = NEW.tenant_id AND numero_facture IS NOT NULL;
  NEW.numero_facture := 'FAC-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_facture_numero
  BEFORE INSERT ON his_factures FOR EACH ROW EXECUTE FUNCTION fn_facture_numero();

-- OHADA trigger: paiement facture → journal_entries
CREATE OR REPLACE FUNCTION fn_his_facture_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_delta  NUMERIC;
  v_debit  TEXT;
  v_ht     NUMERIC;
  v_tva    NUMERIC;
  v_fy     TEXT;
BEGIN
  v_delta := NEW.montant_paye - OLD.montant_paye;
  IF v_delta > 0 THEN
    v_debit := CASE NEW.mode_paiement
      WHEN 'especes'       THEN '511000'
      WHEN 'mobile_money'  THEN '571100'
      WHEN 'carte'         THEN '512000'
      ELSE '571200'
    END;
    v_ht  := ROUND(v_delta / 1.189, 0);
    v_tva := v_delta - v_ht;
    v_fy  := TO_CHAR(NOW(), 'YYYY');
    INSERT INTO journal_entries (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES (NEW.tenant_id, NOW(), 'Facture ' || COALESCE(NEW.numero_facture,'') || ' HT', v_debit, '705000', v_ht, 'sante_facture', NEW.id, v_fy);
    INSERT INTO journal_entries (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES (NEW.tenant_id, NOW(), 'TVA Facture ' || COALESCE(NEW.numero_facture,''), v_debit, '441000', v_tva, 'sante_facture', NEW.id, v_fy);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER trg_his_facture_journal
  AFTER UPDATE ON his_factures FOR EACH ROW EXECUTE FUNCTION fn_his_facture_journal();

-- ==================== ASSURANCES ====================
CREATE TABLE his_assurances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  code            TEXT,
  type            TEXT DEFAULT 'privee'
                  CHECK (type IN ('publique','privee','mutuelle','cnss','cnamgs')),
  taux_couverture NUMERIC(5,2) DEFAULT 80.00 CHECK (taux_couverture BETWEEN 0 AND 100),
  contacts        TEXT,
  email           TEXT,
  telephone       TEXT,
  actif           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE his_dossiers_assurance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES clinique_patients(id) ON DELETE CASCADE,
  assurance_id    UUID NOT NULL REFERENCES his_assurances(id) ON DELETE CASCADE,
  numero_adherent TEXT,
  date_debut      DATE,
  date_fin        DATE,
  taux_couverture NUMERIC(5,2),
  statut          TEXT DEFAULT 'actif' CHECK (statut IN ('actif','expire','suspendu')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RH MÉDICAL ====================
CREATE TABLE his_personnel (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  prenom        TEXT NOT NULL,
  poste         TEXT NOT NULL
                CHECK (poste IN ('infirmier','aide_soignant','sage_femme','kinesitherapeute','secretaire_medical','laborantin','technicien_imagerie','anesthesiste','pharmacien','autre')),
  service       TEXT,
  telephone     TEXT,
  email         TEXT,
  numero_ordre  TEXT,
  salaire       NUMERIC(15,2) DEFAULT 0,
  date_embauche DATE,
  actif         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE his_gardes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES his_personnel(id) ON DELETE SET NULL,
  medecin_id   UUID REFERENCES clinique_medecins(id) ON DELETE SET NULL,
  date_garde   DATE NOT NULL,
  heure_debut  TIME DEFAULT '08:00',
  heure_fin    TIME DEFAULT '08:00',
  service      TEXT,
  type_garde   TEXT DEFAULT 'garde' CHECK (type_garde IN ('garde','astreinte','remplacement')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RLS ====================
ALTER TABLE his_lits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_sejours            ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_urgences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_examens_labo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_resultats_labo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_examens_imagerie   ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_interventions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_factures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_lignes_facture     ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_assurances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_dossiers_assurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_personnel          ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_gardes             ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'his_lits','his_sejours','his_urgences',
    'his_examens_labo','his_resultats_labo','his_examens_imagerie',
    'his_interventions','his_factures','his_lignes_facture',
    'his_assurances','his_dossiers_assurance','his_personnel','his_gardes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY %I_sel ON %I FOR SELECT USING (tenant_id = get_my_tenant_id())', t, t);
    EXECUTE format('CREATE POLICY %I_ins ON %I FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id())', t, t);
    EXECUTE format('CREATE POLICY %I_upd ON %I FOR UPDATE USING (tenant_id = get_my_tenant_id())', t, t);
    EXECUTE format('CREATE POLICY %I_del ON %I FOR DELETE USING (tenant_id = get_my_tenant_id())', t, t);
  END LOOP;
END $$;

-- ==================== INDEXES ====================
CREATE INDEX idx_his_lits_tenant    ON his_lits(tenant_id, service, statut);
CREATE INDEX idx_his_sej_tenant     ON his_sejours(tenant_id, statut);
CREATE INDEX idx_his_sej_patient    ON his_sejours(patient_id, date_entree DESC);
CREATE INDEX idx_his_urg_tenant     ON his_urgences(tenant_id, statut, priorite);
CREATE INDEX idx_his_urg_date       ON his_urgences(tenant_id, heure_arrivee DESC);
CREATE INDEX idx_his_labo_tenant    ON his_examens_labo(tenant_id, statut);
CREATE INDEX idx_his_labo_patient   ON his_examens_labo(patient_id, date_prescription DESC);
CREATE INDEX idx_his_img_tenant     ON his_examens_imagerie(tenant_id, statut);
CREATE INDEX idx_his_bloc_tenant    ON his_interventions(tenant_id, statut);
CREATE INDEX idx_his_bloc_date      ON his_interventions(tenant_id, date_prevue);
CREATE INDEX idx_his_fact_tenant    ON his_factures(tenant_id, statut);
CREATE INDEX idx_his_fact_patient   ON his_factures(patient_id, date_facture DESC);
CREATE INDEX idx_his_pers_tenant    ON his_personnel(tenant_id, actif);
CREATE INDEX idx_his_gardes_date    ON his_gardes(tenant_id, date_garde);

-- ==================== SEED ROLES ====================
INSERT INTO sector_roles (sector_id, role_key, role_label, role_label_fr, couleur, permissions) VALUES
  ('sante', 'directeur_med',  'Medical Director',   'Directeur Médical', '#7C3AED', '{"patients":true,"consultations":true,"medecins":true,"rdv":true,"urgences":true,"hospitalisation":true,"labo":true,"imagerie":true,"bloc":true,"facturation":true,"assurances":true,"rh":true,"miaa":true,"rapports":true}'),
  ('sante', 'medecin_senior', 'Senior Doctor',      'Médecin Senior',    '#2563EB', '{"patients":true,"consultations":true,"medecins":true,"rdv":true,"urgences":true,"hospitalisation":true,"labo":true,"imagerie":true,"bloc":true,"facturation":false,"assurances":false,"rh":false,"miaa":false,"rapports":false}'),
  ('sante', 'infirmier_chef', 'Head Nurse',         'Infirmier Chef',    '#16A34A', '{"patients":true,"consultations":false,"medecins":false,"rdv":true,"urgences":true,"hospitalisation":true,"labo":true,"imagerie":false,"bloc":false,"facturation":false,"assurances":false,"rh":false,"miaa":false,"rapports":false}'),
  ('sante', 'laborantin',     'Lab Technician',     'Laborantin',        '#7C3AED', '{"patients":true,"consultations":false,"medecins":false,"rdv":false,"urgences":false,"hospitalisation":false,"labo":true,"imagerie":false,"bloc":false,"facturation":false,"assurances":false,"rh":false,"miaa":false,"rapports":false}'),
  ('sante', 'radiologue',     'Radiologist',        'Radiologue',        '#0891B2', '{"patients":true,"consultations":false,"medecins":false,"rdv":false,"urgences":false,"hospitalisation":false,"labo":false,"imagerie":true,"bloc":false,"facturation":false,"assurances":false,"rh":false,"miaa":false,"rapports":false}'),
  ('sante', 'caissier_sante', 'Healthcare Cashier', 'Caissier Santé',    '#F59E0B', '{"patients":false,"consultations":false,"medecins":false,"rdv":false,"urgences":false,"hospitalisation":false,"labo":false,"imagerie":false,"bloc":false,"facturation":true,"assurances":true,"rh":false,"miaa":false,"rapports":false}')
ON CONFLICT (sector_id, role_key) DO UPDATE SET
  role_label    = EXCLUDED.role_label,
  role_label_fr = EXCLUDED.role_label_fr,
  couleur       = EXCLUDED.couleur,
  permissions   = EXCLUDED.permissions;
