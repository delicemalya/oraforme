-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 154 — Corriger fn_finance_kpis : colonnes incorrectes
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CAUSE RACINE DES 0 FCFA SUR LA PAGE FINANCE :
--   La migration 152 avait 3 bugs de colonnes. L'exception WHEN undefined_table
--   ne capture pas les erreurs WHEN undefined_column → la fonction plante dès
--   la première colonne incorrecte et retourne NULL au frontend.
--
-- BUG 1 — achats.montant_total (n'existe pas → colonne réelle : montant)
--         statuts incorrects : 'annule','rejete' → réels : 'impaye','partiel'
--
-- BUG 2 — tva_declarations.periode (n'existe pas → colonnes réelles : annee, mois)
--
-- BUG 3 — previsions_tresorerie.montant (n'existe pas → colonne réelle : montant_prevu)
--         previsions_tresorerie.date_prevue (n'existe pas → colonne réelle : periode CHAR(7))
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (production)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS fn_finance_kpis(UUID, INT);

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

  -- ── CA factures payées ────────────────────────────────────────────────────
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

  BEGIN
    SELECT COALESCE(SUM(solde_actuel),0) INTO v_solde_mobile
    FROM mobile_money_wallets WHERE tenant_id=p_tenant_id AND actif=true;
  EXCEPTION
    WHEN undefined_table  THEN v_solde_mobile := 0;
    WHEN undefined_column THEN v_solde_mobile := 0;
  END;

  -- ── Créances clients ──────────────────────────────────────────────────────
  SELECT COALESCE(SUM(total),0), COUNT(*)::INT INTO v_creances, v_nb_factures
  FROM factures WHERE tenant_id=p_tenant_id AND statut NOT IN ('payee','annulee','brouillon');

  -- ── Dettes fournisseurs — BUG152-1 corrigé : montant (pas montant_total) ──
  --    statuts réels : 'impaye','partiel','paye' (pas 'annule','rejete')
  BEGIN
    SELECT COALESCE(SUM(montant), 0) INTO v_dettes
    FROM achats WHERE tenant_id=p_tenant_id
      AND statut IN ('impaye', 'partiel');
  EXCEPTION
    WHEN undefined_table  THEN v_dettes := 0;
    WHEN undefined_column THEN v_dettes := 0;
  END;

  -- ── TVA — BUG152-2 corrigé : colonnes annee+mois (pas periode) ───────────
  BEGIN
    SELECT COALESCE(SUM(tva_collectee),0), COALESCE(SUM(tva_deductible),0)
    INTO v_tva_col, v_tva_ded
    FROM tva_declarations WHERE tenant_id=p_tenant_id
      AND annee = v_year;
  EXCEPTION
    WHEN undefined_table  THEN v_tva_col := 0; v_tva_ded := 0;
    WHEN undefined_column THEN v_tva_col := 0; v_tva_ded := 0;
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

  -- ── Prévisions 90j — BUG152-3 corrigé : montant_prevu + periode ──────────
  BEGIN
    SELECT
      COALESCE(SUM(CASE WHEN type='entree' THEN ROUND(montant_prevu*probabilite/100.0,0) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN type='sortie' THEN ROUND(montant_prevu*probabilite/100.0,0) ELSE 0 END),0)
    INTO v_prev_ent, v_prev_sor
    FROM previsions_tresorerie WHERE tenant_id=p_tenant_id
      AND statut IN ('planifié','planifie','partiel')
      AND (periode || '-01')::DATE BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';
  EXCEPTION
    WHEN undefined_table  THEN v_prev_ent := 0; v_prev_sor := 0;
    WHEN undefined_column THEN v_prev_ent := 0; v_prev_sor := 0;
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
    'ca_taxe',              ROUND(v_tva_col * 0.05, 0),
    'salaires_annee',       v_salaires,
    'ratio_salaires_pct',   CASE WHEN v_ca_annee>0 THEN ROUND(v_salaires/v_ca_annee*100,1) ELSE 0 END,
    'ca_ecole',             v_ca_ecole,
    'ca_facturation',       v_ca_fact,
    'ca_autres',            GREATEST(v_ca_annee - v_ca_ecole - v_ca_fact, 0),
    'previsions_entrees',   v_prev_ent,
    'previsions_sorties',   v_prev_sor,
    'previsions_net',       v_prev_ent - v_prev_sor,
    'exercice',             v_year,
    'mois_courant',         v_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_finance_kpis(UUID, INT) TO authenticated, service_role;
