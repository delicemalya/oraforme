-- ============================================================
-- 098 — Tracking rappels de complétion profil + pg_cron
-- ============================================================
-- profil_reminders est un JSONB sur tenants qui stocke les
-- fenêtres déjà envoyées : { "r72": true, "r48": true, ... }
-- Cela évite une jointure et une table supplémentaire.
-- ============================================================

-- 1. Colonne de tracking sur tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS profil_reminders JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Index pour les scans du cron (tenants avec profil incomplet)
CREATE INDEX IF NOT EXISTS idx_tenants_profil_incomplet
  ON tenants (profil_complet, company_deadline)
  WHERE profil_complet = false AND company_deadline IS NOT NULL;

-- ============================================================
-- 2. pg_cron — Rappels quotidiens à 8h heure Congo (UTC+1)
--    → 07:00 UTC
-- ============================================================
-- Nécessite l'extension pg_cron activée dans Supabase.
-- La valeur de AUTOMATION_SECRET doit être définie dans
-- les secrets Supabase Edge Functions.
-- ============================================================

-- Activer l'extension si ce n'est pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprimer le job existant pour éviter les doublons
SELECT cron.unschedule('profil_completion_reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'profil_completion_reminders'
);

-- Programmer le job à 07:00 UTC (= 08:00 heure Congo UTC+1)
SELECT cron.schedule(
  'profil_completion_reminders',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.app_url') || '/api/profil/reminders',
    headers := jsonb_build_object(
      'Content-Type',        'application/json',
      'x-automation-secret', current_setting('app.settings.automation_secret')
    ),
    body    := '{"dry_run":false}'::jsonb
  );
  $$
);

-- ============================================================
-- 3. Paramètres app (à renseigner dans Supabase Dashboard)
--    Settings > Database > Configuration > Custom config :
--    app.settings.app_url          = https://app.oraforme.com
--    app.settings.automation_secret = <votre secret>
-- ============================================================
