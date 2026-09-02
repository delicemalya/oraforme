-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 175 — P0-04 : la ligne de trésorerie découle des règles appliquées
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-002 · ANO-C08 (docs/RESTART-AUDIT-AZ.md) · docs/REPAIR-LOG.md §P0-04
--
-- DÉFAUT
--   fn_ae_execute_event décidait de créer une ligne `transactions` (journal de
--   caisse) par MODULE : fn_ae_has_treasury_impact('FAC-001') vaut TRUE parce
--   que le module FAC est dans une liste, alors que FAC-001 (facture émise,
--   411/706) ne touche aucun compte de trésorerie. Résultat, pour toute facture
--   émise avec un TTC :
--     1. une ligne transactions « entrée » du TTC est créée à l'émission,
--        avant tout encaissement ;
--     2. le règlement FAC-002 — le seul événement FAC qui touche 5xx — échoue
--        ensuite sur transactions_source_unique (tenant_id, source, source_id)
--        avec l'erreur 23505, et reste en statut error.
--   Même mécanique pour ACH-001 → ACH-002, SAN-001 → SAN-002, AGR-001 → AGR-002,
--   et PAI-001 → PAI-002 dès que montant_ttc > 0 (corrigé côté routes en P0-03).
--   Le document de conception (plan-directeur/migration-139) prévoyait bien
--   que la trésorerie soit « gérée par FAC-002 » ; l'implémentation détectait
--   le module et non l'événement.
--
--   La synchronisation des soldes (fn_sync_tresorerie_soldes) souffrait du
--   même choix : appelée pour une liste de modules, jamais pour PAI-002,
--   ACH-002, BOI, HOT, ONG, BTP, AGR — des règlements qui touchent 521/571.
--
-- CORRECTION
--   Un événement a un impact de trésorerie si, et seulement si, l'une des
--   règles réellement appliquées a résolu un compte de trésorerie
--   (account_resolver = treasury_debit ou treasury_credit). Le montant de la
--   ligne transactions est la somme des séquences de trésorerie appliquées ;
--   le sens est donné par le résolveur (debit = entrée, credit = sortie) ; un
--   solde nul ne crée rien. fn_sync_tresorerie_soldes est appelée dans le
--   même cas. Plus aucune liste de modules.
--
--   fn_ae_has_treasury_impact et fn_ae_is_income sont conservées (lecture par
--   d'autres objets possibles) mais ne sont plus consultées par le moteur.
--
-- PÉRIMÈTRE
--   CREATE OR REPLACE de fn_ae_execute_event uniquement, corps identique à la
--   version 142.5 hors bloc trésorerie. Aucune donnée modifiée. Les lignes
--   transactions fantômes déjà créées par des événements de constatation
--   relèvent d'une réparation de données séparée, précédée d'un diagnostic.
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
  -- P0-04 : impact trésorerie dérivé des règles appliquées
  v_treso_in     NUMERIC(14,2) := 0;   -- séquences treasury_debit  (5xx au débit  → entrée)
  v_treso_out    NUMERIC(14,2) := 0;   -- séquences treasury_credit (5xx au crédit → sortie)
  v_treso_touch  BOOLEAN := FALSE;
  v_treso_net    NUMERIC(14,2);
BEGIN
  -- Charger l'event
  SELECT * INTO v_event FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- [P-02] Compare-And-Swap : ne prendre le verrou QUE si encore 'pending'
  UPDATE accounting_events SET status = 'processing'
  WHERE id = p_event_id AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;

  -- QW-01 (142.5) : pays depuis metadata ou entreprise_config.pays
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

    -- P0-04 : la séquence a-t-elle mouvementé la trésorerie ?
    IF v_rule.account_resolver = 'treasury_debit' THEN
      v_treso_in    := v_treso_in + v_montant;
      v_treso_touch := TRUE;
    ELSIF v_rule.account_resolver = 'treasury_credit' THEN
      v_treso_out   := v_treso_out + v_montant;
      v_treso_touch := TRUE;
    END IF;
  END LOOP;

  -- P0-04 : ligne transactions uniquement si une règle de trésorerie a été
  -- appliquée. Montant = solde des séquences de trésorerie ; sens = signe.
  -- Un événement de constatation (FAC-001, ACH-001, SAN-001, PAI-001, AGR-001,
  -- STK-*) n'en crée jamais, quel que soit son montant_ttc.
  v_treso_net := v_treso_in - v_treso_out;
  IF v_treso_touch AND v_treso_net <> 0 THEN
    INSERT INTO transactions (
      tenant_id, type, categorie, description, montant, date,
      mode_paiement, source, source_id, fiscal_year
    ) VALUES (
      v_event.tenant_id,
      CASE WHEN v_treso_net > 0 THEN 'entree' ELSE 'sortie' END,
      fn_ae_category(v_event.event_type),
      v_event.libelle, ABS(v_treso_net), v_event.date_event,
      COALESCE(v_event.metadata->>'mode_paiement', 'virement'),
      v_event.source_module, v_event.source_id, v_event.fiscal_year
    ) RETURNING id INTO v_tx_id;
  END IF;

  -- Synchroniser les soldes dès qu'un compte de trésorerie a bougé (non bloquant)
  IF v_treso_touch THEN
    BEGIN
      PERFORM fn_sync_tresorerie_soldes(v_event.tenant_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Audit log
  INSERT INTO accounting_event_log (
    event_id, tenant_id, journal_entry_ids, transaction_id,
    entries_count, total_debit, total_credit,
    is_balanced, schema_version, rules_snapshot, is_replay, duration_ms
  ) VALUES (
    p_event_id, v_event.tenant_id, v_je_ids, v_tx_id,
    v_entries, v_total, v_total,
    TRUE, '1.11.0',
    jsonb_build_object(
      'rule_ids',      v_rules_used,
      'country',       v_country,
      'event_version', v_event.event_version,
      'treasury_in',   v_treso_in,
      'treasury_out',  v_treso_out
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

COMMENT ON FUNCTION fn_ae_execute_event IS
  'Moteur comptable central. Écritures journal_entries selon accounting_event_rules ; '
  'ligne transactions et synchronisation des soldes uniquement si une règle treasury_debit/credit a été appliquée (migration 175).';

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.11.0', 1, 11, 0,
  '175_treasury_impact_from_rules.sql',
  'P0-04 — Impact trésorerie dérivé des règles appliquées (treasury_debit/credit) au lieu du module. '
  'Les constatations (FAC-001, ACH-001, SAN-001, AGR-001, PAI-001) ne créent plus de ligne transactions ; '
  'les règlements (FAC-002, ACH-002, PAI-002, …) ne sont plus rejetés par transactions_source_unique. '
  'fn_sync_tresorerie_soldes appelée pour tout événement touchant 5xx.',
  FALSE,
  'Mission R-002 — P0-04'
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
/*
-- 1. La fonction ne consulte plus la liste de modules
SELECT position('fn_ae_has_treasury_impact' IN pg_get_functiondef('fn_ae_execute_event'::regproc)) AS reste_liste_modules;
-- attendu : 0

-- 2. Version moteur
SELECT version, migration_file FROM accounting_schema_versions ORDER BY applied_at DESC LIMIT 1;
-- attendu : 1.11.0

-- 3. Après un règlement FAC-002 réel : une ligne transactions, une seule, type entrée
SELECT e.event_type, l.transaction_id IS NOT NULL AS ligne_tresorerie, l.rules_snapshot->>'treasury_in' AS treasury_in
FROM   accounting_events e JOIN accounting_event_log l ON l.event_id = e.id
WHERE  e.created_at >= CURRENT_DATE
ORDER  BY e.created_at DESC LIMIT 20;
-- attendu : FAC-001 → false, FAC-002 → true
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
--    Réappliquer le corps de 142.5_fix_fn_ae_execute_event_country.sql puis :
--    DELETE FROM accounting_schema_versions WHERE version = '1.11.0';
-- ═════════════════════════════════════════════════════════════════════════════
