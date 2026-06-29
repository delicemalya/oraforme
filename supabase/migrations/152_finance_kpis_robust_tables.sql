-- ============================================================
-- Migration 152 — fn_finance_kpis robuste + type_tenant AMD FINANCE
--
-- PROBLÈME ROOT CAUSE :
--   fn_finance_kpis requête achats, tva_declarations,
--   previsions_tresorerie, mobile_money_wallets.
--   Si UNE de ces tables n'existe pas en prod → exception plpgsql
--   → fonction retourne NULL → frontend affiche 0 partout.
--   fn_cashflow_monthly ne requête que transactions+factures → OK.
--
-- CETTE MIGRATION :
--   1. fn_check_tenant_access (idempotente — cabinet ou direct)
--   2. fn_finance_kpis avec blocs EXCEPTION sur chaque table optionnelle
--   3. fn_financial_score idem
--   4. Correctif type_tenant AMD FINANCE (société → groupe)
-- ============================================================

-- ── 0. Helper accès tenant (idempotent) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_tenant_access(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id)
  THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM cabinet_clients cc
    INNER JOIN profiles p ON p.tenant_id = cc.cabinet_tenant_id
    WHERE p.user_id = auth.uid() AND cc.client_tenant_id = p_tenant_id AND cc.statut = 'actif'
  ) THEN RETURN; END IF;

  RAISE EXCEPTION 'Access denied: %', p_tenant_id;
END;
$$;

-- ── 1. DROP ───────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS fn_finance_kpis(UUID, INT);
DROP FUNCTION IF EXISTS fn_financial_score(UUID);

-- ── 2. fn_finance_kpis — robuste contre tables manquantes ────────────────────
CREATE OR REPLACE FUNCTION fn_finance_kpis(p_tenant_id UUID, p_annee INT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year        INT  := COALESCE(p_annee, EXTRACT(YEAR  FROM CURRENT_DATE)::INT);
  v_month       INT  :=           EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  v_start_year  DATE := make_date(v_year, 1, 1);
  v_end_year    DATE := make_date(v_year, 12, 31);
  v_start_month DATE := make_date(v_year, v_month, 1);
  v_end_month   DATE := (make_date(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_start_prev  DATE;
  v_end_prev    DATE;

  v_ca_annee         NUMERIC := 0;
  v_dep_annee        NUMERIC := 0;
  v_ca_mois          NUMERIC := 0;
  v_dep_mois         NUMERIC := 0;
  v_ca_prev          NUMERIC := 0;
  v_dep_prev         NUMERIC := 0;
  v_solde_banque     NUMERIC := 0;
  v_solde_caisse     NUMERIC := 0;
  v_solde_mobile     NUMERIC := 0;
  v_creances         NUMERIC := 0;
  v_dettes           NUMERIC := 0;
  v_tva_col          NUMERIC := 0;
  v_tva_ded          NUMERIC := 0;
  v_salaires         NUMERIC := 0;
  v_prev_ent         NUMERIC := 0;
  v_prev_sor         NUMERIC := 0;
  v_nb_factures      INT     := 0;
  v_ca_ecole         NUMERIC := 0;
  v_ca_fact          NUMERIC := 0;
  v_entrees_tx_annee NUMERIC := 0;
  v_entrees_tx_mois  NUMERIC := 0;
  v_entrees_tx_prev  NUMERIC := 0;
  v_ca_source        TEXT    := 'factures';
BEGIN
  PERFORM fn_check_tenant_access(p_tenant_id);

  IF v_month > 1 THEN
    v_start_prev := make_date(v_year, v_month - 1, 1);
    v_end_prev   := (make_date(v_year, v_month, 1) - INTERVAL '1 day')::DATE;
  ELSE
    v_start_prev := make_date(v_year - 1, 12, 1);
    v_end_prev   := make_date(v_year - 1, 12, 31);
  END IF;

  -- ── CA factures payées (created_at car migration 010 absente) ────────────
  SELECT COALESCE(SUM(total),0) INTO v_ca_annee
  FROM factures WHERE tenant_id=p_tenant_id AND statut='payee'
    AND created_at::DATE BETWEEN v_start_year AND v_end_year;

  SELECT COALESCE(SUM(total),0) INTO v_ca_mois
  FROM factures WHERE tenant_id=p_tenant_id AND statut='payee'
    AND created_at::DATE BETWEEN v_start_month AND v_end_month;

  SELECT COALESCE(SUM(total),0) INTO v_ca_prev
  FROM factures WHERE tenant_id=p_tenant_id AND statut='payee'
    AND created_at::DATE BETWEEN v_start_prev AND v_end_prev;

  -- ── Transactions entrées hors paie ────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_year  AND v_end_year  THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_month AND v_end_month THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_prev  AND v_end_prev  THEN montant ELSE 0 END),0)
  INTO v_entrees_tx_annee, v_entrees_tx_mois, v_entrees_tx_prev
  FROM transactions
  WHERE tenant_id=p_tenant_id AND type='entree'
    AND COALESCE(source,'') NOT IN ('bulletin_paie','paie','salaire')
    AND (categorie IS NULL OR (
      categorie NOT ILIKE '%salaire%' AND categorie NOT ILIKE '%paie%'
      AND categorie NOT ILIKE '%rémunération%'));

  -- Fallback CA si aucune facture payée
  IF v_ca_annee = 0 AND v_entrees_tx_annee > 0 THEN
    v_ca_annee := v_entrees_tx_annee; v_ca_mois := v_entrees_tx_mois;
    v_ca_prev  := v_entrees_tx_prev;  v_ca_source := 'transactions';
  END IF;

  -- ── Dépenses ──────────────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_year  AND v_end_year  THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_month AND v_end_month THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN date BETWEEN v_start_prev  AND v_end_prev  THEN montant ELSE 0 END),0)
  INTO v_dep_annee, v_dep_mois, v_dep_prev
  FROM transactions WHERE tenant_id=p_tenant_id AND type='sortie';

  -- ── Trésorerie ────────────────────────────────────────────────────────────
  SELECT COALESCE(SUM(solde),0) INTO v_solde_banque
  FROM comptes_bancaires WHERE tenant_id=p_tenant_id AND actif=true;

  SELECT COALESCE(SUM(solde),0) INTO v_solde_caisse
  FROM caisses WHERE tenant_id=p_tenant_id AND actif=true;

  -- mobile_money_wallets peut être absente
  BEGIN
    SELECT COALESCE(SUM(solde_actuel),0) INTO v_solde_mobile
    FROM mobile_money_wallets WHERE tenant_id=p_tenant_id AND actif=true;
  EXCEPTION WHEN undefined_table THEN v_solde_mobile := 0;
  END;

  -- ── Créances clients ──────────────────────────────────────────────────────
  SELECT COALESCE(SUM(total),0), COUNT(*)::INT INTO v_creances, v_nb_factures
  FROM factures WHERE tenant_id=p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');

  -- ── Dettes fournisseurs (achats peut être absent) ─────────────────────────
  BEGIN
    SELECT COALESCE(SUM(montant_total),0) INTO v_dettes
    FROM achats WHERE tenant_id=p_tenant_id AND statut NOT IN ('annule','paye','rejete');
  EXCEPTION WHEN undefined_table THEN v_dettes := 0;
  END;

  -- ── TVA (tva_declarations peut être absente) ──────────────────────────────
  BEGIN
    SELECT COALESCE(SUM(tva_collectee),0), COALESCE(SUM(tva_deductible),0)
    INTO v_tva_col, v_tva_ded
    FROM tva_declarations WHERE tenant_id=p_tenant_id
      AND periode >= TO_CHAR(v_start_year,'YYYY-MM')
      AND periode <= TO_CHAR(v_end_year,  'YYYY-MM');
  EXCEPTION WHEN undefined_table THEN v_tva_col := 0; v_tva_ded := 0;
  END;

  IF v_tva_col = 0 AND v_ca_annee > 0 THEN
    v_tva_col := ROUND(v_ca_annee  * 0.18, 0);
    v_tva_ded := ROUND(v_dep_annee * 0.18, 0);
  END IF;

  -- ── Charges salariales ────────────────────────────────────────────────────
  SELECT COALESCE(SUM(montant),0) INTO v_salaires
  FROM transactions WHERE tenant_id=p_tenant_id AND type='sortie'
    AND date BETWEEN v_start_year AND v_end_year
    AND (COALESCE(source,'') IN ('bulletin_paie','paie','salaire')
         OR COALESCE(categorie,'') ILIKE '%salaire%'
         OR COALESCE(categorie,'') ILIKE '%paie%'
         OR COALESCE(categorie,'') ILIKE 'CNSS%'
         OR COALESCE(categorie,'') ILIKE '%rémunération%');

  -- ── Prévisions 90j (previsions_tresorerie peut être absente) ─────────────
  BEGIN
    SELECT
      COALESCE(SUM(CASE WHEN type='entree' THEN ROUND(montant*probabilite/100.0,0) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN type='sortie' THEN ROUND(montant*probabilite/100.0,0) ELSE 0 END),0)
    INTO v_prev_ent, v_prev_sor
    FROM previsions_tresorerie WHERE tenant_id=p_tenant_id
      AND statut IN ('planifie','planifié','partiel')
      AND date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';
  EXCEPTION WHEN undefined_table THEN v_prev_ent := 0; v_prev_sor := 0;
  END;

  -- ── Ventilation CA ────────────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(source,'') IN ('paiement_scolaire','scolarite','ecole') THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN COALESCE(source,'') IN ('facture','facture_vente') THEN montant ELSE 0 END),0)
  INTO v_ca_ecole, v_ca_fact
  FROM transactions WHERE tenant_id=p_tenant_id AND type='entree'
    AND date BETWEEN v_start_year AND v_end_year;

  IF v_ca_fact = 0 THEN v_ca_fact := v_ca_annee; END IF;

  RETURN json_build_object(
    'ca_annee',             v_ca_annee,
    'dep_annee',            v_dep_annee,
    'resultat_net',         v_ca_annee - v_dep_annee,
    'marge_nette_pct',      CASE WHEN v_ca_annee>0 THEN ROUND((v_ca_annee-v_dep_annee)/v_ca_annee*100,1) ELSE 0 END,
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
    'nb_factures_retard',   0,
    'dettes_fournisseurs',  v_dettes,
    'tva_collectee',        v_tva_col,
    'tva_deductible',       v_tva_ded,
    'tva_nette',            v_tva_col - v_tva_ded,
    'ca_taxe',              ROUND((v_tva_col - v_tva_ded)*0.05, 0),
    'salaires_annee',       v_salaires,
    'ratio_salaires_pct',   CASE WHEN v_ca_annee>0 THEN ROUND(v_salaires/v_ca_annee*100,1) ELSE 0 END,
    'ca_ecole',             v_ca_ecole,
    'ca_facturation',       v_ca_fact,
    'ca_autres',            GREATEST(0, v_ca_annee - v_ca_ecole - v_ca_fact),
    'previsions_entrees',   v_prev_ent,
    'previsions_sorties',   v_prev_sor,
    'previsions_net',       v_prev_ent - v_prev_sor,
    'flux_entrants_tx',     v_entrees_tx_annee,
    'ca_source',            v_ca_source,
    'exercice',             v_year,
    'mois_courant',         v_month,
    'generated_at',         NOW()
  );
END;
$$;

-- ── 3. fn_financial_score — robuste ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_financial_score(p_tenant_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_score          INT     := 100;
  v_cashflow       NUMERIC := 0;
  v_treso          NUMERIC := 0;
  v_ca             NUMERIC := 0;
  v_dep            NUMERIC := 0;
  v_creances       NUMERIC := 0;
  v_dettes         NUMERIC := 0;
  v_score_cashflow INT     := 25;
  v_score_treso    INT     := 25;
  v_score_creances INT     := 25;
  v_score_dettes   INT     := 25;
  v_label          TEXT;
BEGIN
  PERFORM fn_check_tenant_access(p_tenant_id);

  SELECT COALESCE(SUM(total),0) INTO v_ca
  FROM factures WHERE tenant_id=p_tenant_id AND statut='payee'
    AND created_at::DATE >= CURRENT_DATE - INTERVAL '90 days';

  SELECT COALESCE(SUM(montant),0) INTO v_dep
  FROM transactions WHERE tenant_id=p_tenant_id AND type='sortie'
    AND date >= CURRENT_DATE - INTERVAL '90 days';

  SELECT
    COALESCE((SELECT SUM(solde)         FROM comptes_bancaires    WHERE tenant_id=p_tenant_id AND actif=true),0)
    + COALESCE((SELECT SUM(solde)       FROM caisses              WHERE tenant_id=p_tenant_id AND actif=true),0)
  INTO v_treso;

  -- mobile_money_wallets optionnel
  BEGIN
    v_treso := v_treso + COALESCE((SELECT SUM(solde_actuel) FROM mobile_money_wallets WHERE tenant_id=p_tenant_id AND actif=true),0);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  SELECT COALESCE(SUM(total),0) INTO v_creances
  FROM factures WHERE tenant_id=p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');

  -- achats optionnel
  BEGIN
    SELECT COALESCE(SUM(montant_total),0) INTO v_dettes
    FROM achats WHERE tenant_id=p_tenant_id AND statut NOT IN ('annule','paye','rejete');
  EXCEPTION WHEN undefined_table THEN v_dettes := 0;
  END;

  v_cashflow := v_ca - v_dep;

  IF    v_cashflow > 0            THEN v_score_cashflow := 25;
  ELSIF v_cashflow > -v_ca*0.1    THEN v_score_cashflow := 15;
  ELSIF v_cashflow > -v_ca*0.25   THEN v_score_cashflow := 5;
  ELSE  v_score_cashflow := 0; END IF;

  IF    v_dep > 0 AND v_treso > v_dep  THEN v_score_treso := 25;
  ELSIF v_treso > v_dep*0.5            THEN v_score_treso := 15;
  ELSIF v_treso > 0                    THEN v_score_treso := 5;
  ELSE  v_score_treso := 0; END IF;

  IF v_ca > 0 THEN
    IF    v_creances/v_ca < 0.15 THEN v_score_creances := 25;
    ELSIF v_creances/v_ca < 0.30 THEN v_score_creances := 15;
    ELSIF v_creances/v_ca < 0.50 THEN v_score_creances := 5;
    ELSE  v_score_creances := 0; END IF;

    IF    v_dettes/v_ca < 0.10 THEN v_score_dettes := 25;
    ELSIF v_dettes/v_ca < 0.25 THEN v_score_dettes := 15;
    ELSIF v_dettes/v_ca < 0.50 THEN v_score_dettes := 5;
    ELSE  v_score_dettes := 0; END IF;
  END IF;

  v_score := v_score_cashflow + v_score_treso + v_score_creances + v_score_dettes;
  v_label := CASE
    WHEN v_score >= 85 THEN 'Excellente'
    WHEN v_score >= 70 THEN 'Bonne'
    WHEN v_score >= 50 THEN 'Correcte'
    WHEN v_score >= 30 THEN 'Fragile'
    ELSE 'Critique' END;

  RETURN json_build_object(
    'score',v_score,'label',v_label,
    'score_cashflow',v_score_cashflow,'score_treso',v_score_treso,
    'score_creances',v_score_creances,'score_dettes',v_score_dettes,
    'treso_totale',v_treso,'cashflow_90j',v_cashflow
  );
END;
$$;

-- ── 4. Correctif type_tenant AMD FINANCE ─────────────────────────────────────
-- Passe de 'société' à 'groupe' pour correspondre à la création "compagnie"
UPDATE tenants
SET type_tenant = 'groupe'
WHERE (nom_entreprise ILIKE '%amd%' OR nom_entreprise ILIKE '%amd finance%')
  AND type_tenant = 'société';

-- ── FIN Migration 152 ────────────────────────────────────────────────────────
-- Résumé des correctifs :
--   • fn_finance_kpis : blocs EXCEPTION sur achats, tva_declarations,
--     previsions_tresorerie, mobile_money_wallets → résiste aux tables absentes
--   • fn_financial_score : idem pour achats, mobile_money_wallets
--   • type_tenant AMD FINANCE : société → groupe
