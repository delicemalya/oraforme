-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 179 — Purge du jeu de données de démo AMD FINANCE
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-004 · forensique journal_entries 2024-2025 · docs/REPAIR-LOG.md
-- Prérequis : diagnostic exhaustif exécuté en production le 2026-09-07/08.
--
-- CONTEXTE
--   scripts/seed-demo-data.ts (lit .env.local = projet Supabase de production,
--   cible le tenant le plus ancien via getTenantId()) a été exécuté le
--   2026-06-27 contre AMD FINANCE (b93b7c3d-815b-4336-bbb2-ac24cda0edb2),
--   produisant 8 employés, 30 fournisseurs, 3 comptes bancaires (BGFI, LCB,
--   BOCEC — les mêmes que la migration 178 a corrigés), 192 factures
--   (dates métier backdatées 2024-01 → 2025-12, créées le 2026-06-27),
--   192 bulletins de paie, 48 achats, 192 mouvements de trésorerie, 96
--   mouvements de stock, et ~1344 écritures journal via le moteur comptable.
--   Un second lot de 96 écritures/événements (règlements FAC-002 rejoués)
--   provient de la réparation P0-04 légitime du 2026-09-02 (migration 176),
--   sur les mêmes factures de démo — donc de la même origine.
--
--   Diagnostic exhaustif confirmé (une seule instruction, lecture seule,
--   exécutée par l'utilisateur le 2026-09-07) :
--     - 1344/1344 journal_entries de 2024-2025 appartiennent à AMD FINANCE,
--       créées exactement le 2026-06-27 (1248) ou le 2026-09-02 (96),
--       100% liées à un accounting_events réel, 0 orpheline.
--     - comptes_bancaires : total AMD FINANCE = 3 = scope(2026-06-27).
--     - employés : total = 8 = scope(2026-06-27).
--     - fournisseurs : total = 30 = scope(2026-06-27).
--     - bulletins_paie : total = 192 = scope(2 jours).
--     - achats : total = 48 = scope(2 jours).
--     - stock_movements : total = 96 = scope(2 jours).
--     - factures : total = 192 (dates métier toutes en 2024-2025, created_at
--       backdaté individuellement — pas de recoupement de date fiable, mais
--       le total correspond exactement au script, garde-fou sur ce total).
--     - facture_lignes : 0 ligne liée à une facture AMD FINANCE.
--     - transactions : total = 300, dont 288 dans le périmètre (2 jours) —
--       12 lignes du 2026-06-26/29, hors périmètre, PRÉSERVÉES.
--     - accounting_events : total = 771, dont 768 dans le périmètre — 3
--       événements du 2026-06-26 (ONG-001 ×2, RES-001 ×1), hors périmètre,
--       PRÉSERVÉS, ainsi que les 9 transactions qui leur sont associées sans
--       accounting_events (activité distincte, non liée au script).
--
--   Décision utilisateur (2026-09-07/08) : purger l'intégralité du jeu de
--   démo, y compris les 3 comptes bancaires, employés et fournisseurs créés
--   par le script — confirmé qu'aucune donnée réelle n'y est mélangée.
--
-- RÉPARATION, dans une seule transaction, garde-fous sur tous les comptes
-- exacts diagnostiqués, archivage intégral (JSONB) de chaque ligne
-- supprimée dans repair_archive avant suppression, ordre respectant les
-- clés étrangères (enfants avant parents).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fous : on ne purge que l'état exactement diagnostiqué
DO $$
DECLARE
  t CONSTANT UUID := 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2';
  n INT;
BEGIN
  SELECT count(*) INTO n FROM comptes_bancaires WHERE tenant_id = t;
  IF n <> 3 THEN RAISE EXCEPTION 'Attendu 3 comptes_bancaires AMD FINANCE (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM comptes_bancaires WHERE tenant_id = t AND created_at::date = '2026-06-27';
  IF n <> 3 THEN RAISE EXCEPTION 'Attendu 3 comptes_bancaires créés le 2026-06-27, trouvé %', n; END IF;

  SELECT count(*) INTO n FROM employes WHERE tenant_id = t;
  IF n <> 8 THEN RAISE EXCEPTION 'Attendu 8 employés (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM fournisseurs WHERE tenant_id = t;
  IF n <> 30 THEN RAISE EXCEPTION 'Attendu 30 fournisseurs (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM bulletins_paie WHERE tenant_id = t;
  IF n <> 192 THEN RAISE EXCEPTION 'Attendu 192 bulletins_paie (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM achats WHERE tenant_id = t;
  IF n <> 48 THEN RAISE EXCEPTION 'Attendu 48 achats (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM stock_movements WHERE tenant_id = t;
  IF n <> 96 THEN RAISE EXCEPTION 'Attendu 96 stock_movements (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM factures WHERE tenant_id = t;
  IF n <> 192 THEN RAISE EXCEPTION 'Attendu 192 factures (total), trouvé %', n; END IF;

  SELECT count(*) INTO n FROM facture_lignes fl JOIN factures f ON f.id = fl.invoice_id WHERE f.tenant_id = t;
  IF n <> 0 THEN RAISE EXCEPTION 'Attendu 0 facture_lignes liée à AMD FINANCE, trouvé % — périmètre à revoir', n; END IF;

  SELECT count(*) INTO n FROM journal_entries
  WHERE tenant_id = t AND created_at::date IN ('2026-06-27','2026-09-02');
  IF n <> 1344 THEN RAISE EXCEPTION 'Attendu 1344 journal_entries dans le périmètre, trouvé %', n; END IF;

  SELECT count(*) INTO n FROM accounting_events
  WHERE tenant_id = t AND created_at::date IN ('2026-06-27','2026-09-02');
  IF n <> 768 THEN RAISE EXCEPTION 'Attendu 768 accounting_events dans le périmètre, trouvé %', n; END IF;

  SELECT count(*) INTO n FROM transactions
  WHERE tenant_id = t AND created_at::date IN ('2026-06-27','2026-09-02');
  IF n <> 288 THEN RAISE EXCEPTION 'Attendu 288 transactions dans le périmètre, trouvé %', n; END IF;
END $$;

-- 1. Table d'archive (déjà créée en production par 176/177 ; IF NOT EXISTS pour rejouabilité)
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

-- 2. Périmètre figé pour cette transaction (évite toute divergence entre archivage et suppression)
CREATE TEMP TABLE tmp_seed_scope ON COMMIT DROP AS
SELECT 'b93b7c3d-815b-4336-bbb2-ac24cda0edb2'::uuid AS tenant_id;

CREATE TEMP TABLE tmp_seed_events ON COMMIT DROP AS
SELECT id FROM accounting_events
WHERE tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND created_at::date IN ('2026-06-27','2026-09-02');

-- 3. journal_entries
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'journal_entries', je.id, to_jsonb(je)
FROM journal_entries je
WHERE je.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND je.created_at::date IN ('2026-06-27','2026-09-02');

DELETE FROM journal_entries je
WHERE je.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND je.created_at::date IN ('2026-06-27','2026-09-02');

-- 4. accounting_event_log (enfant de accounting_events)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'accounting_event_log', l.id, to_jsonb(l)
FROM accounting_event_log l
WHERE l.event_id IN (SELECT id FROM tmp_seed_events);

DELETE FROM accounting_event_log l
WHERE l.event_id IN (SELECT id FROM tmp_seed_events);

-- 5. accounting_events
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'accounting_events', ae.id, to_jsonb(ae)
FROM accounting_events ae
WHERE ae.id IN (SELECT id FROM tmp_seed_events);

DELETE FROM accounting_events ae
WHERE ae.id IN (SELECT id FROM tmp_seed_events);

-- 6. transactions
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'transactions', tx.id, to_jsonb(tx)
FROM transactions tx
WHERE tx.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND tx.created_at::date IN ('2026-06-27','2026-09-02');

DELETE FROM transactions tx
WHERE tx.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND tx.created_at::date IN ('2026-06-27','2026-09-02');

-- 7. stock_movements
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'stock_movements', sm.id, to_jsonb(sm)
FROM stock_movements sm
WHERE sm.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND sm.created_at::date IN ('2026-06-27','2026-09-02');

DELETE FROM stock_movements sm
WHERE sm.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND sm.created_at::date IN ('2026-06-27','2026-09-02');

-- 8. achats
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'achats', a.id, to_jsonb(a)
FROM achats a
WHERE a.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND a.created_at::date IN ('2026-06-27','2026-09-02');

DELETE FROM achats a
WHERE a.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND a.created_at::date IN ('2026-06-27','2026-09-02');

-- 9. bulletins_paie (référence employes.id — supprimé avant les employés)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'bulletins_paie', b.id, to_jsonb(b)
FROM bulletins_paie b
WHERE b.tenant_id = (SELECT tenant_id FROM tmp_seed_scope);

DELETE FROM bulletins_paie b
WHERE b.tenant_id = (SELECT tenant_id FROM tmp_seed_scope);

-- 10. factures (facture_lignes déjà confirmées vides pour ce tenant — rien à purger là)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'factures', f.id, to_jsonb(f)
FROM factures f
WHERE f.tenant_id = (SELECT tenant_id FROM tmp_seed_scope);

DELETE FROM factures f
WHERE f.tenant_id = (SELECT tenant_id FROM tmp_seed_scope);

-- 11. comptes_bancaires (les 3 corrigés par la migration 178)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'comptes_bancaires', cb.id, to_jsonb(cb)
FROM comptes_bancaires cb
WHERE cb.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND cb.created_at::date = '2026-06-27';

DELETE FROM comptes_bancaires cb
WHERE cb.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND cb.created_at::date = '2026-06-27';

-- 12. employes (référencés par bulletins_paie, déjà supprimés à l'étape 9)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'employes', e.id, to_jsonb(e)
FROM employes e
WHERE e.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND e.created_at::date = '2026-06-27';

DELETE FROM employes e
WHERE e.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND e.created_at::date = '2026-06-27';

-- 13. fournisseurs (référencés par achats, déjà supprimés à l'étape 8)
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'SEED-CLEANUP-AMD', 'fournisseurs', fo.id, to_jsonb(fo)
FROM fournisseurs fo
WHERE fo.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND fo.created_at::date = '2026-06-27';

DELETE FROM fournisseurs fo
WHERE fo.tenant_id = (SELECT tenant_id FROM tmp_seed_scope)
  AND fo.created_at::date = '2026-06-27';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (une seule instruction, lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT '1_journal_entries_restantes' AS section, 'AMD FINANCE, 2024-2025' AS cle, count(*)::text AS valeur
  FROM journal_entries WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
    AND date_operation >= '2024-01-01' AND date_operation < '2026-01-01'
  UNION ALL
  SELECT '2_comptes_bancaires_restants', 'AMD FINANCE', count(*)::text
  FROM comptes_bancaires WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '3_employes_restants', 'AMD FINANCE', count(*)::text
  FROM employes WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '4_fournisseurs_restants', 'AMD FINANCE', count(*)::text
  FROM fournisseurs WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '5_factures_restantes', 'AMD FINANCE', count(*)::text
  FROM factures WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '6_bulletins_paie_restants', 'AMD FINANCE', count(*)::text
  FROM bulletins_paie WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '7_achats_restants', 'AMD FINANCE', count(*)::text
  FROM achats WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '8_stock_movements_restants', 'AMD FINANCE', count(*)::text
  FROM stock_movements WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '9_transactions_preservees_hors_script', 'AMD FINANCE (attendu 12)', count(*)::text
  FROM transactions WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '10_accounting_events_preserves_hors_script', 'AMD FINANCE (attendu 3)', count(*)::text
  FROM accounting_events WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2'
  UNION ALL
  SELECT '11_archive_par_table', table_name, count(*)::text
  FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' GROUP BY table_name
) d ORDER BY section, cle;

-- Attendu :
--   1_journal_entries_restantes   0
--   2 à 8 (comptes/employés/fournisseurs/factures/bulletins/achats/stock)  0
--   9_transactions_preservees     12 (activité du 2026-06-26/29, hors script)
--   10_accounting_events_preserves 3 (idem)
--   11_archive_par_table          journal_entries=1344, accounting_event_log=768,
--                                  accounting_events=768, transactions=288,
--                                  stock_movements=96, achats=48, bulletins_paie=192,
--                                  factures=192, comptes_bancaires=3, employes=8,
--                                  fournisseurs=30

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE (ne pas exécuter sauf besoin) : réinsérer depuis repair_archive,
--    dans l'ordre inverse (parents avant enfants qui les référencent)
-- ═════════════════════════════════════════════════════════════════════════════
-- INSERT INTO fournisseurs      SELECT (jsonb_populate_record(NULL::fournisseurs,      row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='fournisseurs';
-- INSERT INTO employes          SELECT (jsonb_populate_record(NULL::employes,          row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='employes';
-- INSERT INTO comptes_bancaires SELECT (jsonb_populate_record(NULL::comptes_bancaires, row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='comptes_bancaires';
-- INSERT INTO factures          SELECT (jsonb_populate_record(NULL::factures,          row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='factures';
-- INSERT INTO bulletins_paie    SELECT (jsonb_populate_record(NULL::bulletins_paie,    row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='bulletins_paie';
-- INSERT INTO achats            SELECT (jsonb_populate_record(NULL::achats,            row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='achats';
-- INSERT INTO stock_movements   SELECT (jsonb_populate_record(NULL::stock_movements,   row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='stock_movements';
-- INSERT INTO transactions      SELECT (jsonb_populate_record(NULL::transactions,      row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='transactions';
-- INSERT INTO accounting_events SELECT (jsonb_populate_record(NULL::accounting_events, row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='accounting_events';
-- INSERT INTO accounting_event_log SELECT (jsonb_populate_record(NULL::accounting_event_log, row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='accounting_event_log';
-- INSERT INTO journal_entries   SELECT (jsonb_populate_record(NULL::journal_entries,   row_data)).* FROM repair_archive WHERE repair='SEED-CLEANUP-AMD' AND table_name='journal_entries';
-- ═════════════════════════════════════════════════════════════════════════════
