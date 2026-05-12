-- =============================================
-- 024 — Academic System: Subjects, Sessions, Exams, Grades,
--        Report Cards, Attestations, Diplomas, Defenses
-- =============================================

-- subjects (matières cataloguées)
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  code          TEXT,
  coefficient   NUMERIC(4,2) DEFAULT 1,
  niveau        TEXT,
  enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- sessions_ecole (périodes académiques formelles)
CREATE TABLE IF NOT EXISTS sessions_ecole (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  type           TEXT NOT NULL CHECK(type IN (
    'trimestre1','trimestre2','trimestre3','semestre1','semestre2','annuel'
  )),
  annee_scolaire TEXT NOT NULL,
  date_debut     DATE NOT NULL,
  date_fin       DATE NOT NULL,
  statut         TEXT DEFAULT 'en_cours' CHECK(statut IN ('en_cours','cloture','archive')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- exams (épreuves liées à une session)
CREATE TABLE IF NOT EXISTS exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES sessions_ecole(id) ON DELETE SET NULL,
  classe_id   UUID REFERENCES classes_ecole(id) ON DELETE SET NULL,
  subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
  nom         TEXT NOT NULL,
  type_exam   TEXT DEFAULT 'composition' CHECK(type_exam IN (
    'devoir','composition','examen_final','rattrapage','tp','oral'
  )),
  date_exam   DATE,
  note_max    NUMERIC(5,2) DEFAULT 20,
  coefficient NUMERIC(4,2) DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- exam_grades (notes liées aux épreuves — calcul dynamique des moyennes)
CREATE TABLE IF NOT EXISTS exam_grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  etudiant_id UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  note        NUMERIC(5,2),
  absent      BOOLEAN DEFAULT false,
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, etudiant_id)
);

-- report_cards (bulletins archivés avec moyennes calculées)
CREATE TABLE IF NOT EXISTS report_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id      UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES sessions_ecole(id) ON DELETE SET NULL,
  classe_id        UUID REFERENCES classes_ecole(id) ON DELETE SET NULL,
  annee_scolaire   TEXT NOT NULL,
  moyenne_generale NUMERIC(5,2),
  rang             INTEGER,
  effectif_classe  INTEGER,
  appreciation     TEXT,
  publie           BOOLEAN DEFAULT false,
  generated_at     TIMESTAMPTZ DEFAULT now(),
  generated_by     UUID REFERENCES profiles(id),
  UNIQUE(etudiant_id, session_id)
);

-- attestations
CREATE TABLE IF NOT EXISTS attestations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id      UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  type_attestation TEXT NOT NULL CHECK(type_attestation IN (
    'inscription','scolarite','reussite','frequentation','bonne_conduite','autre'
  )),
  annee_scolaire   TEXT,
  date_emission    DATE DEFAULT CURRENT_DATE,
  numero_ref       TEXT,
  motif            TEXT,
  issued_by        UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- diplomas (émis uniquement par la Direction)
CREATE TABLE IF NOT EXISTS diplomas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id     UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  type_diplome    TEXT NOT NULL,
  mention         TEXT CHECK(mention IN ('passable','assez_bien','bien','tres_bien','excellent')),
  annee_obtention INTEGER NOT NULL,
  numero_diplome  TEXT,
  date_emission   DATE DEFAULT CURRENT_DATE,
  issued_by       UUID REFERENCES profiles(id),
  statut          TEXT DEFAULT 'en_attente' CHECK(statut IN (
    'en_attente','valide','delivre','revoque'
  )),
  observations    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- defenses / soutenances (planifiées par la Direction)
CREATE TABLE IF NOT EXISTS defenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id       UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  titre_memoire     TEXT NOT NULL,
  date_soutenance   TIMESTAMPTZ NOT NULL,
  salle             TEXT,
  directeur_memoire TEXT,
  membres_jury      TEXT,
  statut            TEXT DEFAULT 'planifie' CHECK(statut IN (
    'planifie','en_cours','passe','reporte','annule'
  )),
  note_finale       NUMERIC(5,2),
  mention           TEXT,
  observations      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_ecole ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_grades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE defenses        ENABLE ROW LEVEL SECURITY;

CREATE POLICY subjects_tenant    ON subjects       USING (tenant_id = get_my_tenant_id());
CREATE POLICY sessions_tenant    ON sessions_ecole USING (tenant_id = get_my_tenant_id());
CREATE POLICY exams_tenant       ON exams          USING (tenant_id = get_my_tenant_id());
CREATE POLICY grades_tenant      ON exam_grades    USING (tenant_id = get_my_tenant_id());
CREATE POLICY rc_tenant          ON report_cards   USING (tenant_id = get_my_tenant_id());
CREATE POLICY attest_tenant      ON attestations   USING (tenant_id = get_my_tenant_id());
CREATE POLICY diplomas_tenant    ON diplomas       USING (tenant_id = get_my_tenant_id());
CREATE POLICY defenses_tenant    ON defenses       USING (tenant_id = get_my_tenant_id());

-- Auto-generate numero_ref for attestations
CREATE OR REPLACE FUNCTION gen_attestation_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_ref IS NULL THEN
    NEW.numero_ref := 'ATT-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                      LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 9999)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attestation_ref
  BEFORE INSERT ON attestations
  FOR EACH ROW EXECUTE FUNCTION gen_attestation_ref();

-- Auto-generate numero_diplome
CREATE OR REPLACE FUNCTION gen_diploma_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_diplome IS NULL THEN
    NEW.numero_diplome := 'DIP-' || NEW.annee_obtention || '-' ||
                          LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 99999)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_diploma_number
  BEFORE INSERT ON diplomas
  FOR EACH ROW EXECUTE FUNCTION gen_diploma_number();
