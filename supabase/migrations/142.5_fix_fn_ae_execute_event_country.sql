-- ═════════════════════════════════════════════════════════════════════════════
-- Quick Win QW-01 — Correctif fn_ae_execute_event : ec.config → ec.pays
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ANOMALIE DÉTECTÉE : ATMC-01 Phase 3 (2026-06-26)
-- error_message = "column ec.config does not exist [42703]"
--
-- CAUSE RACINE :
--   fn_ae_execute_event() ligne 691 référence ec.config->>'country_code'
--   mais la table entreprise_config (migration 010) n'a pas de colonne "config".
--   Elle a "pays" (TEXT, ex: 'Congo-Brazzaville').
--   Tous les emit_accounting_event() échouaient silencieusement depuis mig.138.
--   Aucun journal_entries n'a été créé depuis le déploiement du moteur.
--
-- FIX :
--   Remplacer ec.config->>'country_code'
--   par CASE ec.pays WHEN 'Congo-Brazzaville' THEN 'CG' ... END
--
-- PÉRIMÈTRE : UNIQUEMENT fn_ae_execute_event() — aucun autre changement
-- RISQUE     : Faible — même logique, colonne corrigée, défaut 'CG' inchangé
-- TYPE       : Quick Win (pas de nouvelle migration métier)
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION fn_ae_execute_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event        accounting_events%ROWTYPE;
  v_rule         accounting_event_rules%ROWTYPE;
  v_montant      NUMERIC(14,2);
  v_debit        TEXT;
  v_credit       TEXT;
  v_libelle      TEXT;
  v_je_id        UUID;
  v_je_ids       UUID[]  := '{}';
  v_tx_id        UUID;
  v_total        NUMERIC(14,2) := 0;
  v_entries      INT     := 0;
  v_start        TIMESTAMPTZ   := clock_timestamp();
  v_country      TEXT;
  v_rows         INT;
  v_rules_used   JSONB   := '[]'::JSONB;
BEGIN
  -- Charger l'event
  SELECT * INTO v_event FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- [P-02] Compare-And-Swap : ne prendre le verrou QUE si encore 'pending'
  UPDATE accounting_events SET status = 'processing'
  WHERE id = p_event_id AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;

  -- QW-01 FIX : résoudre le pays depuis metadata ou entreprise_config.pays
  -- AVANT : ec.config->>'country_code' (colonne inexistante → erreur 42703)
  -- APRÈS : CASE ec.pays WHEN 'Congo-Brazzaville' THEN 'CG' ...
  v_country := COALESCE(
    v_event.metadata->>'country_code',
    (SELECT CASE ec.pays
      WHEN 'Congo-Brazzaville' THEN 'CG'
      WHEN 'Cameroun'          THEN 'CM'
      WHEN 'Gabon'             THEN 'GA'
      WHEN 'RDC'               THEN 'CD'
      WHEN 'Tchad'             THEN 'TD'
      WHEN 'RCA'               THEN 'CF'
      WHEN 'Guinée Équatoriale' THEN 'GQ'
      ELSE 'CG'
    END
    FROM entreprise_config ec WHERE ec.tenant_id = v_event.tenant_id LIMIT 1),
    'CG'
  );

  -- Parcourir les règles applicables (versionnées + multi-pays)
  FOR v_rule IN
    SELECT * FROM fn_ae_get_applicable_rules(v_event.event_type, v_event.date_event, v_country)
  LOOP
    -- [P-04] Évaluer toutes les conditions (AND)
    IF NOT fn_ae_eval_conditions(
      v_event.metadata, v_event.montant_ht, v_event.montant_tva,
      v_event.montant_ttc, v_event.montant_net, v_rule.conditions
    ) THEN CONTINUE; END IF;

    -- [P-05] Résoudre le montant (formule calculée ou champ direct)
    v_montant := fn_ae_resolve_amount_formula(
      v_event.montant_ht, v_event.montant_tva, v_event.montant_ttc, v_event.montant_net,
      v_event.metadata, v_rule.montant_field, v_rule.amount_formula, v_country
    );
    IF COALESCE(v_montant, 0) <= 0 THEN CONTINUE; END IF;

    -- [P-06] Résoudre les comptes (statique, treasury, ou metadata)
    v_debit  := v_rule.debit_account;
    v_credit := v_rule.credit_account;
    CASE v_rule.account_resolver
      WHEN 'treasury_debit'  THEN v_debit  := fn_ae_resolve_treasury(v_event.metadata);
      WHEN 'treasury_credit' THEN v_credit := fn_ae_resolve_treasury(v_event.metadata);
      WHEN 'metadata_debit'  THEN v_debit  := COALESCE(v_event.metadata->>'debit_account',  v_debit);
      WHEN 'metadata_credit' THEN v_credit := COALESCE(v_event.metadata->>'credit_account', v_credit);
      ELSE NULL;
    END CASE;
    IF v_debit  LIKE 'metadata.%' THEN v_debit  := v_event.metadata ->> substr(v_debit,  10); END IF;
    IF v_credit LIKE 'metadata.%' THEN v_credit := v_event.metadata ->> substr(v_credit, 10); END IF;
    IF v_debit IS NULL OR v_credit IS NULL THEN CONTINUE; END IF;

    -- Résoudre le libellé
    v_libelle := fn_ae_resolve_libelle(v_rule.libelle_tpl, v_event.metadata, v_event.libelle);

    -- Insérer l'écriture journal_entries
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year, piece_number
    ) VALUES (
      v_event.tenant_id, v_event.date_event, v_libelle,
      v_debit, v_credit, v_montant,
      v_rule.source_label, v_event.source_id, v_event.fiscal_year,
      v_event.metadata->>'piece_number'
    ) RETURNING id INTO v_je_id;

    v_je_ids  := array_append(v_je_ids, v_je_id);
    v_total   := v_total + v_montant;
    v_entries := v_entries + 1;
    v_rules_used := v_rules_used || to_jsonb(v_rule.id::TEXT);
  END LOOP;

  -- Créer la ligne transactions si impact trésorerie
  IF fn_ae_has_treasury_impact(v_event.event_type) AND COALESCE(v_event.montant_ttc, 0) > 0 THEN
    INSERT INTO transactions (
      tenant_id, type, categorie, description, montant, date,
      mode_paiement, source, source_id, fiscal_year
    ) VALUES (
      v_event.tenant_id,
      CASE WHEN fn_ae_is_income(v_event.event_type) THEN 'entree' ELSE 'sortie' END,
      fn_ae_category(v_event.event_type),
      v_event.libelle, v_event.montant_ttc, v_event.date_event,
      COALESCE(v_event.metadata->>'mode_paiement', 'virement'),
      v_event.source_module, v_event.source_id, v_event.fiscal_year
    ) RETURNING id INTO v_tx_id;
  END IF;

  -- Synchroniser trésorerie (non bloquant)
  BEGIN
    IF split_part(v_event.event_type, '-', 1) IN ('TRE','MOB','FAC','SAN','RES','ECO') THEN
      PERFORM fn_sync_tresorerie_soldes(v_event.tenant_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Audit log
  INSERT INTO accounting_event_log (
    event_id, tenant_id, journal_entry_ids, transaction_id,
    entries_count, total_debit, total_credit,
    is_balanced, schema_version, rules_snapshot, is_replay, duration_ms
  ) VALUES (
    p_event_id, v_event.tenant_id, v_je_ids, v_tx_id,
    v_entries, v_total, v_total,
    TRUE, '1.0.0',
    jsonb_build_object(
      'rule_ids', v_rules_used,
      'country', v_country,
      'event_version', v_event.event_version
    ),
    (v_event.replayed_from IS NOT NULL),
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INT
  );

  -- Marquer traité
  UPDATE accounting_events SET status = 'processed', processed_at = NOW() WHERE id = p_event_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE accounting_events
  SET status        = CASE WHEN retry_count >= max_retries THEN 'dead_letter' ELSE 'error' END,
      error_message = SQLERRM || ' [' || SQLSTATE || ']',
      last_error_at = NOW(),
      retry_count   = retry_count + 1
  WHERE id = p_event_id;
  RAISE WARNING '[accounting_engine] event=% : % [%]', p_event_id, SQLERRM, SQLSTATE;
END;
$$;

-- Purger les événements de test (TST-001 et RES-001 en erreur créés pendant ATMC-01)
-- Ces événements sont des tests manuels, pas des transactions réelles
DELETE FROM accounting_events WHERE event_type IN ('TST-001', 'RES-001');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Vérifier que la fonction est bien remplacée (pas d'erreur → QW-01 appliqué)
SELECT prosrc FROM pg_proc WHERE proname = 'fn_ae_execute_event';
-- Doit contenir 'CASE ec.pays' et non 'ec.config'

-- 2. Vérifier que les événements de test ont été nettoyés
SELECT COUNT(*) FROM accounting_events WHERE event_type IN ('TST-001','RES-001');
-- Résultat attendu : 0

-- 3. Re-tester avec RES-001 après le fix
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'RES-001',
  p_source_module := 'restaurant',
  p_source_table  := 'resto_commandes',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 100000,
  p_montant_tva   := 18900,
  p_montant_ttc   := 118900,
  p_libelle       := 'Test QW-01 — RES-001 post-fix',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement": "especes", "numero_recu": "QW-TEST-01"}'::jsonb
);

-- 4. Vérifier status = 'processed' (pas 'error')
SELECT id, event_type, status, processed_at, error_message
FROM accounting_events WHERE event_type = 'RES-001'
ORDER BY created_at DESC LIMIT 1;
-- Résultat attendu : status='processed', processed_at IS NOT NULL, error_message IS NULL

-- 5. Vérifier les journal_entries créées (2 lignes pour RES-001)
SELECT debit_account, credit_account, montant, libelle
FROM journal_entries
WHERE source_id = (
  SELECT source_id FROM accounting_events WHERE event_type = 'RES-001'
  ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at;
-- Résultat attendu :
-- 571 / 706   100000  Vente POS — QW-TEST-01 — HT
-- 571 / 4441  18900   TVA+CA collectés — QW-TEST-01
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- Restaurer l'ancienne version (avec le bug) uniquement si le fix cause une régression
-- Copier la définition originale depuis migration 138 et l'exécuter ici.
*/
