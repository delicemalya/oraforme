-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 176 — P0-04 partie 2 : réparation des données du tenant AMD FINANCE
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-002 · ANO-C08 · docs/REPAIR-LOG.md §P0-04
-- Prérequis : migration 175 appliquée (version moteur 1.11.0).
--
-- CONTEXTE (diagnostic production du 2026-09-02)
--   Tenant b93b7c3d-815b-4336-bbb2-ac24cda0edb2 (AMD FINANCE), client réel
--   servant aussi aux tests. Le script de démonstration y a été exécuté le
--   2026-06-27 avec l'ancien moteur :
--     - 192 événements FAC-001 ont créé 192 lignes de caisse en SORTIE
--       (628 344 885 F) pour des factures seulement émises ;
--     - les 96 règlements FAC-002 ont été rejetés (23505) par ces lignes ;
--     - 192 PAI-001 et 48 ACH-001 ont été traités, basculés à la main en
--       error, puis ré-émis ; les 48 ACH-001 ont leurs écritures en double,
--       les PAI-001 d'origine n'en avaient pas (traités avant les règles 141).
--
-- RÉPARATION, dans une seule transaction, avec garde-fous sur les comptes
-- attendus et archivage de chaque ligne supprimée dans repair_archive.
--   1. Lignes de caisse fantômes FAC-001 : archivées puis supprimées.
--   2. Écritures des 240 originaux basculés : archivées puis supprimées ;
--      les événements passent en 'superseded' (statut prévu par le moteur).
--   3. Les 96 FAC-002 sont remis en pending et retraités par le moteur 1.11.0.
--   Rien d'autre n'est touché : factures, bulletins, achats, employés,
--   transactions saisies par le script (sans source_id) restent en place.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fous : on ne répare que l'état diagnostiqué
DO $$
DECLARE
  t   CONSTANT UUID := 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2';
  n   INT;
  v   TEXT;
BEGIN
  SELECT version INTO v FROM accounting_schema_versions ORDER BY applied_at DESC LIMIT 1;
  IF v <> '1.11.0' THEN
    RAISE EXCEPTION 'Migration 175 non appliquée (version moteur %)', v;
  END IF;

  SELECT count(*) INTO n FROM accounting_events
  WHERE tenant_id = t AND status = 'error' AND error_message IS NULL;
  IF n <> 240 THEN RAISE EXCEPTION 'Attendu 240 originaux sans message, trouvé %', n; END IF;

  SELECT count(*) INTO n
  FROM accounting_event_log l JOIN accounting_events e ON e.id = l.event_id
  WHERE e.tenant_id = t AND e.event_type = 'FAC-001' AND l.transaction_id IS NOT NULL;
  IF n <> 192 THEN RAISE EXCEPTION 'Attendu 192 lignes de caisse fantômes, trouvé %', n; END IF;

  SELECT count(*) INTO n FROM accounting_events
  WHERE tenant_id = t AND status = 'error' AND event_type = 'FAC-002';
  IF n <> 96 THEN RAISE EXCEPTION 'Attendu 96 FAC-002 en erreur, trouvé %', n; END IF;

  -- Chaque original basculé doit avoir une ré-émission traitée
  SELECT count(*) INTO n FROM accounting_events e
  WHERE e.tenant_id = t AND e.status = 'error' AND e.error_message IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM accounting_events r
      WHERE r.tenant_id = e.tenant_id AND r.event_type = e.event_type
        AND r.source_table = e.source_table AND r.source_id = e.source_id
        AND r.status = 'processed' AND r.id <> e.id);
  IF n <> 0 THEN RAISE EXCEPTION '% originaux sans ré-émission traitée : ne pas remplacer', n; END IF;

  -- Les triggers hérités (023, 026, 027) écrivent journal_entries / journal_comptable
  -- à chaque INSERT dans transactions : rejouer FAC-002 avec eux doublerait la caisse.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE  tgrelid = 'public.transactions'::regclass AND NOT tgisinternal
      AND  tgname IN ('trg_auto_journal_entry', 'trg_transaction_to_journal')
  ) THEN
    RAISE EXCEPTION 'Triggers hérités actifs sur transactions : neutraliser d''abord (migration 177)';
  END IF;
END $$;

-- 1. Table d'archive (réversibilité)
CREATE TABLE IF NOT EXISTS repair_archive (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  repair      TEXT        NOT NULL,
  table_name  TEXT        NOT NULL,
  row_id      UUID        NOT NULL,
  row_data    JSONB       NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE repair_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON repair_archive FROM anon, authenticated;

-- 2. Lignes de caisse fantômes créées par FAC-001
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'P0-04', 'transactions', tx.id, to_jsonb(tx)
FROM   accounting_event_log l
JOIN   accounting_events e ON e.id = l.event_id
JOIN   transactions tx     ON tx.id = l.transaction_id
WHERE  e.tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2' AND e.event_type = 'FAC-001';

DELETE FROM transactions tx
USING  accounting_event_log l
JOIN   accounting_events e ON e.id = l.event_id
WHERE  tx.id = l.transaction_id
  AND  e.tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  AND  e.event_type = 'FAC-001';

UPDATE accounting_event_log l
SET    transaction_id = NULL
FROM   accounting_events e
WHERE  e.id = l.event_id
  AND  e.tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  AND  e.event_type = 'FAC-001';

-- 3. Écritures des 240 originaux basculés à la main.
--    Diagnostic du 2026-09-02 : la paie n'est PAS en double (192 écritures par
--    séquence, les originaux PAI-001 ont été traités avant l'existence des
--    règles, donc sans écriture) ; les 48 ACH-001 le sont (25 086 000 F × 2).
--    On ne retire l'écriture d'un original que si sa ré-émission a produit la
--    sienne, intacte : jamais de suppression qui laisserait un fait sans écriture.
CREATE TEMP TABLE tmp_originaux ON COMMIT DROP AS
SELECT e.id AS event_id, l.journal_entry_ids
FROM   accounting_events e
JOIN   accounting_event_log l ON l.event_id = e.id
WHERE  e.tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  AND  e.status = 'error' AND e.error_message IS NULL
  AND  EXISTS (
         SELECT 1
         FROM   accounting_events r
         JOIN   accounting_event_log lr ON lr.event_id = r.id
         WHERE  r.tenant_id = e.tenant_id AND r.event_type = e.event_type
           AND  r.source_table = e.source_table AND r.source_id = e.source_id
           AND  r.status = 'processed' AND r.id <> e.id
           AND  lr.entries_count > 0
           AND  lr.entries_count = (SELECT count(*) FROM journal_entries je WHERE je.id = ANY (lr.journal_entry_ids))
       );

INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'P0-04', 'journal_entries', je.id, to_jsonb(je)
FROM   tmp_originaux o
JOIN   journal_entries je ON je.id = ANY (o.journal_entry_ids);

DELETE FROM journal_entries je
USING  tmp_originaux o
WHERE  je.id = ANY (o.journal_entry_ids);

UPDATE accounting_events
SET    status        = 'superseded',
       error_message = 'P0-04 : original traité puis basculé à la main le 2026-06-27, remplacé par sa ré-émission ; écritures éventuelles archivées dans repair_archive'
WHERE  tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  AND  status = 'error' AND error_message IS NULL;

-- 4. Rejeu des 96 règlements FAC-002 avec le moteur 1.11.0
SELECT fn_ae_retry_errors('b93b7c3d-815b-4336-bbb2-ac24cda0edb2', 'FAC-002', INTERVAL '10 years') AS remis_en_attente;
SELECT fn_ae_process_pending('b93b7c3d-815b-4336-bbb2-ac24cda0edb2', 'FAC-002', 200)            AS retraites;

-- 5. Soldes de trésorerie recalculés depuis journal_entries — si la fonction
--    existe. Production du 2026-09-02 : fn_sync_tresorerie_soldes(uuid) absente
--    (42883) alors que les migrations 046 et 133 la définissent. Le moteur
--    l'appelle déjà sous exception silencieuse ; ici, appel conditionnel.
DO $$
BEGIN
  IF to_regprocedure('fn_sync_tresorerie_soldes(uuid)') IS NOT NULL THEN
    PERFORM fn_sync_tresorerie_soldes('b93b7c3d-815b-4336-bbb2-ac24cda0edb2'::uuid);
  ELSE
    RAISE NOTICE 'fn_sync_tresorerie_soldes(uuid) absente : soldes non resynchronisés';
  END IF;
END $$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (une seule instruction, lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT '1_evenements' AS section, event_type || ' · ' || status AS cle, count(*)::text AS valeur
  FROM   accounting_events WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  GROUP  BY event_type, status
  UNION ALL
  SELECT '2_caisse', 'transactions ' || type || coalesce(' · ' || source, ' · saisie directe'),
         count(*)::text || ' lignes · ' || sum(montant)::text || ' F'
  FROM   transactions WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  GROUP  BY type, source
  UNION ALL
  SELECT '3_doublons', 'événements processed dont les écritures ne correspondent pas au journal d''audit',
         count(*)::text
  FROM   accounting_events e
  JOIN   accounting_event_log l ON l.event_id = e.id
  WHERE  e.tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2' AND e.status = 'processed'
    AND  l.entries_count <> (SELECT count(*) FROM journal_entries je WHERE je.id = ANY (l.journal_entry_ids))
  UNION ALL
  SELECT '4_archive', table_name, count(*)::text
  FROM   repair_archive WHERE repair = 'P0-04' GROUP BY table_name
  UNION ALL
  SELECT '5_soldes', 'banques · caisses',
         (SELECT coalesce(sum(solde), 0) FROM comptes_bancaires WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2')::text
         || ' · ' ||
         (SELECT coalesce(sum(solde), 0) FROM caisses WHERE tenant_id = 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2')::text
) d ORDER BY section, cle;

-- Attendu :
--   1_evenements  FAC-002 · processed = 96, aucune ligne « · error », PAI-001/ACH-001 · superseded = 192/48
--   2_caisse      plus aucune ligne « sortie · facturation » ; 96 lignes « entree · facturation »
--   3_doublons    0
--   4_archive     transactions = 192 ; journal_entries = 48 (les doublons ACH-001 ; la paie n'était pas en double)

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE (ne pas exécuter sauf besoin) : réinsérer depuis repair_archive
--   INSERT INTO transactions    SELECT (jsonb_populate_record(NULL::transactions,    row_data)).* FROM repair_archive WHERE repair='P0-04' AND table_name='transactions';
--   INSERT INTO journal_entries SELECT (jsonb_populate_record(NULL::journal_entries, row_data)).* FROM repair_archive WHERE repair='P0-04' AND table_name='journal_entries';
-- ═════════════════════════════════════════════════════════════════════════════
