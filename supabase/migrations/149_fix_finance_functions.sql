-- ============================================================
-- Migration 149 — Fix Finance Functions
-- Correctifs des fonctions financières centrales (migration 054)
--
-- BUG-F01 : CA calculé depuis transactions.type='entree' (vide)
--           → Lire depuis factures.total WHERE statut='payee'
-- BUG-F02 : mobile_money_wallets.solde inexistant → solde_actuel
-- BUG-F03 : mobile_money_wallets.nom inexistant → nom_titulaire
-- BUG-F04 : Paramètre p_year → p_annee (correspondance frontend)
-- ============================================================

-- ── 1. Fix v_treso_summary ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_treso_summary AS
  SELECT tenant_id, 'banque' AS type_compte, nom,
         COALESCE(solde, 0) AS solde
  FROM comptes_bancaires WHERE actif = true
  UNION ALL
  SELECT tenant_id, 'caisse' AS type_compte, nom,
         COALESCE(solde, 0) AS solde
  FROM caisses WHERE actif = true
  UNION ALL
  SELECT tenant_id, 'mobile' AS type_compte,
         COALESCE(nom_titulaire, 'Mobile Money') AS nom,
         COALESCE(solde_actuel, 0) AS solde
  FROM mobile_money_wallets WHERE actif = true;

-- ── 2. Fix fn_finance_kpis ───────────────────────────────────────────────────
-- BUG-F01 : CA depuis factures payées (pas transactions)
-- BUG-F02 : solde_actuel pour mobile money
-- BUG-F04 : p_year → p_annee

CREATE OR REPLACE FUNCTION fn_finance_kpis(
  p_tenant_id  UUID,
  p_annee      INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        INT  := COALESCE(p_annee, EXTRACT(YEAR  FROM CURRENT_DATE)::INT);
  v_month       INT  :=                   EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  v_start_year  DATE := make_date(v_year, 1, 1);
  v_end_year    DATE := make_date(v_year, 12, 31);
  v_start_month DATE := make_date(v_year, v_month, 1);
  v_end_month   DATE := (make_date(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_start_prev  DATE;
  v_end_prev    DATE;

  v_ca_annee     NUMERIC := 0;
  v_dep_annee    NUMERIC := 0;
  v_ca_mois      NUMERIC := 0;
  v_dep_mois     NUMERIC := 0;
  v_ca_prev      NUMERIC := 0;
  v_dep_prev     NUMERIC := 0;
  v_solde_banque NUMERIC := 0;
  v_solde_caisse NUMERIC := 0;
  v_solde_mobile NUMERIC := 0;
  v_creances     NUMERIC := 0;
  v_dettes       NUMERIC := 0;
  v_tva_col      NUMERIC := 0;
  v_tva_ded      NUMERIC := 0;
  v_salaires     NUMERIC := 0;
  v_prev_ent     NUMERIC := 0;
  v_prev_sor     NUMERIC := 0;
  v_nb_factures  INT     := 0;
  v_nb_retard    INT     := 0;
  v_ca_ecole     NUMERIC := 0;
  v_ca_fact      NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied: tenant not found for current user';
  END IF;

  IF v_month > 1 THEN
    v_start_prev := make_date(v_year, v_month - 1, 1);
    v_end_prev   := (make_date(v_year, v_month, 1) - INTERVAL '1 day')::DATE;
  ELSE
    v_start_prev := make_date(v_year - 1, 12, 1);
    v_end_prev   := make_date(v_year - 1, 12, 31);
  END IF;

  -- ── CA depuis factures payées (BUG-F01) ──────────────────────────────────
  SELECT COALESCE(SUM(total), 0) INTO v_ca_annee
  FROM factures
  WHERE tenant_id = p_tenant_id AND statut = 'payee'
    AND date BETWEEN v_start_year AND v_end_year;

  SELECT COALESCE(SUM(total), 0) INTO v_ca_mois
  FROM factures
  WHERE tenant_id = p_tenant_id AND statut = 'payee'
    AND date BETWEEN v_start_month AND v_end_month;

  SELECT COALESCE(SUM(total), 0) INTO v_ca_prev
  FROM factures
  WHERE tenant_id = p_tenant_id AND statut = 'payee'
    AND date BETWEEN v_start_prev AND v_end_prev;

  -- ── Dépenses depuis transactions sorties ─────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN date_operation BETWEEN v_start_year  AND v_end_year  THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN date_operation BETWEEN v_start_month AND v_end_month THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN date_operation BETWEEN v_start_prev  AND v_end_prev  THEN montant ELSE 0 END), 0)
  INTO v_dep_annee, v_dep_mois, v_dep_prev
  FROM transactions
  WHERE tenant_id = p_tenant_id AND type = 'sortie';

  -- ── Trésorerie temps réel (BUG-F02 : solde_actuel) ───────────────────────
  SELECT COALESCE(SUM(solde), 0)        INTO v_solde_banque FROM comptes_bancaires    WHERE tenant_id = p_tenant_id AND actif = true;
  SELECT COALESCE(SUM(solde), 0)        INTO v_solde_caisse FROM caisses              WHERE tenant_id = p_tenant_id AND actif = true;
  SELECT COALESCE(SUM(solde_actuel), 0) INTO v_solde_mobile FROM mobile_money_wallets WHERE tenant_id = p_tenant_id AND actif = true;

  -- ── Créances clients ────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE)::INT
  INTO v_creances, v_nb_factures, v_nb_retard
  FROM factures
  WHERE tenant_id = p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');

  -- ── Dettes fournisseurs ──────────────────────────────────────────────────
  SELECT COALESCE(SUM(montant_total), 0) INTO v_dettes
  FROM achats WHERE tenant_id = p_tenant_id AND statut NOT IN ('annule','paye','rejete');

  -- ── TVA depuis déclarations ou estimation ────────────────────────────────
  SELECT COALESCE(SUM(tva_collectee), 0), COALESCE(SUM(tva_deductible), 0)
  INTO v_tva_col, v_tva_ded
  FROM tva_declarations
  WHERE tenant_id = p_tenant_id
    AND periode >= TO_CHAR(v_start_year, 'YYYY-MM')
    AND periode <= TO_CHAR(v_end_year,   'YYYY-MM');

  IF v_tva_col = 0 AND v_ca_annee > 0 THEN
    v_tva_col := ROUND(v_ca_annee  * 0.18, 0);
    v_tva_ded := ROUND(v_dep_annee * 0.18, 0);
  END IF;

  -- ── Charges salariales ───────────────────────────────────────────────────
  SELECT COALESCE(SUM(montant), 0) INTO v_salaires
  FROM transactions
  WHERE tenant_id = p_tenant_id AND type = 'sortie'
    AND date_operation BETWEEN v_start_year AND v_end_year
    AND (source IN ('bulletin_paie','paie','salaire')
         OR categorie ILIKE '%salaire%' OR categorie ILIKE '%paie%'
         OR categorie ILIKE 'CNSS%'     OR categorie ILIKE '%rémunération%');

  -- ── Prévisions 90 jours ──────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN type='entree' THEN ROUND(montant*probabilite/100.0,0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type='sortie' THEN ROUND(montant*probabilite/100.0,0) ELSE 0 END), 0)
  INTO v_prev_ent, v_prev_sor
  FROM previsions_tresorerie
  WHERE tenant_id = p_tenant_id
    AND statut IN ('planifie','planifié','partiel')
    AND date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';

  -- ── Ventilation CA par source école vs facturation ────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN source IN ('paiement_scolaire','scolarite','ecole') THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN source IN ('facture','facture_vente')               THEN montant ELSE 0 END), 0)
  INTO v_ca_ecole, v_ca_fact
  FROM transactions
  WHERE tenant_id = p_tenant_id AND type = 'entree'
    AND date_operation BETWEEN v_start_year AND v_end_year;

  -- Si aucune transaction entree facture, le CA vient des factures payées
  IF v_ca_fact = 0 THEN v_ca_fact := v_ca_annee; END IF;

  RETURN json_build_object(
    'ca_annee',             v_ca_annee,
    'dep_annee',            v_dep_annee,
    'resultat_net',         v_ca_annee - v_dep_annee,
    'marge_nette_pct',      CASE WHEN v_ca_annee > 0 THEN ROUND((v_ca_annee - v_dep_annee) / v_ca_annee * 100, 1) ELSE 0 END,
    'ca_mois',              v_ca_mois,
    'dep_mois',             v_dep_mois,
    'cashflow_mois',        v_ca_mois - v_dep_mois,
    'ca_prev',              v_ca_prev,
    'dep_prev',             v_dep_prev,
    'cashflow_prev',        v_ca_prev - v_dep_prev,
    'solde_banque',         v_solde_banque,
    'solde_caisse',         v_solde_caisse,
    'solde_mobile',         v_solde_mobile,
    'treso_totale',         v_solde_banque + v_solde_caisse + v_solde_mobile,
    'creances_clients',     v_creances,
    'nb_factures_ouvertes', v_nb_factures,
    'nb_factures_retard',   v_nb_retard,
    'dettes_fournisseurs',  v_dettes,
    'tva_collectee',        v_tva_col,
    'tva_deductible',       v_tva_ded,
    'tva_nette',            v_tva_col - v_tva_ded,
    'ca_taxe',              ROUND((v_tva_col - v_tva_ded) * 0.05, 0),
    'salaires_annee',       v_salaires,
    'ratio_salaires_pct',   CASE WHEN v_ca_annee > 0 THEN ROUND(v_salaires / v_ca_annee * 100, 1) ELSE 0 END,
    'ca_ecole',             v_ca_ecole,
    'ca_facturation',       v_ca_fact,
    'ca_autres',            GREATEST(0, v_ca_annee - v_ca_ecole - v_ca_fact),
    'previsions_entrees',   v_prev_ent,
    'previsions_sorties',   v_prev_sor,
    'previsions_net',       v_prev_ent - v_prev_sor,
    'exercice',             v_year,
    'mois_courant',         v_month,
    'generated_at',         NOW()
  );
END;
$$;

-- ── 3. Fix fn_cashflow_monthly ───────────────────────────────────────────────
-- BUG-F04 : p_year → p_annee
-- BUG-F01 : ajouter factures payées comme entrees mensuelles

CREATE OR REPLACE FUNCTION fn_cashflow_monthly(
  p_tenant_id  UUID,
  p_annee      INT DEFAULT NULL
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
  v_year INT := COALESCE(p_annee, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH monthly_tx AS (
    SELECT
      EXTRACT(MONTH FROM date_operation)::INT AS m,
      COALESCE(SUM(CASE WHEN type='entree' THEN montant ELSE 0 END), 0) AS ent_tx,
      COALESCE(SUM(CASE WHEN type='sortie' THEN montant ELSE 0 END), 0) AS sor
    FROM transactions
    WHERE tenant_id = p_tenant_id
      AND date_operation BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
    GROUP BY 1
  ),
  monthly_fac AS (
    SELECT
      EXTRACT(MONTH FROM date)::INT AS m,
      COALESCE(SUM(total), 0) AS ent_fac
    FROM factures
    WHERE tenant_id = p_tenant_id AND statut = 'payee'
      AND date BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
    GROUP BY 1
  ),
  all_months AS (SELECT generate_series(1, 12) AS m),
  combined AS (
    SELECT
      am.m,
      COALESCE(tx.ent_tx, 0) + COALESCE(fac.ent_fac, 0) AS ent,
      COALESCE(tx.sor, 0) AS sor
    FROM all_months am
    LEFT JOIN monthly_tx  tx  USING (m)
    LEFT JOIN monthly_fac fac USING (m)
  )
  SELECT
    c.m,
    CASE c.m
      WHEN 1 THEN 'Jan' WHEN 2 THEN 'Fév' WHEN 3 THEN 'Mar'
      WHEN 4 THEN 'Avr' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Jun'
      WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aoû' WHEN 9 THEN 'Sep'
      WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Déc'
    END,
    c.ent,
    c.sor,
    c.ent - c.sor,
    SUM(c.ent - c.sor) OVER (ORDER BY c.m ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  FROM combined c
  ORDER BY c.m;
END;
$$;

-- ── 4. Fix fn_source_breakdown ───────────────────────────────────────────────
-- BUG-F04 : p_year → p_annee

CREATE OR REPLACE FUNCTION fn_source_breakdown(
  p_tenant_id  UUID,
  p_annee      INT DEFAULT NULL
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
  v_year INT := COALESCE(p_annee, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH all_flows AS (
    -- Transactions existantes (paie, dépenses, etc.)
    SELECT
      CASE COALESCE(t.source, '')
        WHEN 'facture'           THEN 'Facturation'
        WHEN 'facture_vente'     THEN 'Facturation'
        WHEN 'paiement_scolaire' THEN 'École'
        WHEN 'scolarite'         THEN 'École'
        WHEN 'ecole'             THEN 'École'
        WHEN 'bulletin_paie'     THEN 'RH & Paie'
        WHEN 'paie'              THEN 'RH & Paie'
        WHEN 'salaire'           THEN 'RH & Paie'
        WHEN 'achat'             THEN 'Achats'
        WHEN 'stock'             THEN 'Stock'
        WHEN 'depense'           THEN 'Dépenses'
        WHEN 'caisse'            THEN 'Caisse'
        WHEN 'mobile_money'      THEN 'Mobile Money'
        WHEN 'virement'          THEN 'Virement'
        WHEN 'remboursement'     THEN 'Remboursement'
        WHEN 'crm'               THEN 'Commercial'
        WHEN 'hotel'             THEN 'Hôtellerie'
        WHEN 'restaurant'        THEN 'Restauration'
        ELSE COALESCE(NULLIF(t.categorie, ''), 'Manuel')
      END                  AS module_source,
      t.type::TEXT         AS type_flux,
      t.montant            AS montant
    FROM transactions t
    WHERE t.tenant_id     = p_tenant_id
      AND t.date_operation BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)

    UNION ALL

    -- CA depuis factures payées (BUG-F01 : pas de trigger facture→transaction)
    SELECT
      'Facturation' AS module_source,
      'entree'      AS type_flux,
      f.total       AS montant
    FROM factures f
    WHERE f.tenant_id = p_tenant_id AND f.statut = 'payee'
      AND f.date BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
      -- Exclure si une transaction facture existe déjà (éviter double comptage)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t2
        WHERE t2.tenant_id = p_tenant_id
          AND t2.source    IN ('facture','facture_vente')
          AND t2.type      = 'entree'
          AND t2.date_operation BETWEEN make_date(v_year, 1, 1) AND make_date(v_year, 12, 31)
        LIMIT 1
      )
  )
  SELECT
    af.module_source,
    af.type_flux,
    COALESCE(SUM(af.montant), 0)::NUMERIC AS total,
    COUNT(*)::INT                          AS nb_operations
  FROM all_flows af
  GROUP BY 1, 2
  ORDER BY 3 DESC;
END;
$$;

-- ── 5. Fix fn_financial_score ────────────────────────────────────────────────
-- BUG-F02 : solde_actuel pour mobile_money_wallets

CREATE OR REPLACE FUNCTION fn_financial_score(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score          INT := 100;
  v_cashflow       NUMERIC := 0;
  v_treso          NUMERIC := 0;
  v_ca             NUMERIC := 0;
  v_dep            NUMERIC := 0;
  v_creances       NUMERIC := 0;
  v_dettes         NUMERIC := 0;
  v_score_cashflow INT := 25;
  v_score_treso    INT := 25;
  v_score_creances INT := 25;
  v_score_dettes   INT := 25;
  v_ratio_creances NUMERIC := 0;
  v_ratio_dettes   NUMERIC := 0;
  v_label          TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- CA des 90 derniers jours depuis factures payées
  SELECT COALESCE(SUM(total), 0) INTO v_ca
  FROM factures
  WHERE tenant_id = p_tenant_id AND statut = 'payee'
    AND date >= CURRENT_DATE - INTERVAL '90 days';

  -- Dépenses des 90 derniers jours
  SELECT COALESCE(SUM(montant), 0) INTO v_dep
  FROM transactions
  WHERE tenant_id = p_tenant_id AND type = 'sortie'
    AND date_operation >= CURRENT_DATE - INTERVAL '90 days';

  -- Trésorerie totale (BUG-F02 : solde_actuel)
  SELECT
    COALESCE((SELECT SUM(solde)        FROM comptes_bancaires    WHERE tenant_id=p_tenant_id AND actif=true), 0)
    + COALESCE((SELECT SUM(solde)      FROM caisses              WHERE tenant_id=p_tenant_id AND actif=true), 0)
    + COALESCE((SELECT SUM(solde_actuel) FROM mobile_money_wallets WHERE tenant_id=p_tenant_id AND actif=true), 0)
  INTO v_treso;

  -- Créances et dettes
  SELECT COALESCE(SUM(total), 0)        INTO v_creances FROM factures WHERE tenant_id=p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');
  SELECT COALESCE(SUM(montant_total), 0) INTO v_dettes   FROM achats   WHERE tenant_id=p_tenant_id AND statut NOT IN ('annule','paye','rejete');

  v_cashflow := v_ca - v_dep;

  -- Score cashflow (25 pts)
  IF v_cashflow > 0 THEN v_score_cashflow := 25;
  ELSIF v_cashflow > -v_ca * 0.1  THEN v_score_cashflow := 15;
  ELSIF v_cashflow > -v_ca * 0.25 THEN v_score_cashflow := 5;
  ELSE v_score_cashflow := 0;
  END IF;

  -- Score trésorerie (25 pts)
  IF v_dep > 0 AND v_treso > v_dep    THEN v_score_treso := 25;
  ELSIF v_treso > v_dep * 0.5         THEN v_score_treso := 15;
  ELSIF v_treso > 0                   THEN v_score_treso := 5;
  ELSE v_score_treso := 0;
  END IF;

  -- Score créances (25 pts)
  IF v_ca > 0 THEN
    v_ratio_creances := v_creances / v_ca;
    IF    v_ratio_creances < 0.15 THEN v_score_creances := 25;
    ELSIF v_ratio_creances < 0.30 THEN v_score_creances := 15;
    ELSIF v_ratio_creances < 0.50 THEN v_score_creances := 5;
    ELSE v_score_creances := 0;
    END IF;
  END IF;

  -- Score dettes (25 pts)
  IF v_ca > 0 THEN
    v_ratio_dettes := v_dettes / v_ca;
    IF    v_ratio_dettes < 0.10 THEN v_score_dettes := 25;
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

-- ── FIN Migration 149 ────────────────────────────────────────────────────────
-- Fonctions mises à jour : fn_finance_kpis, fn_cashflow_monthly,
--                          fn_source_breakdown, fn_financial_score
-- Vue mise à jour : v_treso_summary
