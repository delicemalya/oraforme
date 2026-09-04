-- ═════════════════════════════════════════════════════════════════════════════
-- Diagnostic — Triggers hérités sur achats (doublons journal_entries/transactions)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-002 · ticket « triggers hérités » · docs/REPAIR-LOG.md
-- Contexte : P0-04 (2026-09-02) a relevé, pour le tenant AMD FINANCE, 48 écritures
-- journal_entries source='achats_enregistrement' (25 086 000 F) qui coexistent avec
-- 48 écritures émises par le moteur pour les mêmes achats. Elles viennent du trigger
-- legacy `trg_achat_enregistrement` (migrations 044/046, sur la table `achats`),
-- que la migration 147 du dépôt supprime (`DROP TRIGGER`) mais qui a visiblement
-- survécu en production — cohérent avec le constat plus large de P0-05 : la
-- production n'a jamais été construite par rejeu strict des migrations.
--
-- La table `achats` porte potentiellement DEUX triggers legacy :
--   trg_achat_enregistrement (AFTER INSERT)        → journal_entries direct (601/401 ou 310/401)
--   trg_achat_paye           (AFTER UPDATE OF statut) → transactions + journal_entries direct (401/trésorerie)
-- Le moteur les couvre via ACH-001 (POST /api/achats) et ACH-002 (PATCH /api/achats,
-- app/api/achats/route.ts:39 et :94) depuis la migration 147.
--
-- Ce diagnostic est global (tous tenants), pas restreint à AMD FINANCE : un trigger
-- Postgres s'applique à toute la table, pas à un tenant. Une seule instruction en
-- lecture seule (règle maison : UNION ALL section/cle/valeur, pas d'ORDER BY/LIMIT
-- nu dans un membre d'UNION).
--
-- À exécuter dans l'éditeur SQL Supabase, résultat à coller pour construire le
-- correctif guardé (assertions sur les comptes exacts, dans le style de 176/p0-05).
-- ═════════════════════════════════════════════════════════════════════════════

SELECT * FROM (

  -- 1. Les triggers legacy existent-ils encore sur achats ?
  SELECT '1_triggers_presents' AS section, tgname AS cle, 'présent' AS valeur
  FROM   pg_trigger
  WHERE  tgrelid = 'public.achats'::regclass AND NOT tgisinternal
    AND  tgname IN ('trg_achat_enregistrement', 'trg_achat_paye')

  UNION ALL

  -- 2. Écritures journal_entries du trigger legacy d'enregistrement (littéral
  --    'achats_enregistrement', codé en dur dans fn_achat_enregistrement — jamais
  --    utilisé comme source_label par le moteur), tous tenants.
  SELECT '2_je_legacy_enregistrement_total', 'toutes tenants',
         count(*)::text || ' lignes · ' || coalesce(sum(montant), 0)::text || ' F'
  FROM   journal_entries WHERE source = 'achats_enregistrement'

  UNION ALL

  -- 2b. Détail par tenant
  SELECT '2b_je_legacy_par_tenant', coalesce(t.nom_entreprise, je.tenant_id::text),
         count(*)::text || ' lignes · ' || coalesce(sum(je.montant), 0)::text || ' F'
  FROM   journal_entries je
  LEFT JOIN tenants t ON t.id = je.tenant_id
  WHERE  je.source = 'achats_enregistrement'
  GROUP  BY coalesce(t.nom_entreprise, je.tenant_id::text)

  UNION ALL

  -- 3. Doublons confirmés : achats ayant à la fois l'écriture legacy ET un
  --    événement ACH-001 traité par le moteur pour le même achat.
  SELECT '3_doublons_confirmes_ach001', 'achats.id distincts',
         count(DISTINCT je.source_id)::text
  FROM   journal_entries je
  JOIN   accounting_events ae
    ON   ae.source_table = 'achats' AND ae.source_id = je.source_id
    AND  ae.event_type = 'ACH-001' AND ae.status = 'processed'
  WHERE  je.source = 'achats_enregistrement'

  UNION ALL

  -- 4. Écritures legacy SANS événement moteur correspondant : pas des doublons,
  --    seule trace comptable de cet achat — À NE JAMAIS SUPPRIMER.
  SELECT '4_legacy_sans_moteur_ne_pas_toucher', 'achats.id distincts',
         count(DISTINCT je.source_id)::text
  FROM   journal_entries je
  WHERE  je.source = 'achats_enregistrement'
    AND  NOT EXISTS (
           SELECT 1 FROM accounting_events ae
           WHERE ae.source_table = 'achats' AND ae.source_id = je.source_id
             AND ae.event_type = 'ACH-001' AND ae.status = 'processed'
         )

  UNION ALL

  -- 5. Volet paiement — transactions source='achats' (trg_achat_paye ET ACH-002
  --    utilisent le même littéral 'achats' ou 'achats' comme source_module ;
  --    seul le lien vers accounting_event_log distingue le moteur du legacy).
  SELECT '5_tx_achats_total', 'toutes tenants',
         count(*)::text || ' lignes · ' || coalesce(sum(montant), 0)::text || ' F'
  FROM   transactions WHERE source = 'achats'

  UNION ALL

  -- 6. Parmi elles, celles qu'aucun accounting_event_log ne référence : candidates
  --    legacy (trg_achat_paye), à confirmer par recoupement avec le point 7.
  SELECT '6_tx_achats_hors_log_moteur', 'transactions.id',
         count(*)::text || ' lignes · ' || coalesce(sum(tx.montant), 0)::text || ' F'
  FROM   transactions tx
  WHERE  tx.source = 'achats'
    AND  NOT EXISTS (SELECT 1 FROM accounting_event_log l WHERE l.transaction_id = tx.id)

  UNION ALL

  -- 7. Écritures journal_entries de paiement (source='achats', littéral de
  --    fn_achat_paye) qu'aucun accounting_event_log ne référence.
  SELECT '7_je_paiement_legacy_hors_log', 'journal_entries.id',
         count(*)::text || ' lignes · ' || coalesce(sum(je.montant), 0)::text || ' F'
  FROM   journal_entries je
  WHERE  je.source = 'achats'
    AND  NOT EXISTS (
           SELECT 1 FROM accounting_event_log l WHERE je.id = ANY (l.journal_entry_ids)
         )

  UNION ALL

  -- 8. Repère : total d'achats et de règlements enregistrés, pour situer l'ampleur.
  SELECT '8_volume_achats', 'achats total · payés',
         count(*)::text || ' · ' || count(*) FILTER (WHERE statut = 'paye')::text
  FROM   achats

) d ORDER BY section, cle;

-- Lecture attendue :
--   1 : présence ou absence de trg_achat_enregistrement / trg_achat_paye
--   2/2b : ampleur des doublons ACH-001 par tenant (AMD FINANCE attendu : 48 · 25 086 000 F, cf. P0-04)
--   3 : nombre exact de doublons confirmés (à supprimer, avec archivage)
--   4 : jamais touché — pas d'événement moteur associé
--   5/6/7 : même diagnostic côté règlements (trg_achat_paye vs ACH-002)
--   8 : contexte de volume
