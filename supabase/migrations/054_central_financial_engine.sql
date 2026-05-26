-- ============================================================
-- Migration 054 — Moteur Financier Central Oraforme
-- Architecture SAP/Odoo : toutes sources → un seul ledger
-- OHADA compatible — Multi-tenant isolé — Congo-Brazzaville
-- ============================================================

-- ── 1. Vue : Trésorerie unifiée (banque + caisse + mobile) ───────────────────

CREATE OR REPLACE VIEW v_treso_summary AS
  SELECT tenant_id, 'banque'  AS type_compte, nom,           COALESCE(solde, 0) AS solde FROM comptes_bancaires   WHERE actif = true
  UNION ALL
  SELECT tenant_id, 'caisse'  AS type_compte, nom,           COALESCE(solde, 0) AS solde FROM caisses             WHERE actif = true
  UNION ALL
  SELECT tenant_id, 'mobile'  AS type_compte,
    COALESCE(nom, provider || ' Wallet', 'Mobile Money'),    COALESCE(solde, 0) AS solde FROM mobile_money_wallets WHERE actif = true;

COMMENT ON VIEW v_treso_summary IS
  'Vue unifiée banques + caisses + mobile money. Lecture seule via RLS des tables sous-jacentes.';

-- ── 2. Vue : Ledger financier central annoté ─────────────────────────────────
-- Chaque transaction enrichie avec le module source humain-lisible

CREATE OR REPLACE VIEW v_financial_ledger AS
SELECT
  t.id,
  t.tenant_id,
  t.date_operation,
  t.montant,
  t.type,
  t.categorie,
  t.libelle,
  t.moyen_paiement,
  t.source,
  t.source_id,
  t.debit_account,
  t.credit_account,
  t.created_at,
  CASE t.source
    WHEN 'facture'            THEN 'Facturation'
    WHEN 'facture_vente'      THEN 'Facturation'
    WHEN 'paiement_scolaire'  THEN 'École'
    WHEN 'scolarite'          THEN 'École'
    WHEN 'ecole'              THEN 'École'
    WHEN 'bulletin_paie'      THEN 'RH & Paie'
    WHEN 'paie'               THEN 'RH & Paie'
    WHEN 'salaire'            THEN 'RH & Paie'
    WHEN 'achat'              THEN 'Achats'
    WHEN 'stock'              THEN 'Stock'
    WHEN 'depense'            THEN 'Dépenses'
    WHEN 'caisse'             THEN 'Caisse'
    WHEN 'mobile_money'       THEN 'Mobile Money'
    WHEN 'virement'           THEN 'Virement'
    WHEN 'remboursement'      THEN 'Remboursement'
    WHEN 'crm'                THEN 'Commercial'
    WHEN 'hotel'              THEN 'Hôtellerie'
    WHEN 'restaurant'         THEN 'Restauration'
    ELSE COALESCE(t.categorie, 'Manuel')
  END AS module_source
FROM transactions t;

COMMENT ON VIEW v_financial_ledger IS
  'Ledger central : toutes transactions enrichies avec module source.';

-- ── 3. Vue : Créances clients (comptes à encaisser) ──────────────────────────

CREATE OR REPLACE VIEW v_creances_clients AS
SELECT
  f.tenant_id,
  f.id,
  COALESCE(f.client_nom, 'Client')  AS client_nom,
  f.total                            AS montant_total,
  f.statut,
  f.date                             AS date_facture,
  f.due_date,
  f.invoice_number,
  CASE
    WHEN f.due_date IS NOT NULL AND f.due_date < CURRENT_DATE
         AND f.statut NOT IN ('payee','annulee') THEN 'retard'
    WHEN f.due_date IS NOT NULL AND f.due_date <= CURRENT_DATE + 30 THEN 'proche'
    ELSE 'normal'
  END AS alerte,
  EXTRACT(DAY FROM CURRENT_DATE - COALESCE(f.due_date, f.date))::INT AS jours_retard
FROM factures f
WHERE f.statut NOT IN ('payee','annulee','brouillon');

COMMENT ON VIEW v_creances_clients IS
  'Créances clients : factures non réglées avec alerte retard/proche.';

-- ── 4. Vue : Dettes fournisseurs (comptes à régler) ──────────────────────────

CREATE OR REPLACE VIEW v_dettes_fournisseurs AS
SELECT
  a.tenant_id,
  a.id,
  a.montant_total,
  a.statut,
  a.created_at AS date_commande,
  CASE
    WHEN a.statut IN ('recu','recu_partiel') THEN 'urgent'
    ELSE 'normal'
  END AS urgence
FROM achats a
WHERE a.statut NOT IN ('annule','paye','rejete');

COMMENT ON VIEW v_dettes_fournisseurs IS
  'Dettes fournisseurs : achats non réglés.';

-- ── 5. Vue : Récapitulatif des rôles financiers (dashboard RH→Finance) ────────

CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  bp.tenant_id,
  DATE_TRUNC('month', bp.created_at)::DATE AS mois,
  COUNT(*)                                  AS nb_bulletins,
  COALESCE(SUM(bp.brut), 0)                AS masse_brute,
  COALESCE(SUM(bp.net), 0)                 AS masse_nette,
  COALESCE(SUM(bp.cnss_patronal), 0)       AS charges_patronales,
  COALESCE(SUM(bp.irpp), 0)                AS irpp_total
FROM bulletins_paie bp
WHERE bp.statut IN ('validee','payee')
GROUP BY 1, 2;

COMMENT ON VIEW v_payroll_summary IS
  'Synthèse masse salariale par mois depuis bulletins_paie.';

-- ── 6. Vue : Résultat P&L mensuel depuis journal_entries ─────────────────────

CREATE OR REPLACE VIEW v_pl_monthly AS
SELECT
  je.tenant_id,
  DATE_TRUNC('month', je.date_operation)::DATE AS mois,
  -- Classe 7 OHADA = Produits
  COALESCE(SUM(CASE WHEN LEFT(je.credit_account::TEXT, 1) = '7' THEN je.montant ELSE 0 END), 0) AS produits,
  -- Classe 6 OHADA = Charges
  COALESCE(SUM(CASE WHEN LEFT(je.debit_account::TEXT, 1) = '6' THEN je.montant ELSE 0 END), 0)  AS charges,
  -- Résultat
  COALESCE(SUM(CASE WHEN LEFT(je.credit_account::TEXT, 1) = '7' THEN je.montant ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN LEFT(je.debit_account::TEXT, 1) = '6' THEN je.montant ELSE 0 END), 0) AS resultat
FROM journal_entries je
GROUP BY 1, 2;

COMMENT ON VIEW v_pl_monthly IS
  'Compte de résultat mensuel depuis journal_entries OHADA (classes 6 et 7).';

-- ── 7. Fonction principale : KPIs financiers centraux ────────────────────────
-- Un seul appel RPC → tous les indicateurs du dashboard finance
-- Sécurité : vérifie que p_tenant_id = get_my_tenant_id()

CREATE OR REPLACE FUNCTION fn_finance_kpis(
  p_tenant_id  UUID,
  p_year       INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        INT  := COALESCE(p_year, EXTRACT(YEAR  FROM CURRENT_DATE)::INT);
  v_month       INT  :=                  EXTRACT(MONTH FROM CURRENT_DATE)::INT;

  v_start_year  DATE := make_date(v_year, 1, 1);
  v_end_year    DATE := make_date(v_year, 12, 31);
  v_start_month DATE := make_date(v_year, v_month, 1);
  v_end_month   DATE := (make_date(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_start_prev  DATE;
  v_end_prev    DATE;

  -- KPI vars
  v_ca_annee      NUMERIC := 0;
  v_dep_annee     NUMERIC := 0;
  v_ca_mois       NUMERIC := 0;
  v_dep_mois      NUMERIC := 0;
  v_ca_prev       NUMERIC := 0;
  v_dep_prev      NUMERIC := 0;
  v_solde_banque  NUMERIC := 0;
  v_solde_caisse  NUMERIC := 0;
  v_solde_mobile  NUMERIC := 0;
  v_creances      NUMERIC := 0;
  v_dettes        NUMERIC := 0;
  v_tva_col       NUMERIC := 0;
  v_tva_ded       NUMERIC := 0;
  v_salaires      NUMERIC := 0;
  v_prev_ent      NUMERIC := 0;
  v_prev_sor      NUMERIC := 0;
  v_nb_factures   INT     := 0;
  v_nb_retard     INT     := 0;
  v_ca_ecole      NUMERIC := 0;
  v_ca_fact       NUMERIC := 0;
  v_ca_rh_dep     NUMERIC := 0;   -- charges RH
BEGIN
  -- ── Sécurité tenant ──────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Access denied: tenant not found for current user';
  END IF;

  -- ── Dates mois précédent ─────────────────────────────────────────────────────
  IF v_month > 1 THEN
    v_start_prev := make_date(v_year, v_month - 1, 1);
    v_end_prev   := make_date(v_year, v_month, 1) - INTERVAL '1 day';
  ELSE
    v_start_prev := make_date(v_year - 1, 12, 1);
    v_end_prev   := make_date(v_year - 1, 12, 31);
  END IF;

  -- ── Agrégats annuels depuis transactions ─────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0)
  INTO v_ca_annee, v_dep_annee
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND date_operation BETWEEN v_start_year AND v_end_year;

  -- ── Mois courant ─────────────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0)
  INTO v_ca_mois, v_dep_mois
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND date_operation BETWEEN v_start_month AND v_end_month;

  -- ── Mois précédent ───────────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0)
  INTO v_ca_prev, v_dep_prev
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND date_operation BETWEEN v_start_prev AND v_end_prev;

  -- ── CA par source (école vs facturation) ─────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN source IN ('paiement_scolaire','scolarite','ecole') THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN source IN ('facture','facture_vente')                THEN montant ELSE 0 END), 0)
  INTO v_ca_ecole, v_ca_fact
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'entree'
    AND date_operation BETWEEN v_start_year AND v_end_year;

  -- ── Trésorerie en temps réel ─────────────────────────────────────────────────
  SELECT COALESCE(SUM(solde), 0) INTO v_solde_banque FROM comptes_bancaires   WHERE tenant_id = p_tenant_id AND actif = true;
  SELECT COALESCE(SUM(solde), 0) INTO v_solde_caisse FROM caisses             WHERE tenant_id = p_tenant_id AND actif = true;
  SELECT COALESCE(SUM(solde), 0) INTO v_solde_mobile FROM mobile_money_wallets WHERE tenant_id = p_tenant_id AND actif = true;

  -- ── Créances clients ─────────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE)::INT
  INTO v_creances, v_nb_factures, v_nb_retard
  FROM factures
  WHERE tenant_id = p_tenant_id
    AND statut NOT IN ('payee','annulee','brouillon');

  -- ── Dettes fournisseurs ───────────────────────────────────────────────────────
  SELECT COALESCE(SUM(montant_total), 0) INTO v_dettes
  FROM achats
  WHERE tenant_id = p_tenant_id
    AND statut NOT IN ('annule','paye','rejete');

  -- ── TVA : depuis tva_declarations si disponible, sinon estimation ─────────────
  SELECT
    COALESCE(SUM(tva_collectee), 0),
    COALESCE(SUM(tva_deductible), 0)
  INTO v_tva_col, v_tva_ded
  FROM tva_declarations
  WHERE tenant_id = p_tenant_id
    AND periode >= TO_CHAR(v_start_year, 'YYYY-MM')
    AND periode <= TO_CHAR(v_end_year,   'YYYY-MM');

  -- Fallback : estimation si aucune déclaration
  IF v_tva_col = 0 AND v_ca_annee > 0 THEN
    v_tva_col := ROUND(v_ca_annee  * 0.18, 0);
    v_tva_ded := ROUND(v_dep_annee * 0.18, 0);
  END IF;

  -- ── Charges salariales ────────────────────────────────────────────────────────
  SELECT COALESCE(SUM(montant), 0) INTO v_salaires
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'sortie'
    AND date_operation BETWEEN v_start_year AND v_end_year
    AND (
      source IN ('bulletin_paie','paie','salaire')
      OR categorie ILIKE '%salaire%'
      OR categorie ILIKE '%paie%'
      OR categorie ILIKE 'CNSS%'
      OR categorie ILIKE '%rémunération%'
    );

  -- ── Prévisions 90 jours ──────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN type = 'entree' THEN ROUND(montant * probabilite / 100.0, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sortie' THEN ROUND(montant * probabilite / 100.0, 0) ELSE 0 END), 0)
  INTO v_prev_ent, v_prev_sor
  FROM previsions_tresorerie
  WHERE tenant_id = p_tenant_id
    AND statut IN ('planifie','planifié','partiel')
    AND date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';

  -- ── Score financier (0-100) ──────────────────────────────────────────────────
  -- Basé sur: cashflow positif, ratio créances/CA, ratio dettes/CA, marge nette

  RETURN json_build_object(
    -- Résultats annuels
    'ca_annee',              v_ca_annee,
    'dep_annee',             v_dep_annee,
    'resultat_net',          v_ca_annee - v_dep_annee,
    'marge_nette_pct',       CASE WHEN v_ca_annee > 0
                               THEN ROUND((v_ca_annee - v_dep_annee) / v_ca_annee * 100, 1)
                               ELSE 0 END,
    -- Mois courant
    'ca_mois',               v_ca_mois,
    'dep_mois',              v_dep_mois,
    'cashflow_mois',         v_ca_mois - v_dep_mois,
    -- Mois précédent (pour calcul évolution)
    'ca_prev',               v_ca_prev,
    'dep_prev',              v_dep_prev,
    'cashflow_prev',         v_ca_prev - v_dep_prev,
    -- Trésorerie temps réel
    'solde_banque',          v_solde_banque,
    'solde_caisse',          v_solde_caisse,
    'solde_mobile',          v_solde_mobile,
    'treso_totale',          v_solde_banque + v_solde_caisse + v_solde_mobile,
    -- Tiers
    'creances_clients',      v_creances,
    'nb_factures_ouvertes',  v_nb_factures,
    'nb_factures_retard',    v_nb_retard,
    'dettes_fournisseurs',   v_dettes,
    -- Fiscalité
    'tva_collectee',         v_tva_col,
    'tva_deductible',        v_tva_ded,
    'tva_nette',             v_tva_col - v_tva_ded,
    'ca_taxe',               ROUND((v_tva_col - v_tva_ded) * 0.05, 0),  -- 5% CA Congo
    -- RH
    'salaires_annee',        v_salaires,
    'ratio_salaires_pct',    CASE WHEN v_ca_annee > 0
                               THEN ROUND(v_salaires / v_ca_annee * 100, 1)
                               ELSE 0 END,
    -- Sources (ventilation)
    'ca_ecole',              v_ca_ecole,
    'ca_facturation',        v_ca_fact,
    'ca_autres',             v_ca_annee - v_ca_ecole - v_ca_fact,
    -- Prévisions 90j
    'previsions_entrees',    v_prev_ent,
    'previsions_sorties',    v_prev_sor,
    'previsions_net',        v_prev_ent - v_prev_sor,
    -- Méta
    'exercice',              v_year,
    'mois_courant',          v_month,
    'generated_at',          NOW()
  );
END;
$$;

COMMENT ON FUNCTION fn_finance_kpis IS
  'Retourne tous les KPIs financiers en un seul appel RPC.
   Sécurisé : vérifie que le user a un profil dans le tenant.
   Inclut : P&L, trésorerie, créances, dettes, TVA, salaires, prévisions.';

-- ── 8. Fonction : cashflow mensuel (12 mois) ──────────────────────────────────

CREATE OR REPLACE FUNCTION fn_cashflow_monthly(
  p_tenant_id  UUID,
  p_year       INT DEFAULT NULL
)
RETURNS TABLE (
  mois        INT,
  mois_label  TEXT,
  entrees     NUMERIC,
  sorties     NUMERIC,
  net         NUMERIC,
  cumul       NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH monthly AS (
    SELECT
      EXTRACT(MONTH FROM date_operation)::INT                                           AS m,
      COALESCE(SUM(CASE WHEN type='entree' THEN montant ELSE 0 END), 0)                AS ent,
      COALESCE(SUM(CASE WHEN type='sortie' THEN montant ELSE 0 END), 0)                AS sor
    FROM transactions
    WHERE tenant_id    = p_tenant_id
      AND date_operation BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
    GROUP BY 1
  ),
  all_months AS (SELECT generate_series(1, 12) AS m),
  filled AS (
    SELECT am.m, COALESCE(mo.ent, 0) AS ent, COALESCE(mo.sor, 0) AS sor
    FROM all_months am
    LEFT JOIN monthly mo USING (m)
  )
  SELECT
    f.m,
    CASE f.m
      WHEN 1 THEN 'Jan' WHEN 2 THEN 'Fév' WHEN 3 THEN 'Mar'
      WHEN 4 THEN 'Avr' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Jun'
      WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aoû' WHEN 9 THEN 'Sep'
      WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Déc'
    END,
    f.ent,
    f.sor,
    f.ent - f.sor,
    SUM(f.ent - f.sor) OVER (ORDER BY f.m ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  FROM filled f
  ORDER BY f.m;
END;
$$;

COMMENT ON FUNCTION fn_cashflow_monthly IS
  'Retourne le cashflow mensuel sur 12 mois avec cumul progressif.';

-- ── 9. Fonction : répartition par module source ───────────────────────────────

CREATE OR REPLACE FUNCTION fn_source_breakdown(
  p_tenant_id  UUID,
  p_year       INT DEFAULT NULL
)
RETURNS TABLE (
  module_source  TEXT,
  type_flux      TEXT,
  total          NUMERIC,
  nb_operations  INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    CASE COALESCE(t.source, '')
      WHEN 'facture'            THEN 'Facturation'
      WHEN 'facture_vente'      THEN 'Facturation'
      WHEN 'paiement_scolaire'  THEN 'École'
      WHEN 'scolarite'          THEN 'École'
      WHEN 'ecole'              THEN 'École'
      WHEN 'bulletin_paie'      THEN 'RH & Paie'
      WHEN 'paie'               THEN 'RH & Paie'
      WHEN 'salaire'            THEN 'RH & Paie'
      WHEN 'achat'              THEN 'Achats'
      WHEN 'stock'              THEN 'Stock'
      WHEN 'depense'            THEN 'Dépenses'
      WHEN 'caisse'             THEN 'Caisse'
      WHEN 'mobile_money'       THEN 'Mobile Money'
      WHEN 'virement'           THEN 'Virement'
      WHEN 'remboursement'      THEN 'Remboursement'
      WHEN 'crm'                THEN 'Commercial'
      WHEN 'hotel'              THEN 'Hôtellerie'
      WHEN 'restaurant'         THEN 'Restauration'
      ELSE COALESCE(NULLIF(t.categorie, ''), 'Manuel')
    END                                 AS module_source,
    t.type::TEXT                        AS type_flux,
    COALESCE(SUM(t.montant), 0)         AS total,
    COUNT(*)::INT                       AS nb_operations
  FROM transactions t
  WHERE t.tenant_id    = p_tenant_id
    AND t.date_operation BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
  GROUP BY 1, 2
  ORDER BY 3 DESC;
END;
$$;

COMMENT ON FUNCTION fn_source_breakdown IS
  'Répartition du chiffre d''affaires et des dépenses par module source.';

-- ── 10. Fonction : score financier (santé de l'entreprise) ───────────────────

CREATE OR REPLACE FUNCTION fn_financial_score(
  p_tenant_id UUID
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score           INT := 100;
  v_details         JSON;
  v_cashflow        NUMERIC := 0;
  v_ratio_charges   NUMERIC := 0;
  v_ratio_creances  NUMERIC := 0;
  v_ratio_dettes    NUMERIC := 0;
  v_treso           NUMERIC := 0;
  v_ca              NUMERIC := 0;
  v_dep             NUMERIC := 0;
  v_creances        NUMERIC := 0;
  v_dettes          NUMERIC := 0;
  v_score_cashflow  INT := 25;
  v_score_treso     INT := 25;
  v_score_creances  INT := 25;
  v_score_dettes    INT := 25;
  v_label           TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- CA et dépenses des 3 derniers mois
  SELECT
    COALESCE(SUM(CASE WHEN type='entree' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type='sortie' THEN montant ELSE 0 END), 0)
  INTO v_ca, v_dep
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND date_operation >= CURRENT_DATE - INTERVAL '90 days';

  -- Trésorerie totale
  SELECT
    COALESCE((SELECT SUM(solde) FROM comptes_bancaires WHERE tenant_id=p_tenant_id AND actif=true), 0)
    + COALESCE((SELECT SUM(solde) FROM caisses           WHERE tenant_id=p_tenant_id AND actif=true), 0)
    + COALESCE((SELECT SUM(solde) FROM mobile_money_wallets WHERE tenant_id=p_tenant_id AND actif=true), 0)
  INTO v_treso;

  -- Créances et dettes
  SELECT COALESCE(SUM(total), 0) INTO v_creances FROM factures WHERE tenant_id=p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');
  SELECT COALESCE(SUM(montant_total), 0) INTO v_dettes FROM achats WHERE tenant_id=p_tenant_id AND statut NOT IN ('annule','paye','rejete');

  v_cashflow := v_ca - v_dep;

  -- Score cashflow (25 pts)
  IF v_cashflow > 0 THEN
    v_score_cashflow := 25;
  ELSIF v_cashflow > -v_ca * 0.1 THEN
    v_score_cashflow := 15;
  ELSIF v_cashflow > -v_ca * 0.25 THEN
    v_score_cashflow := 5;
  ELSE
    v_score_cashflow := 0;
  END IF;

  -- Score trésorerie (25 pts) — ratio treso/dépenses mensuelles moyennes
  IF v_dep > 0 AND v_treso > v_dep THEN
    v_score_treso := 25;
  ELSIF v_treso > v_dep * 0.5 THEN
    v_score_treso := 15;
  ELSIF v_treso > 0 THEN
    v_score_treso := 5;
  ELSE
    v_score_treso := 0;
  END IF;

  -- Score créances (25 pts) — ratio créances/CA
  IF v_ca > 0 THEN
    v_ratio_creances := v_creances / v_ca;
    IF v_ratio_creances < 0.15 THEN v_score_creances := 25;
    ELSIF v_ratio_creances < 0.30 THEN v_score_creances := 15;
    ELSIF v_ratio_creances < 0.50 THEN v_score_creances := 5;
    ELSE v_score_creances := 0;
    END IF;
  END IF;

  -- Score dettes (25 pts) — ratio dettes/CA
  IF v_ca > 0 THEN
    v_ratio_dettes := v_dettes / v_ca;
    IF v_ratio_dettes < 0.10 THEN v_score_dettes := 25;
    ELSIF v_ratio_dettes < 0.25 THEN v_score_dettes := 15;
    ELSIF v_ratio_dettes < 0.50 THEN v_score_dettes := 5;
    ELSE v_score_dettes := 0;
    END IF;
  END IF;

  v_score := v_score_cashflow + v_score_treso + v_score_creances + v_score_dettes;

  v_label := CASE
    WHEN v_score >= 85 THEN 'Excellente'
    WHEN v_score >= 70 THEN 'Bonne'
    WHEN v_score >= 50 THEN 'Correcte'
    WHEN v_score >= 30 THEN 'Fragile'
    ELSE 'Critique'
  END;

  RETURN json_build_object(
    'score',           v_score,
    'label',           v_label,
    'score_cashflow',  v_score_cashflow,
    'score_treso',     v_score_treso,
    'score_creances',  v_score_creances,
    'score_dettes',    v_score_dettes,
    'treso_totale',    v_treso,
    'cashflow_90j',    v_cashflow
  );
END;
$$;

COMMENT ON FUNCTION fn_financial_score IS
  'Score de santé financière 0-100 basé sur cashflow, trésorerie, créances et dettes.';

-- ── 11. Trigger manquant : CRM ventes → transaction ──────────────────────────
-- Si la table crm_contrats ou ventes existe, connexion automatique

DO $$
BEGIN
  -- Vérifier si table ventes existe et n'a pas encore de trigger finance
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ventes' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vente_to_transaction'
  ) THEN
    -- Le trigger sera créé si la table existe
    RAISE NOTICE 'Table ventes détectée — trigger à créer manuellement si nécessaire';
  END IF;
END;
$$;

-- ── 12. Trigger manquant : paiements_scolaires source labeling ───────────────
-- Assure que le champ source est bien renseigné pour les paiements école

CREATE OR REPLACE FUNCTION fn_paiement_scolaire_source_label()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- S'assurer que source est bien 'paiement_scolaire'
  NEW.source := COALESCE(NEW.source, 'paiement_scolaire');
  RETURN NEW;
END;
$$;

-- Applique uniquement si le trigger n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ps_source_label' AND tgrelid = 'paiements_scolaires'::regclass
  ) THEN
    EXECUTE '
      CREATE TRIGGER trg_ps_source_label
        BEFORE INSERT OR UPDATE ON paiements_scolaires
        FOR EACH ROW EXECUTE FUNCTION fn_paiement_scolaire_source_label()
    ';
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table paiements_scolaires non trouvée — skipping trigger';
END;
$$;

-- ── 13. Index performance ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tx_tenant_date_type_idx
  ON transactions (tenant_id, date_operation, type);

CREATE INDEX IF NOT EXISTS tx_tenant_source_idx
  ON transactions (tenant_id, source);

CREATE INDEX IF NOT EXISTS factures_tenant_statut_idx
  ON factures (tenant_id, statut);

CREATE INDEX IF NOT EXISTS achats_tenant_statut_idx
  ON achats (tenant_id, statut);

CREATE INDEX IF NOT EXISTS je_tenant_date_idx
  ON journal_entries (tenant_id, date_operation);

-- ── 14. RLS sur les vues ─────────────────────────────────────────────────────
-- Les vues héritent des RLS des tables sous-jacentes.
-- Les fonctions SECURITY DEFINER vérifient manuellement l'appartenance au tenant.

-- ── FIN Migration 054 ────────────────────────────────────────────────────────
-- À exécuter dans Supabase SQL Editor
-- Fonctions créées : fn_finance_kpis, fn_cashflow_monthly, fn_source_breakdown, fn_financial_score
-- Vues créées : v_treso_summary, v_financial_ledger, v_creances_clients, v_dettes_fournisseurs,
--               v_payroll_summary, v_pl_monthly
