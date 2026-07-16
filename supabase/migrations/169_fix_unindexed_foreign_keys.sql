-- Migration 169 — Fix advisor performance INFO "unindexed_foreign_keys" (212 colonnes)
--
-- Contexte : 212 colonnes de clé étrangère (schéma public) n'ont aucun
-- index de couverture. Sans index, chaque JOIN, chaque suppression en
-- cascade et chaque vérification de contrainte référentielle sur la table
-- parente déclenche un scan complet de la table enfant. Concentré sur des
-- tables à fort volume : cheques, journal_entries, factures, achats,
-- his_examens_imagerie, his_interventions, report_cards...
--
-- Fix : ajout pur d'index B-tree, un par colonne FK non couverte. Aucune
-- perte de données, aucun changement de comportement applicatif.
--
-- ⚠️ Verrouillage : ce script utilise CREATE INDEX (pas CONCURRENTLY),
-- qui prend un verrou SHARE sur chaque table le temps de construire son
-- index (bloque INSERT/UPDATE/DELETE, pas les lectures). CONCURRENTLY
-- évite ce verrou mais ne peut PAS s'exécuter dans un bloc de transaction
-- ni dans un script multi-instructions (le SQL Editor Supabase envoie un
-- script collé comme un bloc transactionnel implicite — CONCURRENTLY y
-- échoue systématiquement). Vu l'échelle du projet (~26 tenants actifs),
-- chaque CREATE INDEX devrait prendre une fraction de seconde — risque
-- de contention faible mais pas nul sur les tables les plus écrites
-- (journal_entries, factures, cheques). Lancer de préférence hors heures
-- de forte activité. Une version CONCURRENTLY (à exécuter statement par
-- statement, un par un, si un verrou zéro est requis) peut être générée
-- séparément sur demande.
--
-- Approche générique : boucle sur les contraintes FK du schéma public,
-- ne crée un index QUE si la colonne n'a déjà aucun index (en première
-- position) qui la couvre — idempotent et sûr à ré-exécuter.

DO $$
DECLARE
  fk        RECORD;
  idx_name  TEXT;
  n         INTEGER := 0;
BEGIN
  FOR fk IN
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
        WHERE t.relname = tc.table_name AND a.attname = kcu.column_name
          AND a.attnum = i.indkey[0]
      )
    GROUP BY tc.table_name, kcu.column_name
  LOOP
    idx_name := 'idx_' || fk.table_name || '_' || fk.column_name;
    -- Tronquer si > 63 caractères (limite identifiant Postgres)
    idx_name := left(idx_name, 63);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      idx_name, fk.table_name, fk.column_name
    );
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Migration 169 OK — % index créés sur les FK non couvertes', n;
END $$;
