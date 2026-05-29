-- =============================================================================
-- Migration 063 : Enterprise Hardening — Sécurité, Indexes, Monitoring
-- Objectif     : Stabilité enterprise-grade, isolation multi-tenant renforcée
-- Date         : 2026-05-29
-- Idempotente  : IF NOT EXISTS / OR REPLACE / DO $$ EXCEPTION $$
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Table error_logs (monitoring frontend/backend)
-- =============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT        NOT NULL CHECK (level IN ('debug','info','warn','error','critical')),
  message     TEXT        NOT NULL,
  module      TEXT,
  tenant_id   UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  data        JSONB,
  duration_ms INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Les super-admins peuvent tout lire
DO $$ BEGIN
  CREATE POLICY "errlog_admin_select" ON error_logs FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un tenant ne peut voir que ses propres logs
DO $$ BEGIN
  CREATE POLICY "errlog_tenant_select" ON error_logs FOR SELECT
    USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert via service_role uniquement (API route utilise supabaseAdmin)
-- Pas de policy INSERT pour éviter que les tenants injectent de faux logs

CREATE INDEX IF NOT EXISTS idx_errlog_tenant    ON error_logs(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_errlog_level     ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_errlog_occurred  ON error_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_errlog_module    ON error_logs(module) WHERE module IS NOT NULL;


-- =============================================================================
-- SECTION 2 — Contrainte UNIQUE entreprise_config (1 config par tenant)
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE entreprise_config
    ADD CONSTRAINT entreprise_config_tenant_uq UNIQUE (tenant_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- Si des doublons existent, les dédupliquer d'abord (garde le plus récent)
-- (exécuté dans un DO block pour éviter les erreurs si la table est propre)
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT tenant_id FROM entreprise_config
    GROUP BY tenant_id HAVING COUNT(*) > 1
  ) sub;

  IF dup_count > 0 THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM entreprise_config
    WHERE id NOT IN (
      SELECT DISTINCT ON (tenant_id) id
      FROM entreprise_config
      ORDER BY tenant_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    );
    RAISE NOTICE 'Supprimé % doublons dans entreprise_config', dup_count;
  END IF;
END $$;


-- =============================================================================
-- SECTION 3 — Indexes manquants sur tables critiques
-- =============================================================================

-- factures
CREATE INDEX IF NOT EXISTS idx_factures_tenant_date    ON factures(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factures_tenant_statut  ON factures(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_factures_due_date       ON factures(due_date) WHERE statut NOT IN ('payee','annulee');

-- transactions (ledger central)
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date   ON transactions(tenant_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_source ON transactions(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_type   ON transactions(tenant_id, type);

-- journal_entries (OHADA)
CREATE INDEX IF NOT EXISTS idx_je_tenant_date   ON journal_entries(tenant_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_je_tenant_compte ON journal_entries(tenant_id, debit_account);

-- employes
CREATE INDEX IF NOT EXISTS idx_employes_tenant        ON employes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employes_tenant_statut ON employes(tenant_id, statut);

-- bulletins_paie
CREATE INDEX IF NOT EXISTS idx_bpaie_tenant_mois ON bulletins_paie(tenant_id, annee, mois);

-- depenses
CREATE INDEX IF NOT EXISTS idx_depenses_tenant_date ON depenses(tenant_id, date DESC);

-- achats
CREATE INDEX IF NOT EXISTS idx_achats_tenant_date   ON achats(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_achats_tenant_statut ON achats(tenant_id, statut);

-- products / stock
CREATE INDEX IF NOT EXISTS idx_products_tenant        ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_actif  ON products(tenant_id, actif);

-- profiles (clé de résolution tenant)
CREATE INDEX IF NOT EXISTS idx_profiles_user_created  ON profiles(user_id, created_at ASC);

-- billing_subscriptions
CREATE INDEX IF NOT EXISTS idx_bsub_trial_ends ON billing_subscriptions(trial_ends_at)
  WHERE statut = 'trial' AND trial_ends_at IS NOT NULL;


-- =============================================================================
-- SECTION 4 — Fonction get_my_tenant_id() : vérification d'existence
-- =============================================================================

-- S'assure que la fonction existe (idempotent)
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
  RETURN v_tenant_id;
END;
$$;


-- =============================================================================
-- SECTION 5 — Vue d'audit multi-tenant (détection anomalies)
-- =============================================================================

DROP VIEW IF EXISTS v_tenant_audit CASCADE;

CREATE OR REPLACE VIEW v_tenant_audit AS
SELECT
  t.id              AS tenant_id,
  t.nom_entreprise,
  t.secteur_activite,
  t.plan,
  t.status,
  t.created_at,
  COUNT(DISTINCT p.id)        AS nb_profiles,
  COUNT(DISTINCT f.id)        AS nb_factures,
  COUNT(DISTINCT tr.id)       AS nb_transactions,
  MAX(tr.created_at)          AS derniere_transaction,
  MAX(p.updated_at)           AS derniere_connexion
FROM tenants t
LEFT JOIN profiles p      ON p.tenant_id = t.id
LEFT JOIN factures f      ON f.tenant_id = t.id
LEFT JOIN transactions tr ON tr.tenant_id = t.id
GROUP BY t.id, t.nom_entreprise, t.secteur_activite, t.plan, t.status, t.created_at;

COMMENT ON VIEW v_tenant_audit IS
  'Vue admin : activité et santé de chaque tenant. Lecture via service_role uniquement.';


-- =============================================================================
-- SECTION 6 — Vue global error monitoring pour le dashboard admin
-- =============================================================================

DROP VIEW IF EXISTS v_error_summary CASCADE;

CREATE OR REPLACE VIEW v_error_summary AS
SELECT
  DATE_TRUNC('hour', occurred_at) AS heure,
  level,
  module,
  COUNT(*)                         AS nb_erreurs,
  COUNT(DISTINCT tenant_id)        AS nb_tenants_affectes
FROM error_logs
WHERE occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

COMMENT ON VIEW v_error_summary IS
  'Synthèse des erreurs par heure, niveau et module — 7 derniers jours.';


-- =============================================================================
-- SECTION 7 — Politique RLS sur vues (sécurité supplémentaire)
-- =============================================================================

-- Vérifie que les tables critiques ont bien RLS activé
ALTER TABLE IF EXISTS factures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bulletins_paie   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS depenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS achats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entreprise_config ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 8 — Nettoyage automatique logs anciens (job cron-style via trigger)
-- =============================================================================

-- Fonction de purge des logs > 90 jours (appelée manuellement ou via pg_cron)
CREATE OR REPLACE FUNCTION fn_purge_old_logs()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM error_logs WHERE occurred_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION fn_purge_old_logs() IS
  'Supprime les error_logs de plus de 90 jours. Appeler via pg_cron ou manuellement.';


-- =============================================================================
-- FIN MIGRATION 063
-- =============================================================================
