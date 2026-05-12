-- ============================================================
-- Migration 008 : Module École & Université
-- ============================================================

CREATE TABLE IF NOT EXISTS etudiants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id     UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  matiere         TEXT NOT NULL,
  type_note       TEXT DEFAULT 'devoir',
  note            DECIMAL(5,2) NOT NULL,
  note_max        DECIMAL(5,2) DEFAULT 20,
  coefficient     DECIMAL(3,1) DEFAULT 1,
  periode         TEXT DEFAULT 'trimestre1',
  annee_scolaire  TEXT NOT NULL DEFAULT '2024-2025',
  commentaire     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Etudiants
ALTER TABLE etudiants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_etudiants" ON etudiants           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_etudiants" ON etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_etudiants" ON etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_etudiants" ON etudiants FOR DELETE USING (tenant_id = get_my_tenant_id());

-- RLS Frais
ALTER TABLE frais_scolaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_frais"    ON frais_scolaires           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_frais"    ON frais_scolaires FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_frais"    ON frais_scolaires FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_frais"    ON frais_scolaires FOR DELETE USING (tenant_id = get_my_tenant_id());

-- RLS Paiements
ALTER TABLE paiements_scolaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_paie_sco" ON paiements_scolaires           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_paie_sco" ON paiements_scolaires FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_paie_sco" ON paiements_scolaires FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_paie_sco" ON paiements_scolaires FOR DELETE USING (tenant_id = get_my_tenant_id());

-- RLS Notes
ALTER TABLE notes_etudiants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_notes"    ON notes_etudiants           USING (tenant_id = get_my_tenant_id());
CREATE POLICY "ins_notes"    ON notes_etudiants FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "upd_notes"    ON notes_etudiants FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "del_notes"    ON notes_etudiants FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_etu_tenant   ON etudiants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etu_statut   ON etudiants(statut);
CREATE INDEX IF NOT EXISTS idx_etu_niveau   ON etudiants(niveau);
CREATE INDEX IF NOT EXISTS idx_frais_tenant ON frais_scolaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paie_etu     ON paiements_scolaires(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_paie_tenant  ON paiements_scolaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_etu    ON notes_etudiants(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_notes_tenant ON notes_etudiants(tenant_id);
