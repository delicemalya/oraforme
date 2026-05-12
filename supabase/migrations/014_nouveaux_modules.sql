-- ============================================================
-- Migration 014 — Nouveaux modules oraforme
-- Trésorerie, Comptabilité, Mobile Money, Achats, Dépenses
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE : transactions (module Trésorerie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('entree', 'sortie')),
  categorie       TEXT,
  description     TEXT        NOT NULL,
  montant         NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement   TEXT        NOT NULL DEFAULT 'especes',
  reference       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: select"
  ON transactions FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "transactions: insert"
  ON transactions FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "transactions: update"
  ON transactions FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "transactions: delete"
  ON transactions FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- TABLE : journal_comptable (module Comptabilité)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_comptable (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle      TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('recette', 'depense')),
  montant_ht   NUMERIC(12,0) NOT NULL DEFAULT 0,
  tva          NUMERIC(12,0) NOT NULL DEFAULT 0,
  ca           NUMERIC(12,0) NOT NULL DEFAULT 0,
  montant_ttc  NUMERIC(12,0) NOT NULL DEFAULT 0,
  categorie    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_comptable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_comptable: select"
  ON journal_comptable FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_comptable: insert"
  ON journal_comptable FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_comptable: update"
  ON journal_comptable FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_comptable: delete"
  ON journal_comptable FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_journal_tenant_date ON journal_comptable(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- TABLE : mobile_money_transactions (module Mobile Money)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_money_transactions (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operateur           TEXT        NOT NULL CHECK (operateur IN ('airtel', 'mtn', 'wave', 'orange')),
  type                TEXT        NOT NULL CHECK (type IN ('envoi', 'reception')),
  numero_destinataire TEXT,
  nom_destinataire    TEXT,
  montant             NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  frais               NUMERIC(12,0) NOT NULL DEFAULT 0,
  reference           TEXT,
  statut              TEXT        NOT NULL DEFAULT 'en_attente',
  facture_id          UUID        REFERENCES factures(id) ON DELETE SET NULL,
  date                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mobile_money_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_money: select"
  ON mobile_money_transactions FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "mobile_money: insert"
  ON mobile_money_transactions FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "mobile_money: update"
  ON mobile_money_transactions FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "mobile_money: delete"
  ON mobile_money_transactions FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_mobile_money_tenant ON mobile_money_transactions(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- TABLE : fournisseurs (module Achats)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fournisseurs (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE POLICY "fournisseurs: select"
  ON fournisseurs FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "fournisseurs: insert"
  ON fournisseurs FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "fournisseurs: update"
  ON fournisseurs FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "fournisseurs: delete"
  ON fournisseurs FOR DELETE
  USING (tenant_id = get_my_tenant_id());

-- ────────────────────────────────────────────────────────────
-- TABLE : achats (module Achats)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achats (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fournisseur_id  UUID        REFERENCES fournisseurs(id) ON DELETE SET NULL,
  description     TEXT        NOT NULL,
  montant         NUMERIC(12,0) NOT NULL CHECK (montant > 0),
  statut          TEXT        NOT NULL DEFAULT 'impaye' CHECK (statut IN ('impaye', 'partiel', 'paye')),
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_paiement   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE achats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achats: select"
  ON achats FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "achats: insert"
  ON achats FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "achats: update"
  ON achats FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "achats: delete"
  ON achats FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_achats_tenant_date ON achats(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- TABLE : depenses (module Dépenses & Charges)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS depenses (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE POLICY "depenses: select"
  ON depenses FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "depenses: insert"
  ON depenses FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "depenses: update"
  ON depenses FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "depenses: delete"
  ON depenses FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_depenses_tenant_date ON depenses(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- UPDATE tenant POLYVALON : nouveaux modules actifs
-- ────────────────────────────────────────────────────────────
UPDATE tenants
SET modules_actifs = ARRAY[
  'facturation', 'tresorerie', 'comptabilite', 'mobilemoney',
  'stock', 'rh', 'ecole', 'restaurant',
  'achats', 'depenses', 'rapports'
]
WHERE nom_entreprise = 'POLYVALON';
