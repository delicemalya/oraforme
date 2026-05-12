-- =====================================================================
-- CATCH-UP SCRIPT — Migrations 008 → 025 (fully idempotent)
-- Paste the ENTIRE file in Supabase SQL Editor, then click Run.
-- Safe to run multiple times — uses IF NOT EXISTS everywhere.
-- =====================================================================

-- ══════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (migration 003 / 022)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 014 — Trésorerie, Comptabilité, Achats, Dépenses
-- (contient la table transactions — manquante dans votre base)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('entree', 'sortie')),
  categorie     TEXT,
  description   TEXT        NOT NULL,
  montant       NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement TEXT        NOT NULL DEFAULT 'especes',
  reference     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "transactions: select" ON transactions FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "transactions: insert" ON transactions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "transactions: update" ON transactions FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "transactions: delete" ON transactions FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS journal_comptable (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle     TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('recette', 'depense')),
  montant_ht  NUMERIC(12,0) NOT NULL DEFAULT 0,
  tva         NUMERIC(12,0) NOT NULL DEFAULT 0,
  ca          NUMERIC(12,0) NOT NULL DEFAULT 0,
  montant_ttc NUMERIC(12,0) NOT NULL DEFAULT 0,
  categorie   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_comptable ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "journal_comptable: select" ON journal_comptable FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "journal_comptable: insert" ON journal_comptable FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "journal_comptable: update" ON journal_comptable FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "journal_comptable: delete" ON journal_comptable FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS fournisseurs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT        NOT NULL,
  contact    TEXT,
  telephone  TEXT,
  email      TEXT,
  adresse    TEXT,
  solde_du   NUMERIC(12,0) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "fournisseurs: select" ON fournisseurs FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "fournisseurs: insert" ON fournisseurs FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "fournisseurs: update" ON fournisseurs FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "fournisseurs: delete" ON fournisseurs FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS achats (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fournisseur_id UUID        REFERENCES fournisseurs(id) ON DELETE SET NULL,
  description    TEXT        NOT NULL,
  montant        NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  statut         TEXT        NOT NULL DEFAULT 'impaye' CHECK (statut IN ('impaye', 'partiel', 'paye')),
  date           DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_paiement  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "achats: select" ON achats FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "achats: insert" ON achats FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "achats: update" ON achats FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "achats: delete" ON achats FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS depenses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categorie        TEXT        NOT NULL,
  description      TEXT,
  montant          NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement    TEXT        NOT NULL DEFAULT 'especes',
  justificatif_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "depenses: select" ON depenses FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "depenses: insert" ON depenses FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "depenses: update" ON depenses FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "depenses: delete" ON depenses FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_tenant_date      ON journal_comptable(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_achats_tenant_date       ON achats(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_depenses_tenant_date     ON depenses(tenant_id, date DESC);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 021 — source tracking on transactions
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source    TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_source
  ON transactions(tenant_id, source)
  WHERE source IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 008 — École : étudiants, frais, paiements, notes
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS etudiants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  numero_id         TEXT NOT NULL,
  photo_url         TEXT,
  nom               TEXT NOT NULL,
  prenom            TEXT NOT NULL,
  date_naissance    DATE,
  lieu_naissance    TEXT,
  nationalite       TEXT DEFAULT 'Congolaise',
  adresse           TEXT,
  niveau            TEXT DEFAULT 'lycee',
  classe            TEXT,
  statut            TEXT DEFAULT 'actif',
  nom_pere          TEXT,
  nom_mere          TEXT,
  tel_parent        TEXT,
  email_parent      TEXT,
  profession_parent TEXT,
  nom_tuteur        TEXT,
  tel_tuteur        TEXT,
  lien_tuteur       TEXT,
  annee_scolaire    TEXT DEFAULT '2024-2025',
  code_deblocage    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero_id)
);

CREATE TABLE IF NOT EXISTS frais_scolaires (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  libelle     TEXT NOT NULL,
  montant     DECIMAL(12,0) NOT NULL DEFAULT 0,
  type_frais  TEXT DEFAULT 'inscription',
  obligatoire BOOLEAN DEFAULT true,
  actif       BOOLEAN DEFAULT true,
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paiements_scolaires (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  frais_id    UUID REFERENCES frais_scolaires(id) ON DELETE SET NULL,
  libelle     TEXT NOT NULL,
  montant     DECIMAL(12,0) NOT NULL,
  mois        INTEGER CHECK (mois BETWEEN 1 AND 12),
  annee       INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  statut      TEXT DEFAULT 'paye',
  methode     TEXT DEFAULT 'especes',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes_etudiants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id    UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  matiere        TEXT NOT NULL,
  type_note      TEXT DEFAULT 'devoir',
  note           DECIMAL(5,2) NOT NULL,
  note_max       DECIMAL(5,2) DEFAULT 20,
  coefficient    DECIMAL(3,1) DEFAULT 1,
  periode        TEXT DEFAULT 'trimestre1',
  annee_scolaire TEXT NOT NULL DEFAULT '2024-2025',
  commentaire    TEXT,
  publie         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE etudiants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE frais_scolaires  ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements_scolaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_etudiants  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "sel_etudiants" ON etudiants           USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ins_etudiants" ON etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "upd_etudiants" ON etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "del_etudiants" ON etudiants FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "sel_frais" ON frais_scolaires           USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ins_frais" ON frais_scolaires FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "upd_frais" ON frais_scolaires FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "del_frais" ON frais_scolaires FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "sel_paie_sco" ON paiements_scolaires           USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ins_paie_sco" ON paiements_scolaires FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "upd_paie_sco" ON paiements_scolaires FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "del_paie_sco" ON paiements_scolaires FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "sel_notes" ON notes_etudiants           USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ins_notes" ON notes_etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "upd_notes" ON notes_etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "del_notes" ON notes_etudiants FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_etu_tenant   ON etudiants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etu_statut   ON etudiants(statut);
CREATE INDEX IF NOT EXISTS idx_etu_niveau   ON etudiants(niveau);
CREATE INDEX IF NOT EXISTS idx_frais_tenant ON frais_scolaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paie_etu     ON paiements_scolaires(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_paie_tenant  ON paiements_scolaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_etu    ON notes_etudiants(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant ON notes_etudiants(tenant_id);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 011 — Absences étudiants
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS absences_etudiants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id   UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  date_absence  DATE NOT NULL DEFAULT CURRENT_DATE,
  matiere       TEXT,
  justifiee     BOOLEAN DEFAULT false,
  motif         TEXT,
  notifie_parent BOOLEAN NOT NULL DEFAULT false,
  -- added by 025
  demi_journee  TEXT DEFAULT 'journee_complete'
                CHECK (demi_journee IN ('matin', 'apres_midi', 'journee_complete')),
  notifie_sms   BOOLEAN NOT NULL DEFAULT false,
  notifie_email BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE absences_etudiants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "sel_absences" ON absences_etudiants           USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ins_absences" ON absences_etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "upd_absences" ON absences_etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "del_absences" ON absences_etudiants FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_abs_tenant     ON absences_etudiants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_etu        ON absences_etudiants(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_abs_date       ON absences_etudiants(date_absence);
CREATE INDEX IF NOT EXISTS idx_etu_code       ON etudiants(code_deblocage) WHERE code_deblocage IS NOT NULL;
CREATE INDEX IF NOT EXISTS absences_date_idx  ON absences_etudiants (date_absence);
CREATE INDEX IF NOT EXISTS absences_etudiant_idx ON absences_etudiants (etudiant_id);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 018 — Enseignants, Classes, Planning
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS enseignants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  prenom     TEXT NOT NULL,
  matiere    TEXT,
  telephone  TEXT,
  email      TEXT,
  statut     TEXT NOT NULL DEFAULT 'actif'
             CHECK (statut IN ('actif', 'conge', 'inactif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

ALTER TABLE enseignants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes_ecole  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_ecole ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "enseignants: select" ON enseignants FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "enseignants: insert" ON enseignants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "enseignants: update" ON enseignants FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "enseignants: delete" ON enseignants FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "classes: select" ON classes_ecole FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "classes: insert" ON classes_ecole FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "classes: update" ON classes_ecole FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "classes: delete" ON classes_ecole FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "planning: select" ON planning_ecole FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "planning: insert" ON planning_ecole FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "planning: update" ON planning_ecole FOR UPDATE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "planning: delete" ON planning_ecole FOR DELETE USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_enseignants_tenant ON enseignants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant     ON classes_ecole(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planning_tenant    ON planning_ecole(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planning_date      ON planning_ecole(date_debut);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 022 — RBAC : spaces, user_permissions, team_invites
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS spaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "spaces_tenant_iso" ON spaces FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT true,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, module_key)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "up_read"         ON user_permissions FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "up_owner_write"  ON user_permissions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "up_owner_update" ON user_permissions FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner') WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "up_owner_delete" ON user_permissions FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS team_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('admin', 'membre')),
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ti_tenant_iso" ON team_invites FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS user_permissions_profile_idx ON user_permissions (profile_id);
CREATE INDEX IF NOT EXISTS user_permissions_tenant_idx  ON user_permissions (tenant_id);
CREATE INDEX IF NOT EXISTS team_invites_token_idx       ON team_invites (token);
CREATE INDEX IF NOT EXISTS team_invites_email_idx       ON team_invites (email);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 023 — Rôles dynamiques, comptes comptables, triggers
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL DEFAULT '#8B949E',
  is_financial BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "roles_read"  ON roles FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "roles_write" ON roles FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "roles_upd"   ON roles FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "roles_del"   ON roles FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module_key)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "rp_read"  ON role_permissions FOR SELECT USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rp_write" ON role_permissions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rp_upd"   ON role_permissions FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rp_del"   ON role_permissions FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dynamic_role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  number      TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('actif', 'passif', 'charge', 'produit', 'tresorerie')),
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, number)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "acc_iso" ON accounts FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS label      TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_source_unique'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_source_unique UNIQUE (tenant_id, source, source_id);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION sync_paiement_scolaire_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.statut = 'paye' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'paye') THEN
    INSERT INTO transactions (
      tenant_id, type, montant, label, description,
      source, source_id, date, mode_paiement
    ) VALUES (
      NEW.tenant_id, 'entree', NEW.montant,
      COALESCE(NEW.libelle, 'Paiement scolaire'),
      'Synchronisation automatique depuis paiements_scolaires',
      'paiements_scolaires', NEW.id, CURRENT_DATE,
      COALESCE(NEW.methode, 'especes')
    )
    ON CONFLICT (tenant_id, source, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiement_to_transaction ON paiements_scolaires;
CREATE TRIGGER trg_paiement_to_transaction
  AFTER INSERT OR UPDATE OF statut ON paiements_scolaires
  FOR EACH ROW EXECUTE FUNCTION sync_paiement_scolaire_to_transaction();

CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance +
      CASE
        WHEN NEW.type IN ('entree', 'income', 'recette') THEN  NEW.montant
        ELSE                                                   -NEW.montant
      END
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_account_balance ON transactions;
CREATE TRIGGER trg_update_account_balance
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

CREATE INDEX IF NOT EXISTS roles_tenant_idx          ON roles (tenant_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS accounts_tenant_idx       ON accounts (tenant_id);
CREATE INDEX IF NOT EXISTS transactions_account_idx  ON transactions (account_id);
CREATE INDEX IF NOT EXISTS profiles_dynrole_idx      ON profiles (dynamic_role_id);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 024 — Académique : matières, sessions, examens, bulletins
-- ══════════════════════════════════════════════════════════════════════

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

CREATE TABLE IF NOT EXISTS attestations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id      UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  type_attestation TEXT NOT NULL CHECK(type_attestation IN (
    'inscription','scolarite','reussite','frequentation','bonne_conduite','autre'
  )),
  annee_scolaire TEXT,
  date_emission  DATE DEFAULT CURRENT_DATE,
  numero_ref     TEXT,
  motif          TEXT,
  issued_by      UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

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
  observations TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

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
  note_finale  NUMERIC(5,2),
  mention      TEXT,
  observations TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_ecole ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_grades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE defenses        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY subjects_tenant ON subjects    USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sessions_tenant ON sessions_ecole USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY exams_tenant    ON exams       USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY grades_tenant   ON exam_grades USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rc_tenant       ON report_cards USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY attest_tenant   ON attestations USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY diplomas_tenant ON diplomas    USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY defenses_tenant ON defenses    USING (tenant_id = get_my_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

DROP TRIGGER IF EXISTS trg_attestation_ref ON attestations;
CREATE TRIGGER trg_attestation_ref
  BEFORE INSERT ON attestations
  FOR EACH ROW EXECUTE FUNCTION gen_attestation_ref();

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

DROP TRIGGER IF EXISTS trg_diploma_number ON diplomas;
CREATE TRIGGER trg_diploma_number
  BEFORE INSERT ON diplomas
  FOR EACH ROW EXECUTE FUNCTION gen_diploma_number();

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION 025 — Heures enseignants, portail étudiant/parent, notifs
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS teacher_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enseignant_id UUID NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  heures        NUMERIC(5,1) NOT NULL CHECK (heures > 0),
  matiere       TEXT,
  classe        TEXT,
  statut        TEXT NOT NULL DEFAULT 'declare'
                CHECK (statut IN ('declare', 'valide', 'paye')),
  taux_horaire  NUMERIC(12,2) NOT NULL DEFAULT 0,
  valide_par    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_hours ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "th_tenant_iso" ON teacher_hours FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
DO $$ BEGIN
  CREATE POLICY "pl_tenant_iso" ON parent_links FOR ALL
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT NOT NULL DEFAULT 'info'
             CHECK (type IN ('info', 'warning', 'success', 'error')),
  read       BOOLEAN NOT NULL DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "notif_tenant_iso" ON notifications FOR ALL
    USING (tenant_id = get_my_tenant_id() AND (user_id IS NULL OR user_id = auth.uid()))
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ecole_role_name TEXT;

CREATE OR REPLACE FUNCTION seed_ecole_roles(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO roles (tenant_id, name, description, color, is_financial) VALUES
    (p_tenant_id, 'DIRECTION_GENERALE', 'Direction Générale — vue globale + finances',    '#F0A30A', true),
    (p_tenant_id, 'RAF',                'RAF — trésorerie, paie, comptabilité',            '#388BFD', true),
    (p_tenant_id, 'SCOLARITE',   'Scolarité — inscriptions, notes, absences, bulletins',  '#2EA043', false),
    (p_tenant_id, 'RH_PAIE',    'RH & Paie — personnel, contrats, salaires',              '#8B5CF6', false),
    (p_tenant_id, 'FORMATEUR',  'Formateur / Enseignant — cours, examens, heures',        '#06B6D4', false),
    (p_tenant_id, 'ETUDIANT',   'Étudiant / Élève — notes, absences, emploi du temps',   '#EC4899', false),
    (p_tenant_id, 'PARENT',     'Parent / Tuteur — suivi de l''enfant',                   '#F97316', false),
    (p_tenant_id, 'DTI',        'Direction des Technologies — systèmes & accès',          '#84CC16', false),
    (p_tenant_id, 'DAAC',       'Direction Académique — programmes, diplômes, validation', '#EF4444', false)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

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

-- Seed roles for any existing école tenants
DO $$
DECLARE tid UUID;
BEGIN
  FOR tid IN SELECT id FROM tenants WHERE secteur_activite = 'ecole'
  LOOP
    PERFORM seed_ecole_roles(tid);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION sync_ecole_role_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.dynamic_role_id IS NOT NULL AND NEW.dynamic_role_id IS DISTINCT FROM OLD.dynamic_role_id THEN
    SELECT name INTO NEW.ecole_role_name FROM roles WHERE id = NEW.dynamic_role_id;
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

-- Indexes
CREATE INDEX IF NOT EXISTS th_tenant_idx        ON teacher_hours (tenant_id);
CREATE INDEX IF NOT EXISTS th_enseignant_idx    ON teacher_hours (enseignant_id);
CREATE INDEX IF NOT EXISTS th_statut_idx        ON teacher_hours (statut);
CREATE INDEX IF NOT EXISTS etudiants_user_id_idx ON etudiants (user_id);
CREATE INDEX IF NOT EXISTS pl_user_idx          ON parent_links (user_id);
CREATE INDEX IF NOT EXISTS pl_etudiant_idx      ON parent_links (etudiant_id);
CREATE INDEX IF NOT EXISTS notif_tenant_idx     ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS notif_user_idx       ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notif_read_idx       ON notifications (read);
CREATE INDEX IF NOT EXISTS etudiants_statut_idx ON etudiants (statut);
CREATE INDEX IF NOT EXISTS etudiants_niveau_idx ON etudiants (niveau);

-- ══════════════════════════════════════════════════════════════════════
-- DONE ✓  All tables from migrations 008-025 are now in place.
-- ══════════════════════════════════════════════════════════════════════
