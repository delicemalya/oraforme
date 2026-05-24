-- ============================================================
-- Migration 044 — ERP Core: Interconnexions automatiques
--                            + États financiers OHADA
-- ============================================================

-- ── 1. Nouveaux comptes OHADA manquants ──────────────────────

INSERT INTO chart_of_accounts
  (account_number, account_name, account_type, is_debit_normal, tenant_id)
VALUES
  ('310000', 'Stocks de marchandises',          'actif',      true,  NULL),
  ('371000', 'Stocks de matieres premieres',    'actif',      true,  NULL),
  ('571100', 'Mobile Money Airtel',             'tresorerie', true,  NULL),
  ('571200', 'Mobile Money MTN MoMo',           'tresorerie', true,  NULL),
  ('622000', 'Eau electricite energie',         'charge',     true,  NULL),
  ('624000', 'Transport et deplacements',       'charge',     true,  NULL),
  ('626000', 'Communications telephoniques',   'charge',     true,  NULL),
  ('658000', 'Charges diverses exploitation',  'charge',     true,  NULL)
ON CONFLICT DO NOTHING;

-- ── 2. Colonne moyen_paiement sur achats ─────────────────────

ALTER TABLE achats ADD COLUMN IF NOT EXISTS moyen_paiement TEXT DEFAULT 'virement';

-- ── 3. Table mobile_money_wallets ────────────────────────────

CREATE TABLE IF NOT EXISTS mobile_money_wallets (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operateur     TEXT          NOT NULL CHECK (operateur IN ('airtel', 'mtn', 'orange', 'autre')),
  numero        TEXT          NOT NULL,
  nom_titulaire TEXT,
  solde_actuel  NUMERIC(14,2) NOT NULL DEFAULT 0,
  compte_ohada  TEXT          NOT NULL DEFAULT '571100',
  actif         BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE mobile_money_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mobile_money_wallets: all" ON mobile_money_wallets;
CREATE POLICY "mobile_money_wallets: all" ON mobile_money_wallets
  FOR ALL USING     (tenant_id = get_my_tenant_id())
  WITH CHECK        (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_mmw_tenant    ON mobile_money_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mmw_operateur ON mobile_money_wallets(tenant_id, operateur);

-- ── 4. Helper: compte OHADA charge depuis categorie depense ──

CREATE OR REPLACE FUNCTION fn_ohada_charge_account(p_categorie TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $ohada_charge$
  SELECT CASE
    WHEN p_categorie ILIKE '%loyer%'        OR p_categorie ILIKE '%location%'      THEN '651000'
    WHEN p_categorie ILIKE '%transport%'    OR p_categorie ILIKE '%carburant%'     THEN '624000'
    WHEN p_categorie ILIKE '%salaire%'      OR p_categorie ILIKE '%personnel%'     THEN '641000'
    WHEN p_categorie ILIKE '%achat%'        OR p_categorie ILIKE '%fourniture%'
      OR p_categorie ILIKE '%stock%'        OR p_categorie ILIKE '%matiere%'       THEN '601000'
    WHEN p_categorie ILIKE '%telecom%'      OR p_categorie ILIKE '%telephone%'
      OR p_categorie ILIKE '%internet%'     OR p_categorie ILIKE '%communication%' THEN '626000'
    WHEN p_categorie ILIKE '%eau%'          OR p_categorie ILIKE '%electricite%'
      OR p_categorie ILIKE '%energie%'      OR p_categorie ILIKE '%elec%'          THEN '622000'
    ELSE '658000'
  END
$ohada_charge$;

-- ── 5. Helper: compte OHADA tresorerie depuis mode_paiement ──

CREATE OR REPLACE FUNCTION fn_ohada_cash_account(p_mode TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $ohada_cash$
  SELECT CASE
    WHEN p_mode ILIKE '%espece%'  OR p_mode = 'cash'         THEN '571000'
    WHEN p_mode ILIKE '%mobile%'  OR p_mode ILIKE '%airtel%' THEN '571100'
    WHEN p_mode ILIKE '%mtn%'     OR p_mode ILIKE '%momo%'   THEN '571200'
    ELSE '521000'
  END
$ohada_cash$;

-- ── 6. Trigger: depense INSERT → transaction + journal OHADA ─

CREATE OR REPLACE FUNCTION fn_depense_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_dep$
DECLARE
  v_debit  TEXT;
  v_credit TEXT;
  v_year   INT;
BEGIN
  v_debit  := fn_ohada_charge_account(NEW.categorie);
  v_credit := fn_ohada_cash_account(NEW.mode_paiement);
  v_year   := EXTRACT(YEAR FROM NEW.date)::INT;

  INSERT INTO transactions (
    tenant_id, type, categorie, montant,
    libelle, date_operation, moyen_paiement,
    source, source_id, debit_account, credit_account, fiscal_year
  ) VALUES (
    NEW.tenant_id,
    'sortie',
    NEW.categorie,
    NEW.montant,
    COALESCE(NEW.description, 'Depense ' || NEW.categorie),
    NEW.date,
    NEW.mode_paiement,
    'depenses',
    NEW.id,
    v_debit,
    v_credit,
    v_year
  );

  INSERT INTO journal_entries (
    tenant_id, date_operation, libelle,
    debit_account, credit_account, montant,
    source, source_id, fiscal_year
  ) VALUES (
    NEW.tenant_id,
    NEW.date,
    COALESCE(NEW.description, 'Depense ' || NEW.categorie),
    v_debit,
    v_credit,
    NEW.montant,
    'depenses',
    NEW.id,
    v_year
  );

  RETURN NEW;
END
$fn_dep$;

DROP TRIGGER IF EXISTS trg_depense_to_transaction ON depenses;
CREATE TRIGGER trg_depense_to_transaction
  AFTER INSERT ON depenses
  FOR EACH ROW EXECUTE FUNCTION fn_depense_to_transaction();

-- ── 7. Trigger: achat INSERT → journal 601000 vs 401000 ──────

CREATE OR REPLACE FUNCTION fn_achat_enregistrement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_ach_reg$
BEGIN
  INSERT INTO journal_entries (
    tenant_id, date_operation, libelle,
    debit_account, credit_account, montant,
    source, source_id, fiscal_year
  ) VALUES (
    NEW.tenant_id,
    NEW.date,
    'Achat ' || NEW.description,
    '601000',
    '401000',
    NEW.montant,
    'achats_enregistrement',
    NEW.id,
    EXTRACT(YEAR FROM NEW.date)::INT
  );
  RETURN NEW;
END
$fn_ach_reg$;

DROP TRIGGER IF EXISTS trg_achat_enregistrement ON achats;
CREATE TRIGGER trg_achat_enregistrement
  AFTER INSERT ON achats
  FOR EACH ROW EXECUTE FUNCTION fn_achat_enregistrement();

-- ── 8. Trigger: achat statut paye → transaction + journal ────

CREATE OR REPLACE FUNCTION fn_achat_paye()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_ach_paye$
DECLARE
  v_credit TEXT;
  v_date   DATE;
  v_year   INT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'paye') AND NEW.statut = 'paye' THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE source = 'achats'
        AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      v_credit := fn_ohada_cash_account(COALESCE(NEW.moyen_paiement, 'virement'));
      v_date   := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_year   := EXTRACT(YEAR FROM v_date)::INT;

      INSERT INTO transactions (
        tenant_id, type, categorie, montant,
        libelle, date_operation, moyen_paiement,
        source, source_id, debit_account, credit_account, fiscal_year
      ) VALUES (
        NEW.tenant_id,
        'sortie',
        'Achats',
        NEW.montant,
        'Reglement achat ' || NEW.description,
        v_date,
        COALESCE(NEW.moyen_paiement, 'virement'),
        'achats',
        NEW.id,
        '401000',
        v_credit,
        v_year
      );

      INSERT INTO journal_entries (
        tenant_id, date_operation, libelle,
        debit_account, credit_account, montant,
        source, source_id, fiscal_year
      ) VALUES (
        NEW.tenant_id,
        v_date,
        'Reglement achat ' || NEW.description,
        '401000',
        v_credit,
        NEW.montant,
        'achats',
        NEW.id,
        v_year
      );
    END IF;
  END IF;
  RETURN NEW;
END
$fn_ach_paye$;

DROP TRIGGER IF EXISTS trg_achat_paye ON achats;
CREATE TRIGGER trg_achat_paye
  AFTER UPDATE OF statut ON achats
  FOR EACH ROW EXECUTE FUNCTION fn_achat_paye();

-- ── 9. Trigger: sortie stock → journal COGS 601000 vs 310000 ─

CREATE OR REPLACE FUNCTION fn_stock_out_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_stock_out$
DECLARE
  v_prix_achat NUMERIC(14,2);
  v_montant    NUMERIC(14,2);
  v_nom        TEXT;
BEGIN
  IF NEW.type = 'OUT' THEN
    SELECT COALESCE(prix_achat, 0), nom
    INTO v_prix_achat, v_nom
    FROM products
    WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id;

    v_montant := GREATEST(NEW.quantite * COALESCE(v_prix_achat, 0), 0);

    IF v_montant > 0 THEN
      INSERT INTO journal_entries (
        tenant_id, date_operation, libelle,
        debit_account, credit_account, montant,
        source, source_id, fiscal_year
      ) VALUES (
        NEW.tenant_id,
        NEW.created_at::date,
        COALESCE('Sortie stock ' || v_nom, COALESCE(NEW.note, 'Sortie stock')),
        '601000',
        '310000',
        v_montant,
        'stock_movements',
        NEW.id,
        EXTRACT(YEAR FROM NEW.created_at)::INT
      );
    END IF;
  END IF;
  RETURN NEW;
END
$fn_stock_out$;

DROP TRIGGER IF EXISTS trg_stock_out_to_journal ON stock_movements;
CREATE TRIGGER trg_stock_out_to_journal
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_stock_out_to_journal();

-- ── 10. Fonction: balance generale ───────────────────────────

CREATE OR REPLACE FUNCTION fn_balance_generale(
  p_tenant_id UUID,
  p_year      INT DEFAULT NULL
)
RETURNS TABLE (
  compte          TEXT,
  libelle         TEXT,
  account_type    TEXT,
  total_debit     NUMERIC,
  total_credit    NUMERIC,
  solde_debiteur  NUMERIC,
  solde_crediteur NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER
AS $fn_balance$
BEGIN
  RETURN QUERY
  WITH raw AS (
    SELECT debit_account AS c, montant AS d, 0::NUMERIC AS cr
    FROM   journal_entries
    WHERE  tenant_id = p_tenant_id
      AND  (p_year IS NULL OR EXTRACT(YEAR FROM date_operation) = p_year)
    UNION ALL
    SELECT credit_account AS c, 0::NUMERIC AS d, montant AS cr
    FROM   journal_entries
    WHERE  tenant_id = p_tenant_id
      AND  (p_year IS NULL OR EXTRACT(YEAR FROM date_operation) = p_year)
  ),
  agg AS (
    SELECT c AS compte, SUM(d) AS td, SUM(cr) AS tc
    FROM   raw
    GROUP  BY c
  )
  SELECT
    a.compte,
    COALESCE(coa.account_name, a.compte),
    COALESCE(coa.account_type, 'autre'),
    a.td,
    a.tc,
    GREATEST(a.td - a.tc, 0),
    GREATEST(a.tc - a.td, 0)
  FROM agg a
  LEFT JOIN chart_of_accounts coa
    ON  coa.account_number = a.compte
    AND (coa.tenant_id = p_tenant_id OR coa.tenant_id IS NULL)
  ORDER BY a.compte;
END
$fn_balance$;

-- ── 11. Fonction: compte de resultat ─────────────────────────

CREATE OR REPLACE FUNCTION fn_compte_resultat(
  p_tenant_id UUID,
  p_year      INT DEFAULT NULL
)
RETURNS TABLE (
  type_ligne TEXT,
  compte     TEXT,
  libelle    TEXT,
  montant    NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER
AS $fn_resultat$
BEGIN
  RETURN QUERY
  SELECT
    CASE b.account_type WHEN 'produit' THEN 'PRODUIT' ELSE 'CHARGE' END,
    b.compte,
    b.libelle,
    CASE b.account_type
      WHEN 'produit' THEN b.solde_crediteur
      ELSE                b.solde_debiteur
    END
  FROM fn_balance_generale(p_tenant_id, p_year) b
  WHERE b.account_type IN ('produit', 'charge')
  ORDER BY b.compte;
END
$fn_resultat$;

-- ── 12. Fonction: bilan OHADA actif/passif ───────────────────

CREATE OR REPLACE FUNCTION fn_bilan(
  p_tenant_id UUID,
  p_year      INT DEFAULT NULL
)
RETURNS TABLE (
  section TEXT,
  poste   TEXT,
  compte  TEXT,
  libelle TEXT,
  montant NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER
AS $fn_bilan$
BEGIN
  RETURN QUERY
  WITH bal AS (
    SELECT * FROM fn_balance_generale(p_tenant_id, p_year)
    WHERE account_type IN ('actif', 'passif', 'tresorerie')
  )
  SELECT
    CASE
      WHEN b.account_type = 'actif'                               THEN 'ACTIF'
      WHEN b.account_type = 'tresorerie' AND b.solde_debiteur > 0 THEN 'ACTIF'
      ELSE 'PASSIF'
    END,
    CASE
      WHEN b.compte LIKE '2%'                                      THEN 'Actif immobilise'
      WHEN b.compte LIKE '3%'                                      THEN 'Stocks'
      WHEN b.compte IN ('411000','409000')                         THEN 'Creances clients'
      WHEN b.account_type = 'actif'                               THEN 'Autres creances'
      WHEN b.account_type = 'tresorerie' AND b.solde_debiteur > 0 THEN 'Tresorerie actif'
      WHEN b.compte LIKE '1%'                                      THEN 'Capitaux propres'
      WHEN b.compte IN ('401000','419000')                         THEN 'Dettes fournisseurs'
      WHEN b.compte IN ('421000','431000')                         THEN 'Dettes sociales'
      WHEN b.compte = '441000'                                     THEN 'Dettes fiscales'
      WHEN b.account_type = 'tresorerie' AND b.solde_crediteur > 0 THEN 'Tresorerie passif'
      ELSE 'Autres dettes'
    END,
    b.compte,
    b.libelle,
    CASE
      WHEN b.account_type = 'tresorerie' AND b.solde_debiteur  > 0 THEN b.solde_debiteur
      WHEN b.account_type = 'tresorerie' AND b.solde_crediteur > 0 THEN b.solde_crediteur
      WHEN b.account_type = 'actif'                                 THEN b.solde_debiteur
      ELSE b.solde_crediteur
    END
  FROM bal b
  WHERE b.solde_debiteur > 0 OR b.solde_crediteur > 0
  ORDER BY 1 DESC, b.compte;
END
$fn_bilan$;

-- ── 13. Fonction: previsions tresorerie n jours ───────────────

CREATE OR REPLACE FUNCTION fn_previsions_tresorerie(
  p_tenant_id UUID,
  p_days      INT DEFAULT 30
)
RETURNS TABLE (
  date_prevision  DATE,
  entrees_prevues NUMERIC,
  sorties_prevues NUMERIC,
  solde_cumulatif NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER
AS $fn_prev$
DECLARE
  v_solde_initial NUMERIC;
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END),
    0
  )
  INTO v_solde_initial
  FROM transactions
  WHERE tenant_id = p_tenant_id;

  RETURN QUERY
  WITH series AS (
    SELECT generate_series(
      CURRENT_DATE,
      CURRENT_DATE + ((p_days - 1) * INTERVAL '1 day'),
      INTERVAL '1 day'
    )::date AS jour
  ),
  flux AS (
    SELECT
      (CURRENT_DATE + INTERVAL '7 days')::date AS jour,
      SUM(COALESCE(f.total, 0))                AS entree,
      0::NUMERIC                               AS sortie
    FROM factures f
    WHERE f.tenant_id = p_tenant_id AND f.statut = 'envoyee'
    GROUP BY 1
    UNION ALL
    SELECT
      COALESCE(a.date_paiement, (a.date + INTERVAL '30 days')::date) AS jour,
      0::NUMERIC   AS entree,
      SUM(a.montant) AS sortie
    FROM achats a
    WHERE a.tenant_id = p_tenant_id AND a.statut IN ('impaye', 'partiel')
    GROUP BY 1
  ),
  fjour AS (
    SELECT jour, SUM(entree) AS entree, SUM(sortie) AS sortie
    FROM   flux
    GROUP  BY jour
  )
  SELECT
    s.jour,
    COALESCE(f.entree, 0),
    COALESCE(f.sortie, 0),
    v_solde_initial
      + SUM(COALESCE(f.entree, 0) - COALESCE(f.sortie, 0))
          OVER (ORDER BY s.jour ROWS UNBOUNDED PRECEDING)
  FROM series s
  LEFT JOIN fjour f ON f.jour = s.jour
  ORDER BY s.jour;
END
$fn_prev$;

-- ── 14. Vue: resultat net annuel par tenant ───────────────────

CREATE OR REPLACE VIEW vue_resultat_net AS
WITH bal AS (
  SELECT
    je.tenant_id,
    EXTRACT(YEAR FROM je.date_operation)::INT AS annee,
    coa.account_type,
    SUM(je.montant) AS montant
  FROM journal_entries je
  JOIN chart_of_accounts coa
    ON  coa.account_number IN (je.debit_account, je.credit_account)
    AND (coa.tenant_id = je.tenant_id OR coa.tenant_id IS NULL)
    AND coa.account_type IN ('produit', 'charge')
  GROUP BY je.tenant_id, annee, coa.account_type
)
SELECT
  tenant_id,
  annee,
  SUM(CASE WHEN account_type = 'produit' THEN montant ELSE 0 END)          AS total_produits,
  SUM(CASE WHEN account_type = 'charge'  THEN montant ELSE 0 END)          AS total_charges,
  SUM(CASE WHEN account_type = 'produit' THEN montant ELSE -montant END)   AS resultat_net
FROM bal
GROUP BY tenant_id, annee;

-- Fin migration 044
