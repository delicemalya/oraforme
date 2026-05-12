-- ── Migration 025 — Rôles École, heures enseignants, liens parents ────────────

-- ── 1. HEURES ENSEIGNANTS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_hours (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enseignant_id  UUID NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  heures         NUMERIC(5,1) NOT NULL CHECK (heures > 0),
  matiere        TEXT,
  classe         TEXT,
  statut         TEXT NOT NULL DEFAULT 'declare'
                   CHECK (statut IN ('declare', 'valide', 'paye')),
  taux_horaire   NUMERIC(12,2) NOT NULL DEFAULT 0,
  valide_par     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "th_tenant_iso" ON teacher_hours
  FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS th_tenant_idx       ON teacher_hours (tenant_id);
CREATE INDEX IF NOT EXISTS th_enseignant_idx   ON teacher_hours (enseignant_id);
CREATE INDEX IF NOT EXISTS th_statut_idx       ON teacher_hours (statut);

-- ── 2. LIER ÉTUDIANT À UN COMPTE AUTH (portail self-service) ─────────────────

ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS etudiants_user_id_idx ON etudiants (user_id);

-- ── 3. LIENS PARENT ↔ ÉTUDIANT ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parent_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etudiant_id UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL DEFAULT 'parent'
                CHECK (relation IN ('parent', 'tuteur', 'autre')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, etudiant_id)
);

ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pl_tenant_iso" ON parent_links
  FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS pl_user_idx     ON parent_links (user_id);
CREATE INDEX IF NOT EXISTS pl_etudiant_idx ON parent_links (etudiant_id);

-- ── 4. SEED DES RÔLES PAR DÉFAUT POUR LE SECTEUR ÉCOLE ───────────────────────

CREATE OR REPLACE FUNCTION seed_ecole_roles(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Rôles avec accès financier (is_financial = true)
  INSERT INTO roles (tenant_id, name, description, color, is_financial) VALUES
    (p_tenant_id, 'DIRECTION_GENERALE', 'Direction Générale — vue globale + finances',   '#F0A30A', true),
    (p_tenant_id, 'RAF',                'RAF — trésorerie, paie, comptabilité',           '#388BFD', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- Rôles sans accès financier
  INSERT INTO roles (tenant_id, name, description, color, is_financial) VALUES
    (p_tenant_id, 'SCOLARITE',   'Scolarité — inscriptions, notes, absences, bulletins', '#2EA043', false),
    (p_tenant_id, 'RH_PAIE',    'RH & Paie — personnel, contrats, salaires',             '#8B5CF6', false),
    (p_tenant_id, 'FORMATEUR',  'Formateur / Enseignant — cours, examens, heures',       '#06B6D4', false),
    (p_tenant_id, 'ETUDIANT',   'Étudiant / Élève — notes, absences, emploi du temps',  '#EC4899', false),
    (p_tenant_id, 'PARENT',     'Parent / Tuteur — suivi de l''enfant',                  '#F97316', false),
    (p_tenant_id, 'DTI',        'Direction des Technologies — systèmes & accès',         '#84CC16', false),
    (p_tenant_id, 'DAAC',       'Direction Académique — programmes, diplômes, validation','#EF4444', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

-- ── 5. SEED AUTOMATIQUE À LA CRÉATION D'UN TENANT ÉCOLE ──────────────────────

CREATE OR REPLACE FUNCTION auto_seed_ecole_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.secteur_activite = 'ecole' THEN
    PERFORM seed_ecole_roles(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_seed_ecole_roles ON tenants;
CREATE TRIGGER trg_auto_seed_ecole_roles
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION auto_seed_ecole_roles();

-- ── 6. SEED MANUEL POUR LES TENANTS ÉCOLE EXISTANTS ─────────────────────────
-- Exécute le seed pour tous les tenants école déjà créés

DO $$
DECLARE
  tid UUID;
BEGIN
  FOR tid IN
    SELECT id FROM tenants WHERE secteur_activite = 'ecole'
  LOOP
    PERFORM seed_ecole_roles(tid);
  END LOOP;
END;
$$;

-- ── 7. COLONNE role_name SUR PROFILES (cache lisible du rôle dynamique) ───────
-- Peuplé par trigger quand dynamic_role_id est mis à jour

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ecole_role_name TEXT;

CREATE OR REPLACE FUNCTION sync_ecole_role_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.dynamic_role_id IS NOT NULL AND NEW.dynamic_role_id IS DISTINCT FROM OLD.dynamic_role_id THEN
    SELECT name INTO NEW.ecole_role_name
    FROM roles WHERE id = NEW.dynamic_role_id;
  ELSIF NEW.dynamic_role_id IS NULL THEN
    NEW.ecole_role_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ecole_role_name ON profiles;
CREATE TRIGGER trg_sync_ecole_role_name
  BEFORE UPDATE OF dynamic_role_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_ecole_role_name();

-- ── 8. TABLE NOTIFICATIONS (alertes en temps réel) ───────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = global (tous)
  title       TEXT NOT NULL,
  message     TEXT,
  type        TEXT NOT NULL DEFAULT 'info'
                CHECK (type IN ('info', 'warning', 'success', 'error')),
  read        BOOLEAN NOT NULL DEFAULT false,
  link        TEXT, -- URL de redirection optionnelle
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_tenant_iso" ON notifications
  FOR ALL
  USING  (tenant_id = get_my_tenant_id() AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS notif_tenant_idx  ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS notif_user_idx    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notif_read_idx    ON notifications (read);

-- ── 9. AMÉLIORER LA TABLE ABSENCES_ECOLE ─────────────────────────────────────
-- Ajouter un champ heure pour distinguer matin/après-midi

ALTER TABLE absences_etudiants ADD COLUMN IF NOT EXISTS demi_journee TEXT
  CHECK (demi_journee IN ('matin', 'apres_midi', 'journee_complete')) DEFAULT 'journee_complete';

ALTER TABLE absences_etudiants ADD COLUMN IF NOT EXISTS notifie_sms  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE absences_etudiants ADD COLUMN IF NOT EXISTS notifie_email BOOLEAN NOT NULL DEFAULT false;

-- ── 10. INDEX PERFORMANCES SUPPLÉMENTAIRES ────────────────────────────────────

CREATE INDEX IF NOT EXISTS absences_date_idx      ON absences_etudiants (date_absence);
CREATE INDEX IF NOT EXISTS absences_etudiant_idx  ON absences_etudiants (etudiant_id);
CREATE INDEX IF NOT EXISTS etudiants_statut_idx   ON etudiants (statut);
CREATE INDEX IF NOT EXISTS etudiants_niveau_idx   ON etudiants (niveau);
