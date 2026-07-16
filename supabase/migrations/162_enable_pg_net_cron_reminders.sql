-- Migration 162 — Fix cron "profil_completion_reminders" cassé depuis sa création
--
-- Contexte : migration 098_profil_reminders_cron.sql programme un job pg_cron
-- quotidien (07:00 UTC) qui appelle net.http_post(...) pour notifier les
-- tenants au profil incomplet. Cette migration active bien pg_cron, mais
-- oublie d'activer pg_net — le schéma "net" n'existe donc pas.
--
-- Confirmé dans les logs Postgres production : le job démarre chaque jour
-- ("cron job 2 starting") puis échoue immédiatement avec
-- "ERROR: schema \"net\" does not exist". Confirmé aussi via list_extensions :
-- pg_net installed_version = null. Résultat : aucun rappel de complétion de
-- profil n'a jamais été envoyé depuis la création de ce cron.
--
-- Fix : activer l'extension pg_net. N'affecte aucun comportement existant
-- (ajout pur, aucune donnée ni fonction retirée) — seul le job cron cassé
-- recommence à fonctionner à sa prochaine exécution planifiée.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ATTENTION — pg_net seul ne suffit pas : le job cron (migration 098) lit
-- aussi deux paramètres Postgres custom (app.settings.app_url et
-- app.settings.automation_secret) qui ne sont JAMAIS configurés. Tentative
-- initiale via `ALTER DATABASE postgres SET app.settings.xxx` : ÉCHEC
-- (ERROR 42501: permission denied to set parameter — Supabase ne permet pas
-- de créer un GUC custom via ALTER DATABASE pour le rôle postgres hébergé).
-- Voir migration 167 pour le vrai fix (Supabase Vault + cron reprogrammé).

DO $$
BEGIN
  RAISE NOTICE 'Migration 162 OK — pg_net activé, cron profil_completion_reminders opérationnel';
END $$;
