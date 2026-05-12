-- ============================================================
-- Migration 026 — ERP Financial Interconnection
-- Plan comptable OHADA + Double-entry + Exercices fiscaux
-- Transport VTC tables
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PLAN COMPTABLE (Chart of Accounts) — OHADA Standard
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number  TEXT    NOT NULL,
  account_name    TEXT    NOT NULL,
  account_type    TEXT    NOT NULL CHECK (account_type IN ('actif', 'passif', 'charge', 'produit', 'tresorerie')),
  is_debit_normal BOOLEAN NOT NULL DEFAULT true,
  parent_account  TEXT,
  tenant_id       UUID    REFERENCES tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_unique
  ON chart_of_accounts(account_number, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID));

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_of_accounts: select"
  ON chart_of_accounts FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = get_my_tenant_id());

CREATE POLICY "chart_of_accounts: insert"
  ON chart_of_accounts FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "chart_of_accounts: update"
  ON chart_of_accounts FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "chart_of_accounts: delete"
  ON chart_of_accounts FOR DELETE
  USING (tenant_id = get_my_tenant_id());

-- Seed OHADA accounts (global — tenant_id NULL)
INSERT INTO chart_of_accounts (account_number, account_name, account_type, is_debit_normal, tenant_id) VALUES
  ('101000', 'Capital social',                  'passif',     false, NULL),
  ('401000', 'Fournisseurs',                    'passif',     false, NULL),
  ('409000', 'Fournisseurs débiteurs',           'actif',      true,  NULL),
  ('411000', 'Clients',                         'actif',      true,  NULL),
  ('419000', 'Clients créditeurs',              'passif',     false, NULL),
  ('421000', 'Personnel — Rémunérations dues',  'passif',     false, NULL),
  ('431000', 'CNSS — Sécurité sociale',         'passif',     false, NULL),
  ('441000', 'État — TVA collectée',            'passif',     false, NULL),
  ('521000', 'Banque',                          'tresorerie', true,  NULL),
  ('571000', 'Caisse',                          'tresorerie', true,  NULL),
  ('601000', 'Achats de marchandises',          'charge',     true,  NULL),
  ('621000', 'Personnel extérieur',             'charge',     true,  NULL),
  ('641000', 'Rémunérations du personnel',      'charge',     true,  NULL),
  ('644000', 'Charges sociales patronales',     'charge',     true,  NULL),
  ('651000', 'Charges locatives et loyers',     'charge',     true,  NULL),
  ('661000', 'Charges financières',             'charge',     true,  NULL),
  ('681000', 'Dotations aux amortissements',    'charge',     true,  NULL),
  ('706000', 'Prestations de services',         'produit',    false, NULL),
  ('707000', 'Ventes de marchandises',          'produit',    false, NULL),
  ('708000', 'Transport facturé',               'produit',    false, NULL),
  ('709000', 'Autres produits d''exploitation', 'produit',    false, NULL)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. EXERCICES FISCAUX (Fiscal Years)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_years (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annee           INTEGER NOT NULL,
  statut          TEXT    NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'cloture')),
  solde_ouverture NUMERIC(14,0) NOT NULL DEFAULT 0,
  date_ouverture  DATE    NOT NULL DEFAULT CURRENT_DATE,
  date_cloture    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, annee)
);

ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_years: select"
  ON fiscal_years FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "fiscal_years: insert"
  ON fiscal_years FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "fiscal_years: update"
  ON fiscal_years FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

-- ────────────────────────────────────────────────────────────
-- 3. JOURNAL ENTRIES (Double-Entry Accounting)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_operation DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle        TEXT        NOT NULL,
  debit_account  TEXT        NOT NULL,
  credit_account TEXT        NOT NULL,
  montant        NUMERIC(14,0) NOT NULL CHECK (montant > 0),
  source         TEXT        DEFAULT 'tresorerie',
  source_id      UUID,
  fiscal_year    INTEGER,
  created_by     UUID        REFERENCES auth.users(id),
  validated_at   TIMESTAMPTZ,
  validated_by   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries: select"
  ON journal_entries FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_entries: insert"
  ON journal_entries FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_entries: update"
  ON journal_entries FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "journal_entries: delete"
  ON journal_entries FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date
  ON journal_entries(tenant_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source
  ON journal_entries(source, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_accounts
  ON journal_entries(tenant_id, debit_account, credit_account);

-- ────────────────────────────────────────────────────────────
-- 4. AUGMENT transactions TABLE
-- ────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source         TEXT,
  ADD COLUMN IF NOT EXISTS source_id      UUID,
  ADD COLUMN IF NOT EXISTS debit_account  TEXT,
  ADD COLUMN IF NOT EXISTS credit_account TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_year    INTEGER,
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_transactions_source
  ON transactions(source, source_id);

-- ────────────────────────────────────────────────────────────
-- 5. AUGMENT journal_comptable TABLE
-- ────────────────────────────────────────────────────────────
ALTER TABLE journal_comptable
  ADD COLUMN IF NOT EXISTS debit_account  TEXT,
  ADD COLUMN IF NOT EXISTS credit_account TEXT,
  ADD COLUMN IF NOT EXISTS source         TEXT,
  ADD COLUMN IF NOT EXISTS source_id      UUID,
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id);

-- ────────────────────────────────────────────────────────────
-- 6. TRANSPORT VTC TABLES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chauffeurs (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT    NOT NULL,
  telephone  TEXT,
  permis     TEXT,
  vehicule   TEXT,
  plaque     TEXT,
  statut     TEXT    NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chauffeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chauffeurs: select" ON chauffeurs FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "chauffeurs: insert" ON chauffeurs FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "chauffeurs: update" ON chauffeurs FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "chauffeurs: delete" ON chauffeurs FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE TABLE IF NOT EXISTS courses (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chauffeur_id UUID    REFERENCES chauffeurs(id) ON DELETE SET NULL,
  client_nom   TEXT    NOT NULL,
  client_tel   TEXT,
  depart       TEXT    NOT NULL,
  arrivee      TEXT    NOT NULL,
  distance_km  NUMERIC(6,1),
  tarif        NUMERIC(12,0) NOT NULL CHECK (tarif > 0),
  statut       TEXT    NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'en_cours', 'terminee', 'annulee')),
  date         DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses: select" ON courses FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "courses: insert" ON courses FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "courses: update" ON courses FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "courses: delete" ON courses FOR DELETE USING (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS idx_courses_tenant_date ON courses(tenant_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- 7. TRIGGER: auto-create journal entry on transactions INSERT
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_journal_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_debit       TEXT;
  v_credit      TEXT;
  v_libelle     TEXT;
  v_fiscal_year INTEGER;
BEGIN
  v_fiscal_year := EXTRACT(YEAR FROM NEW.date)::INTEGER;
  v_libelle     := COALESCE(NEW.description, NEW.categorie, 'Opération de trésorerie');

  -- Auto-derive accounts from type + category
  IF NEW.type = 'entree' THEN
    CASE COALESCE(NEW.categorie, '')
      WHEN 'Vente'           THEN v_debit := '571000'; v_credit := '707000';
      WHEN 'Facture payée'   THEN v_debit := '521000'; v_credit := '411000';
      WHEN 'Avance client'   THEN v_debit := '571000'; v_credit := '411000';
      WHEN 'Prestation'      THEN v_debit := '571000'; v_credit := '706000';
      WHEN 'Virement reçu'   THEN v_debit := '521000'; v_credit := '709000';
      WHEN 'Remboursement'   THEN v_debit := '571000'; v_credit := '409000';
      ELSE                        v_debit := '571000'; v_credit := '709000';
    END CASE;
  ELSE
    CASE COALESCE(NEW.categorie, '')
      WHEN 'Salaires'         THEN v_debit := '641000'; v_credit := '571000';
      WHEN 'Salaires & CNSS'  THEN v_debit := '641000'; v_credit := '571000';
      WHEN 'CNSS'             THEN v_debit := '644000'; v_credit := '431000';
      WHEN 'Loyer'            THEN v_debit := '651000'; v_credit := '571000';
      WHEN 'Achats'           THEN v_debit := '601000'; v_credit := '401000';
      WHEN 'Carburant'        THEN v_debit := '601000'; v_credit := '571000';
      WHEN 'Taxes'            THEN v_debit := '441000'; v_credit := '521000';
      WHEN 'Charges'          THEN v_debit := '651000'; v_credit := '571000';
      ELSE                         v_debit := '651000'; v_credit := '571000';
    END CASE;
  END IF;

  -- Use explicit account overrides if provided by the client
  IF NEW.debit_account  IS NOT NULL AND NEW.debit_account  <> '' THEN v_debit  := NEW.debit_account;  END IF;
  IF NEW.credit_account IS NOT NULL AND NEW.credit_account <> '' THEN v_credit := NEW.credit_account; END IF;

  -- Insert the journal entry
  INSERT INTO journal_entries (
    tenant_id, date_operation, libelle,
    debit_account, credit_account, montant,
    source, source_id, fiscal_year, created_by
  ) VALUES (
    NEW.tenant_id,
    NEW.date,
    v_libelle,
    v_debit,
    v_credit,
    NEW.montant,
    COALESCE(NEW.source, 'tresorerie'),
    NEW.id,
    v_fiscal_year,
    NEW.created_by
  );

  -- Write resolved accounts back to the transaction row
  UPDATE transactions
  SET
    debit_account  = v_debit,
    credit_account = v_credit,
    fiscal_year    = v_fiscal_year
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_entry ON transactions;
CREATE TRIGGER trg_auto_journal_entry
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_journal_entry();

-- ────────────────────────────────────────────────────────────
-- 8. FUNCTION: get_tenant_balance — real-time treasury balance
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_tenant_balance(
  p_tenant_id UUID,
  p_year      INTEGER DEFAULT NULL
)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entrees NUMERIC;
  v_sorties NUMERIC;
  v_opening NUMERIC;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO v_entrees
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'entree'
    AND (p_year IS NULL OR EXTRACT(YEAR FROM date)::INTEGER = p_year);

  SELECT COALESCE(SUM(montant), 0) INTO v_sorties
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'sortie'
    AND (p_year IS NULL OR EXTRACT(YEAR FROM date)::INTEGER = p_year);

  SELECT COALESCE(solde_ouverture, 0) INTO v_opening
  FROM fiscal_years
  WHERE tenant_id = p_tenant_id
    AND annee = COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER)
  LIMIT 1;

  RETURN v_opening + v_entrees - v_sorties;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 9. VIEW: grand_livre — balance by account per tenant
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW grand_livre AS
SELECT
  je.tenant_id,
  je.debit_account                                       AS account_number,
  coa.account_name,
  coa.account_type,
  COALESCE(SUM(je.montant), 0)                           AS total_debit,
  0::NUMERIC                                             AS total_credit,
  COALESCE(SUM(je.montant), 0)                           AS solde
FROM journal_entries je
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = je.debit_account
  AND (coa.tenant_id IS NULL OR coa.tenant_id = je.tenant_id)
GROUP BY je.tenant_id, je.debit_account, coa.account_name, coa.account_type

UNION ALL

SELECT
  je.tenant_id,
  je.credit_account                                      AS account_number,
  coa.account_name,
  coa.account_type,
  0::NUMERIC                                             AS total_debit,
  COALESCE(SUM(je.montant), 0)                           AS total_credit,
  -COALESCE(SUM(je.montant), 0)                          AS solde
FROM journal_entries je
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = je.credit_account
  AND (coa.tenant_id IS NULL OR coa.tenant_id = je.tenant_id)
GROUP BY je.tenant_id, je.credit_account, coa.account_name, coa.account_type;
