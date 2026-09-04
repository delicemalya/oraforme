-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 177 — Réparation : doublons journal_entries du trigger legacy achats
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission R-002 · ticket « triggers hérités achats » · docs/REPAIR-LOG.md
-- Prérequis : diagnostic docs/runbooks/triggers-herites-achats-diagnostic.sql
-- exécuté en production le 2026-09-04.
--
-- CONTEXTE
--   trg_achat_enregistrement (migrations 044/046, AFTER INSERT sur achats)
--   écrivait directement 48 lignes journal_entries (source='achats_enregistrement',
--   601000/401000, 25 086 000 F, tenant AMD FINANCE) avant sa suppression par la
--   migration 147. Le trigger n'existe déjà plus en production (diagnostic
--   section 1 : 0 ligne) — aucune nouvelle écriture ne sera créée par ce chemin.
--   Mais les 48 écritures créées avant sa suppression restent, en double avec
--   les 48 écritures ACH-001 émises depuis par le moteur pour les mêmes achats
--   (app/api/achats/route.ts:39). Diagnostic confirmé : 48/48 doublons, 0
--   écriture legacy sans contrepartie moteur — rien à préserver.
--
--   Volet paiement (trg_achat_paye / ACH-002) : diagnostic sections 5-8, 0
--   transaction et 0 écriture concernées (0 achat payé à ce jour) — rien à
--   réparer de ce côté, pas de matière pour cette migration.
--
-- RÉPARATION, dans une seule transaction, garde-fous sur les comptes exacts
-- diagnostiqués, archivage de chaque ligne supprimée dans repair_archive.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fous : on ne répare que l'état diagnostiqué le 2026-09-04
DO $$
DECLARE
  n INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.achats'::regclass AND NOT tgisinternal
      AND tgname IN ('trg_achat_enregistrement', 'trg_achat_paye')
  ) THEN
    RAISE EXCEPTION 'trg_achat_enregistrement/trg_achat_paye actifs sur achats : neutraliser avant (DROP TRIGGER), sinon de nouveaux doublons se créeront après cette réparation';
  END IF;

  SELECT count(*) INTO n FROM journal_entries WHERE source = 'achats_enregistrement';
  IF n <> 48 THEN
    RAISE EXCEPTION 'Attendu 48 écritures achats_enregistrement, trouvé % — état différent du diagnostic du 2026-09-04', n;
  END IF;

  -- Chaque écriture legacy doit avoir une contrepartie ACH-001 traitée par le moteur
  SELECT count(*) INTO n
  FROM journal_entries je
  WHERE je.source = 'achats_enregistrement'
    AND NOT EXISTS (
      SELECT 1 FROM accounting_events ae
      WHERE ae.source_table = 'achats' AND ae.source_id = je.source_id
        AND ae.event_type = 'ACH-001' AND ae.status = 'processed'
    );
  IF n <> 0 THEN
    RAISE EXCEPTION '% écritures legacy sans contrepartie moteur ACH-001 : ne pas supprimer, elles seraient la seule trace comptable de l''achat', n;
  END IF;
END $$;

-- 1. Table d'archive (déjà créée par la migration 176 en production ; IF NOT
--    EXISTS pour rejouabilité en environnement neuf).
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

-- 2. Archiver les 48 écritures legacy avant suppression
INSERT INTO repair_archive (repair, table_name, row_id, row_data)
SELECT 'ACH-TRG', 'journal_entries', je.id, to_jsonb(je)
FROM   journal_entries je
WHERE  je.source = 'achats_enregistrement'
  AND  EXISTS (
         SELECT 1 FROM accounting_events ae
         WHERE ae.source_table = 'achats' AND ae.source_id = je.source_id
           AND ae.event_type = 'ACH-001' AND ae.status = 'processed'
       );

-- 3. Supprimer les doublons confirmés (même filtre exact que l'archivage)
DELETE FROM journal_entries je
WHERE  je.source = 'achats_enregistrement'
  AND  EXISTS (
         SELECT 1 FROM accounting_events ae
         WHERE ae.source_table = 'achats' AND ae.source_id = je.source_id
           AND ae.event_type = 'ACH-001' AND ae.status = 'processed'
       );

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (une seule instruction, lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT '1_legacy_restant' AS section, 'journal_entries source=achats_enregistrement' AS cle,
         count(*)::text AS valeur
  FROM   journal_entries WHERE source = 'achats_enregistrement'
  UNION ALL
  SELECT '2_archive', table_name, count(*)::text
  FROM   repair_archive WHERE repair = 'ACH-TRG' GROUP BY table_name
  UNION ALL
  SELECT '3_ecritures_par_achat', 'achats avec != 1 écriture journal_entries restante',
         count(*)::text
  FROM  (
    SELECT ae.source_id
    FROM   accounting_events ae
    WHERE  ae.source_table = 'achats' AND ae.event_type = 'ACH-001' AND ae.status = 'processed'
    GROUP  BY ae.source_id
    HAVING (
      SELECT count(*) FROM journal_entries je WHERE je.source_id = ae.source_id
    ) <> 1
  ) x
) d ORDER BY section;

-- Attendu :
--   1_legacy_restant   0
--   2_archive          journal_entries = 48
--   3_ecritures_par_achat  0 (chaque achat n'a plus qu'une seule écriture : celle du moteur)

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE (ne pas exécuter sauf besoin) : réinsérer depuis repair_archive
--   INSERT INTO journal_entries SELECT (jsonb_populate_record(NULL::journal_entries, row_data)).* FROM repair_archive WHERE repair='ACH-TRG';
-- ═════════════════════════════════════════════════════════════════════════════
