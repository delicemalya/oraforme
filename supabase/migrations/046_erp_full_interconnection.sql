-- ============================================================================
-- Migration 046 — ERP Full Financial Interconnection (OHADA Compliant)
-- Date: 2026-05-24
-- RÈGLE ABSOLUE: Toute opération financière →
--   1. Écriture comptable  2. Trésorerie  3. Journal  4. Grand livre  5. Analytics
-- ============================================================================

-- ── 0. Comptes OHADA manquants ────────────────────────────────────────────────

INSERT INTO chart_of_accounts
  (account_number, account_name, account_type, is_debit_normal, tenant_id)
VALUES
  ('444000', 'Etat — TVA deductible',                 'actif',      true,  NULL),
  ('512000', 'Cheques a encaisser',                   'tresorerie', true,  NULL),
  ('571100', 'Mobile Money Airtel',                   'tresorerie', true,  NULL),
  ('571200', 'Mobile Money MTN MoMo',                 'tresorerie', true,  NULL),
  ('707000', 'Ventes de marchandises',                'produit',    false, NULL),
  ('709000', 'Rabais remises ristournes accordes',    'produit',    false, NULL),
  ('310000', 'Stocks de marchandises',                'actif',      true,  NULL),
  ('770000', 'Revenus financiers',                    'produit',    false, NULL)
ON CONFLICT DO NOTHING;

-- ── 1. TABLE bulletins_paie (migration 007 non exécutée) ─────────────────────
-- CREATE TABLE IF NOT EXISTS = idempotent si déjà existante

CREATE TABLE IF NOT EXISTS bulletins_paie (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID    REFERENCES tenants(id) ON DELETE CASCADE,
  employe_id      UUID    REFERENCES employes(id) ON DELETE SET NULL,
  mois            INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee           INTEGER NOT NULL,
  salaire_base    DECIMAL(12,0) NOT NULL DEFAULT 0,
  primes          DECIMAL(12,0) DEFAULT 0,
  heures_sup      DECIMAL(6,2)  DEFAULT 0,
  taux_horaire    DECIMAL(10,0) DEFAULT 0,
  brut            DECIMAL(12,0) NOT NULL DEFAULT 0,
  cnss_salarie    DECIMAL(12,0) NOT NULL DEFAULT 0,
  cnss_patronal   DECIMAL(12,0) NOT NULL DEFAULT 0,
  irpp            DECIMAL(12,0) NOT NULL DEFAULT 0,
  net             DECIMAL(12,0) NOT NULL DEFAULT 0,
  mode_paiement   TEXT          NOT NULL DEFAULT 'virement',
  statut          TEXT          NOT NULL DEFAULT 'generee'
    CHECK (statut IN ('generee', 'validee', 'payee')),
  date_paiement   DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (employe_id, mois, annee)
);

ALTER TABLE bulletins_paie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_paie"   ON bulletins_paie;
DROP POLICY IF EXISTS "insert_paie"   ON bulletins_paie;
DROP POLICY IF EXISTS "update_paie"   ON bulletins_paie;
DROP POLICY IF EXISTS "delete_paie"   ON bulletins_paie;

CREATE POLICY "tenant_paie" ON bulletins_paie
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "insert_paie" ON bulletins_paie
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "update_paie" ON bulletins_paie
  FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "delete_paie" ON bulletins_paie
  FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_paie_tenant  ON bulletins_paie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paie_employe ON bulletins_paie(employe_id);
CREATE INDEX IF NOT EXISTS idx_paie_periode ON bulletins_paie(annee, mois);

-- ── 2. Colonnes manquantes ────────────────────────────────────────────────────

-- factures : tva_montant pour journal accrual
ALTER TABLE factures ADD COLUMN IF NOT EXISTS tva_montant NUMERIC(14,2) DEFAULT 0;

-- achats : date_paiement (déjà dans migration 014, idempotent)
ALTER TABLE achats ADD COLUMN IF NOT EXISTS date_paiement DATE DEFAULT NULL;

-- bulletins_paie : mode_paiement (inclus dans CREATE TABLE ci-dessus, idempotent)
ALTER TABLE bulletins_paie ADD COLUMN IF NOT EXISTS mode_paiement TEXT DEFAULT 'virement';

-- virements : direction + comptes OHADA explicites
ALTER TABLE virements ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'externe'
  CHECK (direction IN ('interne', 'externe'));
ALTER TABLE virements ADD COLUMN IF NOT EXISTS compte_ohada_debit  TEXT DEFAULT '401000';
ALTER TABLE virements ADD COLUMN IF NOT EXISTS compte_ohada_credit TEXT DEFAULT '521000';

-- cheques.tiers_id : dépend de la table tiers (migration 045) — à décommenter après 045
-- ALTER TABLE cheques ADD COLUMN IF NOT EXISTS tiers_id UUID REFERENCES tiers(id) ON DELETE SET NULL;

-- ── 2. TABLE transfers — mouvements inter-comptes ─────────────────────────────
-- Modélise : caisse↔banque, banque↔mobile, caisse↔caisse

CREATE TABLE IF NOT EXISTS transfers (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  source_type      TEXT        NOT NULL CHECK (source_type IN ('caisse','banque','mobile_money','externe')),
  source_id        UUID,
  source_compte    TEXT        NOT NULL,

  dest_type        TEXT        NOT NULL CHECK (dest_type IN ('caisse','banque','mobile_money','externe')),
  dest_id          UUID,
  dest_compte      TEXT        NOT NULL,

  montant          NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  frais            NUMERIC(14,2) NOT NULL DEFAULT 0,
  libelle          TEXT,
  reference        TEXT,
  date_transfert   DATE          NOT NULL DEFAULT CURRENT_DATE,

  statut           TEXT        NOT NULL DEFAULT 'execute'
    CHECK (statut IN ('en_attente','execute','annule')),

  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfers_tenant_all" ON transfers;
CREATE POLICY "transfers_tenant_all" ON transfers
  FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date   ON transfers(tenant_id, date_transfert DESC);

-- ── 3. TABLE mobile_wallet_operations — flux wallet avec journal ──────────────
-- Table distincte de mobile_money_transactions (migration 014) qui est orientée
-- envoi/réception ; celle-ci est orientée trésorerie / comptabilité par wallet.

CREATE TABLE IF NOT EXISTS mobile_wallet_operations (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id      UUID        NOT NULL REFERENCES mobile_money_wallets(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN ('entree','sortie')),
  montant        NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  frais          NUMERIC(14,2) NOT NULL DEFAULT 0,
  libelle        TEXT,
  reference      TEXT,
  source         TEXT,
  source_id      UUID,
  date_operation DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mobile_wallet_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mwo_tenant_all" ON mobile_wallet_operations;
CREATE POLICY "mwo_tenant_all" ON mobile_wallet_operations
  FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_mwo_wallet ON mobile_wallet_operations(wallet_id);
CREATE INDEX IF NOT EXISTS idx_mwo_tenant ON mobile_wallet_operations(tenant_id, date_operation DESC);

-- Colonne solde_actuel si pas encore présente sur les wallets
ALTER TABLE mobile_money_wallets ADD COLUMN IF NOT EXISTS last_operation_at TIMESTAMPTZ;

-- ── 4. TRIGGER: Facture émise → accrual OHADA 411/706/441 ────────────────────
-- Dès que statut = 'envoyee':
--   Débit  411000 Clients / Crédit 706000 Prestations (HT)
--   Débit  411000 Clients / Crédit 441000 TVA collectée (si tva_montant > 0)

CREATE OR REPLACE FUNCTION fn_facture_issued_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_fac_issued$
DECLARE
  v_year    INT;
  v_ht      NUMERIC(14,2);
  v_tva     NUMERIC(14,2);
  v_libelle TEXT;
  v_date    DATE;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'envoyee') AND NEW.statut = 'envoyee' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'factures_emises' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_date    := COALESCE(NEW.due_date, CURRENT_DATE);
    v_year    := EXTRACT(YEAR FROM v_date)::INT;
    v_tva     := COALESCE(NEW.tva_montant, 0);
    v_ht      := GREATEST(COALESCE(NEW.total, 0) - v_tva, 0);
    v_libelle := 'Facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

    -- Clients / Prestations HT
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, v_date, v_libelle, '411000', '706000', v_ht, 'factures_emises', NEW.id, v_year);

    -- TVA collectée
    IF v_tva > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — TVA collectee', '411000', '441000', v_tva, 'factures_tva', NEW.id, v_year);
    END IF;

    -- Transaction trésorerie prévisionnelle
    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Facturation', v_libelle, COALESCE(NEW.total, 0), v_date, 'facture',
       'factures_emises', NEW.id, '411000', '706000', v_year);
  END IF;
  RETURN NEW;
END
$fn_fac_issued$;

DROP TRIGGER IF EXISTS trg_facture_issued ON factures;
CREATE TRIGGER trg_facture_issued
  AFTER UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_issued_to_journal();

-- ── 5. TRIGGER: Facture payée → apurement client 521→411 ──────────────────────

CREATE OR REPLACE FUNCTION fn_facture_paid_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_fac_paid$
DECLARE
  v_year    INT;
  v_compte  TEXT;
  v_libelle TEXT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'factures_paiement' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_compte  := fn_ohada_cash_account(COALESCE(NEW.moyen_paiement, 'virement'));
    v_libelle := 'Reglement facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, CURRENT_DATE, v_libelle, v_compte, '411000', COALESCE(NEW.total, 0),
       'factures_paiement', NEW.id, v_year);

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Facturation', v_libelle, COALESCE(NEW.total, 0), CURRENT_DATE,
       COALESCE(NEW.moyen_paiement, 'virement'), 'factures_paiement', NEW.id, v_compte, '411000', v_year);
  END IF;
  RETURN NEW;
END
$fn_fac_paid$;

DROP TRIGGER IF EXISTS trg_facture_paid ON factures;
CREATE TRIGGER trg_facture_paid
  AFTER UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_paid_to_journal();

-- ── 6. TRIGGER: Achat enregistré → stock capitalisé (CORRECTION 044) ─────────
-- CORRECTION: migration 044 postait 601000/401000 → faux pour achat non consommé
-- OHADA : achat de marchandises → 310000 Stock / 401000 Fournisseurs
-- La consommation stock (déjà dans fn_stock_out_to_journal) poste 601000/310000

CREATE OR REPLACE FUNCTION fn_achat_enregistrement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_ach_reg$
BEGIN
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE source = 'achats_enregistrement' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
  ) THEN RETURN NEW; END IF;

  INSERT INTO journal_entries
    (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
  VALUES
    (NEW.tenant_id, NEW.date, 'Achat — ' || COALESCE(NEW.description, 'achat'),
     '310000', '401000', NEW.montant, 'achats_enregistrement', NEW.id, EXTRACT(YEAR FROM NEW.date)::INT);

  RETURN NEW;
END
$fn_ach_reg$;

DROP TRIGGER IF EXISTS trg_achat_enregistrement ON achats;
CREATE TRIGGER trg_achat_enregistrement
  AFTER INSERT ON achats
  FOR EACH ROW EXECUTE FUNCTION fn_achat_enregistrement();

-- ── 7. TRIGGER: Entrée stock IN → journal 310000/401000 ──────────────────────
-- Complète fn_stock_out_to_journal (migration 044) pour les entrées directes

CREATE OR REPLACE FUNCTION fn_stock_in_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_stock_in$
DECLARE
  v_prix_achat NUMERIC(14,2);
  v_montant    NUMERIC(14,2);
  v_nom        TEXT;
BEGIN
  IF NEW.type = 'IN' THEN
    SELECT COALESCE(prix_achat, 0), nom
    INTO v_prix_achat, v_nom
    FROM products
    WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id;

    v_montant := GREATEST(NEW.quantite * COALESCE(v_prix_achat, 0), 0);

    IF v_montant > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, NEW.created_at::date,
         'Entree stock ' || COALESCE(v_nom, COALESCE(NEW.note, 'stock')),
         '310000', '401000', v_montant, 'stock_in', NEW.id, EXTRACT(YEAR FROM NEW.created_at)::INT);
    END IF;
  END IF;
  RETURN NEW;
END
$fn_stock_in$;

DROP TRIGGER IF EXISTS trg_stock_in_to_journal ON stock_movements;
CREATE TRIGGER trg_stock_in_to_journal
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_stock_in_to_journal();

-- ── 8. TRIGGER: Bulletin de paie → triplet OHADA ─────────────────────────────
-- Table réelle : bulletins_paie
-- Colonnes     : brut, net, cnss_salarie, cnss_patronal, irpp
-- Statuts      : 'generee' → 'validee' → 'payee'
--
-- Écriture A (validation) :
--   641000 Salaires vs 421000 Personnel dû  (brut)
--   644000 CNSS patronal vs 431000 CNSS     (cnss_patronal)
-- Écriture B (paiement) :
--   421000 Personnel vs 521000/571000        (net = brut - cnss_salarie - irpp)

CREATE OR REPLACE FUNCTION fn_bulletins_paie_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_paie$
DECLARE
  v_year     INT;
  v_credit   TEXT;
  v_libelle  TEXT;
  v_net      NUMERIC(14,2);
  v_date     DATE;
BEGIN
  -- ── Accrual à la validation ─────────────────────────────────────────────────
  IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'paie_accrual' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_year    := EXTRACT(YEAR FROM v_date)::INT;
      v_libelle := 'Bulletin paie ' || NEW.mois || '/' || NEW.annee;

      -- A1. Salaire brut : 641000 / 421000
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — salaire brut',
         '641000', '421000', COALESCE(NEW.brut, 0), 'paie_accrual', NEW.id, v_year);

      -- A2. CNSS patronal : 644000 / 431000
      IF COALESCE(NEW.cnss_patronal, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS patronal',
           '644000', '431000', NEW.cnss_patronal, 'paie_cnss', NEW.id, v_year);
      END IF;
    END IF;
  END IF;

  -- ── Paiement ────────────────────────────────────────────────────────────────
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'paie_paiement' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_year    := EXTRACT(YEAR FROM v_date)::INT;
      v_libelle := 'Virement salaires ' || NEW.mois || '/' || NEW.annee;
      v_credit  := fn_ohada_cash_account(COALESCE(NEW.mode_paiement, 'virement'));

      -- Net = brut - cnss_salarie - irpp
      v_net := GREATEST(
        COALESCE(NEW.brut, 0) - COALESCE(NEW.cnss_salarie, 0) - COALESCE(NEW.irpp, 0),
        0
      );

      -- B. Paiement net : 421000 / Trésorerie
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle, '421000', v_credit, v_net, 'paie_paiement', NEW.id, v_year);

      -- Transaction trésorerie
      INSERT INTO transactions
        (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
      VALUES
        (NEW.tenant_id, 'sortie', 'Paie', v_libelle, v_net, v_date,
         COALESCE(NEW.mode_paiement, 'virement'), 'paie', NEW.id, '421000', v_credit, v_year);
    END IF;
  END IF;

  RETURN NEW;
END
$fn_paie$;

DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;
CREATE TRIGGER trg_bulletins_paie
  AFTER UPDATE OF statut ON bulletins_paie
  FOR EACH ROW EXECUTE FUNCTION fn_bulletins_paie_to_journal();

-- ── 9. TRIGGER: Chèques → journal ────────────────────────────────────────────
-- Reçu INSERT  : 512000 Chèques à encaisser / 411000 Clients
-- Émis INSERT  : 401000 Fournisseurs / 521000 Banque
-- Reçu encaissé: 521000 Banque / 512000 Chèques à encaisser

CREATE OR REPLACE FUNCTION fn_cheque_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_cheque$
DECLARE
  v_year    INT;
  v_libelle TEXT;
BEGIN
  v_year    := EXTRACT(YEAR FROM NEW.date_emission)::INT;
  v_libelle := 'Cheque ' || NEW.type || ' n° ' || COALESCE(NEW.numero, '?');

  IF TG_OP = 'INSERT' THEN

    IF NEW.type = 'recu' THEN
      -- Réception d'un chèque client
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, NEW.date_emission,
         v_libelle || ' — remis par ' || COALESCE(NEW.emetteur, 'client'),
         '512000', '411000', NEW.montant, 'cheques_recu', NEW.id, v_year);

    ELSIF NEW.type = 'emis' THEN
      -- Émission d'un chèque fournisseur
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, NEW.date_emission,
         v_libelle || ' — a ' || COALESCE(NEW.beneficiaire, 'fournisseur'),
         '401000', '521000', NEW.montant, 'cheques_emis', NEW.id, v_year);

      INSERT INTO transactions
        (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
      VALUES
        (NEW.tenant_id, 'sortie', 'Cheque', v_libelle, NEW.montant, NEW.date_emission,
         'cheque', 'cheques', NEW.id, '401000', '521000', v_year);
    END IF;

  ELSIF TG_OP = 'UPDATE'
    AND NEW.type = 'recu'
    AND (OLD.statut IS DISTINCT FROM 'encaisse')
    AND NEW.statut = 'encaisse'
  THEN
    -- Encaissement : chèque remis en banque
    v_year := EXTRACT(YEAR FROM COALESCE(NEW.date_encaissement, CURRENT_DATE))::INT;

    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, COALESCE(NEW.date_encaissement, CURRENT_DATE),
       v_libelle || ' — encaisse', '521000', '512000', NEW.montant,
       'cheques_encaissement', NEW.id, v_year);

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Cheque', v_libelle, NEW.montant,
       COALESCE(NEW.date_encaissement, CURRENT_DATE),
       'cheque', 'cheques', NEW.id, '521000', '512000', v_year);
  END IF;

  RETURN NEW;
END
$fn_cheque$;

DROP TRIGGER IF EXISTS trg_cheque_insert ON cheques;
CREATE TRIGGER trg_cheque_insert
  AFTER INSERT ON cheques
  FOR EACH ROW EXECUTE FUNCTION fn_cheque_to_journal();

DROP TRIGGER IF EXISTS trg_cheque_update ON cheques;
CREATE TRIGGER trg_cheque_update
  AFTER UPDATE OF statut ON cheques
  FOR EACH ROW EXECUTE FUNCTION fn_cheque_to_journal();

-- ── 10. TRIGGER: Virement exécuté → journal ──────────────────────────────────

CREATE OR REPLACE FUNCTION fn_virement_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_vir$
DECLARE
  v_year    INT;
  v_libelle TEXT;
  v_debit   TEXT;
  v_credit  TEXT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'execute') AND NEW.statut = 'execute' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'virements' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM NEW.date)::INT;
    v_libelle := 'Virement ' || COALESCE(NEW.motif, COALESCE(NEW.reference, 'virement'));

    IF COALESCE(NEW.direction, 'externe') = 'interne' THEN
      v_debit  := COALESCE(NEW.compte_ohada_debit,  '521000');
      v_credit := COALESCE(NEW.compte_ohada_credit, '521000');
    ELSE
      v_debit  := COALESCE(NEW.compte_ohada_debit,  '401000');
      v_credit := COALESCE(NEW.compte_ohada_credit, '521000');
    END IF;

    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, NEW.date, v_libelle, v_debit, v_credit, NEW.montant, 'virements', NEW.id, v_year);

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id,
       CASE WHEN v_debit = '401000' THEN 'sortie' ELSE 'entree' END,
       'Virement', v_libelle, NEW.montant, NEW.date,
       'virement', 'virements', NEW.id, v_debit, v_credit, v_year);
  END IF;
  RETURN NEW;
END
$fn_vir$;

DROP TRIGGER IF EXISTS trg_virement_execute ON virements;
CREATE TRIGGER trg_virement_execute
  AFTER UPDATE OF statut ON virements
  FOR EACH ROW EXECUTE FUNCTION fn_virement_to_journal();

-- ── 11. TRIGGER: Opération caisse → journal 571 ──────────────────────────────
-- depense        → Débit compte_charge / Crédit 571000
-- approvisionnement → Débit 571000 / Crédit 521000 (banque par défaut)

CREATE OR REPLACE FUNCTION fn_caisse_operation_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_caisse$
DECLARE
  v_year    INT;
  v_debit   TEXT;
  v_credit  TEXT;
  v_libelle TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE source = 'caisse_operations' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
  ) THEN RETURN NEW; END IF;

  v_year    := EXTRACT(YEAR FROM NEW.date)::INT;
  v_libelle := COALESCE(NEW.motif, 'Operation caisse');

  IF NEW.type = 'depense' THEN
    v_debit  := COALESCE(NEW.compte_charge, fn_ohada_charge_account(COALESCE(NEW.motif, 'autres')));
    v_credit := '571000';

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'sortie', 'Caisse', v_libelle, NEW.montant, NEW.date,
       'especes', 'caisse_operations', NEW.id, v_debit, '571000', v_year);

  ELSIF NEW.type = 'approvisionnement' THEN
    v_debit  := '571000';
    v_credit := COALESCE(NEW.compte_source, '521000');

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Approvisionnement caisse', v_libelle, NEW.montant, NEW.date,
       'virement', 'caisse_operations', NEW.id, '571000', v_credit, v_year);
  END IF;

  INSERT INTO journal_entries
    (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
  VALUES
    (NEW.tenant_id, NEW.date, v_libelle, v_debit, v_credit, NEW.montant, 'caisse_operations', NEW.id, v_year);

  RETURN NEW;
END
$fn_caisse$;

DROP TRIGGER IF EXISTS trg_caisse_operation ON caisse_operations;
CREATE TRIGGER trg_caisse_operation
  AFTER INSERT ON caisse_operations
  FOR EACH ROW EXECUTE FUNCTION fn_caisse_operation_to_journal();

-- ── 12. TRIGGER: Transfer inter-comptes → journal ─────────────────────────────

CREATE OR REPLACE FUNCTION fn_transfer_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_transfer$
DECLARE
  v_year    INT;
  v_libelle TEXT;
BEGIN
  IF NEW.statut = 'execute' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'transfers' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM NEW.date_transfert)::INT;
    v_libelle := COALESCE(NEW.libelle, 'Transfert ' || NEW.source_type || ' vers ' || NEW.dest_type);

    -- Débit compte destination / Crédit compte source
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, NEW.date_transfert, v_libelle,
       NEW.dest_compte, NEW.source_compte, NEW.montant, 'transfers', NEW.id, v_year);

    -- Frais de transfert (ex: frais mobile money)
    IF COALESCE(NEW.frais, 0) > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, NEW.date_transfert, v_libelle || ' — frais',
         '661000', NEW.source_compte, NEW.frais, 'transfers_frais', NEW.id, v_year);
    END IF;
  END IF;
  RETURN NEW;
END
$fn_transfer$;

DROP TRIGGER IF EXISTS trg_transfer_execute ON transfers;
CREATE TRIGGER trg_transfer_execute
  AFTER INSERT OR UPDATE OF statut ON transfers
  FOR EACH ROW EXECUTE FUNCTION fn_transfer_to_journal();

-- ── 13. TRIGGER: Opération wallet mobile → journal + solde ───────────────────

CREATE OR REPLACE FUNCTION fn_mobile_wallet_operation_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_mwo$
DECLARE
  v_compte  TEXT;
  v_year    INT;
  v_debit   TEXT;
  v_credit  TEXT;
  v_libelle TEXT;
BEGIN
  SELECT COALESCE(compte_ohada, '571100')
  INTO v_compte
  FROM mobile_money_wallets
  WHERE id = NEW.wallet_id;

  v_year    := EXTRACT(YEAR FROM NEW.date_operation)::INT;
  v_libelle := COALESCE(NEW.libelle, 'Mobile Money ' || NEW.type);

  IF NEW.type = 'entree' THEN
    v_debit  := v_compte;  -- wallet débité (reçu)
    v_credit := '411000';  -- client présumé
  ELSE
    v_debit  := '658000';  -- charge diverse
    v_credit := v_compte;
  END IF;

  INSERT INTO journal_entries
    (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
  VALUES
    (NEW.tenant_id, NEW.date_operation, v_libelle, v_debit, v_credit, NEW.montant, 'mobile_wallet', NEW.id, v_year);

  -- Frais opérateur
  IF COALESCE(NEW.frais, 0) > 0 THEN
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, NEW.date_operation, v_libelle || ' — frais',
       '661000', v_compte, NEW.frais, 'mobile_wallet_frais', NEW.id, v_year);
  END IF;

  -- Synchroniser solde du wallet
  IF NEW.type = 'entree' THEN
    UPDATE mobile_money_wallets
    SET solde_actuel        = solde_actuel + NEW.montant - COALESCE(NEW.frais, 0),
        last_operation_at   = NOW()
    WHERE id = NEW.wallet_id;
  ELSE
    UPDATE mobile_money_wallets
    SET solde_actuel        = solde_actuel - NEW.montant - COALESCE(NEW.frais, 0),
        last_operation_at   = NOW()
    WHERE id = NEW.wallet_id;
  END IF;

  -- Transaction trésorerie
  INSERT INTO transactions
    (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
  VALUES
    (NEW.tenant_id, NEW.type, 'Mobile Money', v_libelle, NEW.montant, NEW.date_operation,
     'mobile', 'mobile_wallet', NEW.id, v_debit, v_credit, v_year);

  RETURN NEW;
END
$fn_mwo$;

DROP TRIGGER IF EXISTS trg_mobile_wallet_operation ON mobile_wallet_operations;
CREATE TRIGGER trg_mobile_wallet_operation
  AFTER INSERT ON mobile_wallet_operations
  FOR EACH ROW EXECUTE FUNCTION fn_mobile_wallet_operation_to_journal();

-- ── 14. TRIGGER: Déclaration TVA → 441/444/521 ───────────────────────────────
-- tva_declarations.statut : 'brouillon' → 'soumise' → 'validee' → 'payee'
-- tva_nette et total_a_reverser sont des colonnes GENERATED (ne pas les insérer)

CREATE OR REPLACE FUNCTION fn_tva_declaration_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_tva$
DECLARE
  v_year    INT;
  v_libelle TEXT;
  v_net     NUMERIC(14,2);
  v_paye    NUMERIC(14,2);
BEGIN
  IF (OLD.statut IS DISTINCT FROM NEW.statut) AND NEW.statut IN ('validee', 'payee') THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'tva_declaration' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := NEW.annee::INT;
    v_libelle := 'TVA ' || LPAD(NEW.mois::TEXT, 2, '0') || '/' || NEW.annee::TEXT;
    v_net     := COALESCE(NEW.tva_collectee, 0) - COALESCE(NEW.tva_deductible, 0);

    -- Neutralisation TVA collectée / déductible
    IF v_net > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, CURRENT_DATE, v_libelle || ' — solde TVA',
         '441000', '444000', v_net, 'tva_declaration', NEW.id, v_year);
    END IF;

    -- Paiement au Trésor public
    IF NEW.statut = 'payee' THEN
      v_paye := GREATEST(COALESCE(NEW.total_a_reverser, v_net, 0), 0);
      IF v_paye > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, COALESCE(NEW.date_paiement, CURRENT_DATE),
           v_libelle || ' — paiement DGI',
           '441000', '521000', v_paye, 'tva_paiement', NEW.id, v_year);

        INSERT INTO transactions
          (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
        VALUES
          (NEW.tenant_id, 'sortie', 'TVA', v_libelle, v_paye,
           COALESCE(NEW.date_paiement, CURRENT_DATE),
           'virement', 'tva_declarations', NEW.id, '441000', '521000', v_year);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn_tva$;

DROP TRIGGER IF EXISTS trg_tva_declaration ON tva_declarations;
CREATE TRIGGER trg_tva_declaration
  AFTER UPDATE OF statut ON tva_declarations
  FOR EACH ROW EXECUTE FUNCTION fn_tva_declaration_to_journal();

-- ── 15. FONCTION: Resync soldes trésorerie depuis journal_entries ─────────────
-- Utiliser après import ou migration pour remettre les soldes à zéro

CREATE OR REPLACE FUNCTION fn_sync_tresorerie_soldes(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
AS $fn_sync$
BEGIN
  -- Comptes bancaires (521000)
  UPDATE comptes_bancaires cb
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = '521000' THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = '521000' THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE cb.tenant_id = p_tenant_id;

  -- Caisses (571000, ou leur numéro_compte)
  UPDATE caisses ca
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = ca.numero_compte THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = ca.numero_compte THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE ca.tenant_id = p_tenant_id;

  -- Mobile money wallets (571100, 571200…)
  UPDATE mobile_money_wallets mm
  SET solde_actuel = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = mm.compte_ohada THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = mm.compte_ohada THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE mm.tenant_id = p_tenant_id;
END
$fn_sync$;

-- ── 16. VUE: Trésorerie unifiée par compte OHADA ─────────────────────────────

CREATE OR REPLACE VIEW vue_tresorerie_unifiee AS
WITH mouvements AS (
  SELECT tenant_id, debit_account  AS compte, SUM(montant) AS debits, 0::NUMERIC AS credits
  FROM journal_entries
  WHERE debit_account IN ('521000','571000','571100','571200','512000')
  GROUP BY tenant_id, debit_account
  UNION ALL
  SELECT tenant_id, credit_account AS compte, 0::NUMERIC AS debits, SUM(montant) AS credits
  FROM journal_entries
  WHERE credit_account IN ('521000','571000','571100','571200','512000')
  GROUP BY tenant_id, credit_account
)
SELECT
  m.tenant_id,
  m.compte,
  COALESCE(coa.account_name, m.compte) AS libelle,
  SUM(m.debits)                         AS total_entrees,
  SUM(m.credits)                        AS total_sorties,
  SUM(m.debits) - SUM(m.credits)        AS solde_journal
FROM mouvements m
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = m.compte
 AND (coa.tenant_id = m.tenant_id OR coa.tenant_id IS NULL)
GROUP BY m.tenant_id, m.compte, coa.account_name
ORDER BY m.tenant_id, m.compte;

-- ── 17. VUE: Analytique financière mensuelle ──────────────────────────────────

CREATE OR REPLACE VIEW vue_analytics_financial AS
SELECT
  tenant_id,
  EXTRACT(YEAR  FROM date_operation)::INT AS annee,
  EXTRACT(MONTH FROM date_operation)::INT AS mois,
  source,
  COUNT(*)     AS nb_ecritures,
  SUM(montant) AS volume_total,
  AVG(montant) AS montant_moyen
FROM journal_entries
GROUP BY tenant_id, annee, mois, source
ORDER BY tenant_id, annee DESC, mois DESC, volume_total DESC;

-- ── 18. Index de performance ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_je_source_tenant
  ON journal_entries(source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_je_tenant_fiscal
  ON journal_entries(tenant_id, fiscal_year, date_operation DESC);

CREATE INDEX IF NOT EXISTS idx_je_comptes
  ON journal_entries(tenant_id, debit_account, credit_account);

CREATE INDEX IF NOT EXISTS idx_tx_source_id
  ON transactions(source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cheques_tenant_statut
  ON cheques(tenant_id, statut);

CREATE INDEX IF NOT EXISTS idx_virements_tenant_statut
  ON virements(tenant_id, statut);

CREATE INDEX IF NOT EXISTS idx_transfers_full
  ON transfers(tenant_id, statut, date_transfert DESC);

CREATE INDEX IF NOT EXISTS idx_mwo_tenant_date
  ON mobile_wallet_operations(tenant_id, date_operation DESC);

-- ── FIN MIGRATION 046 ─────────────────────────────────────────────────────────
-- Tables créées   : transfers, mobile_wallet_operations
-- Colonnes ajoutées:
--   factures.tva_montant
--   achats.date_paiement (idempotent)
--   bulletins_paie.mode_paiement
--   virements.direction, compte_ohada_debit, compte_ohada_credit
--   cheques.tiers_id
--   mobile_money_wallets.last_operation_at
-- Triggers créés/corrigés (11 total):
--   trg_facture_issued         → fn_facture_issued_to_journal   411/706/441
--   trg_facture_paid           → fn_facture_paid_to_journal     521/411 apurement
--   trg_achat_enregistrement   → fn_achat_enregistrement        310/401 (CORRIGÉ)
--   trg_stock_in_to_journal    → fn_stock_in_to_journal         310/401 nouveau
--   trg_bulletins_paie         → fn_bulletins_paie_to_journal   641/421/644/431/521
--   trg_cheque_insert/update   → fn_cheque_to_journal           512/411→521
--   trg_virement_execute       → fn_virement_to_journal         401/521 ou interne
--   trg_caisse_operation       → fn_caisse_operation_to_journal 571 auto
--   trg_transfer_execute       → fn_transfer_to_journal         inter-comptes
--   trg_mobile_wallet_operation→ fn_mobile_wallet_operation...  wallet + journal
--   trg_tva_declaration        → fn_tva_declaration_to_journal  441/444/521
