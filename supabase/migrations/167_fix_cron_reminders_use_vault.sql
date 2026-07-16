-- Migration 167 — Remplace app.settings.* (impossible à définir) par Supabase Vault
--
-- Contexte : migration 162 tentait de faire fonctionner le cron
-- "profil_completion_reminders" (migration 098) en documentant
-- `ALTER DATABASE postgres SET app.settings.app_url = ...` — mais Supabase
-- refuse cette commande pour un espace de noms custom non listé
-- (ERROR 42501: permission denied to set parameter). Seul un vrai superuser
-- Postgres peut créer un nouveau GUC custom via ALTER DATABASE ; le rôle
-- "postgres" hébergé par Supabase (via l'extension supautils) n'a ce droit
-- que pour une liste fermée de paramètres (voir doc "Customizing Postgres
-- configs") — "app.settings.*" n'en fait pas partie. La conception de la
-- migration 098 était donc cassée dès l'origine, indépendamment de pg_net.
--
-- Fix officiel Supabase pour ce cas exact (cron + pg_net + secret) :
-- Supabase Vault (extension supabase_vault, déjà installée sur ce projet).
-- Voir doc "Scheduling Edge Functions" : les secrets sont stockés via
-- vault.create_secret(valeur, nom) puis lus dans le corps du job cron via
-- (select decrypted_secret from vault.decrypted_secrets where name = '...').
--
-- ⚠️ Cette migration NE CRÉE PAS les secrets elle-même (pour ne jamais
-- committer de secret en clair dans un fichier de migration versionné).
-- AVANT d'exécuter ce fichier, exécuter séparément (avec de vraies valeurs,
-- fournies hors du fichier de migration) :
--
--   select vault.create_secret('https://app.oraforme.com', 'profil_reminders_app_url');
--   select vault.create_secret('<valeur AUTOMATION_SECRET>', 'profil_reminders_automation_secret');
--
-- Si ces secrets existent déjà (recréer un job après une première tentative),
-- utiliser vault.update_secret(id, valeur) à la place pour éviter les doublons —
-- vérifier d'abord avec : select id, name from vault.decrypted_secrets
-- where name in ('profil_reminders_app_url', 'profil_reminders_automation_secret');

SELECT cron.unschedule('profil_completion_reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'profil_completion_reminders'
);

SELECT cron.schedule(
  'profil_completion_reminders',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'profil_reminders_app_url') || '/api/profil/reminders',
    headers := jsonb_build_object(
      'Content-Type',        'application/json',
      'x-automation-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'profil_reminders_automation_secret')
    ),
    body    := '{"dry_run":false}'::jsonb
  );
  $$
);

DO $$
BEGIN
  RAISE NOTICE 'Migration 167 OK — cron profil_completion_reminders reprogrammé via Vault (nécessite que les 2 secrets vault existent déjà)';
END $$;
