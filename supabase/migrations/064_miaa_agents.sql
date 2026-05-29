-- =============================================================================
-- Migration 064 : MIAA+ Agents — Tables de support pour les 2 couches d'agents
-- Date         : 2026-05-29
-- Idempotente  : IF NOT EXISTS / OR REPLACE / EXCEPTION WHEN duplicate_object
-- =============================================================================


-- =============================================================================
-- TABLE 1 — miaa_conversations : historique des échanges avec les agents MIAA+
-- =============================================================================

CREATE TABLE IF NOT EXISTS miaa_conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  module       TEXT        NOT NULL,
  message_user TEXT        NOT NULL,
  message_miaa TEXT        NOT NULL,
  action_type  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE miaa_conversations ENABLE ROW LEVEL SECURITY;

-- Un tenant voit uniquement ses propres conversations
DO $$ BEGIN
  CREATE POLICY "miaa_conv_tenant_select" ON miaa_conversations FOR SELECT
    USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Les super-admins voient tout
DO $$ BEGIN
  CREATE POLICY "miaa_conv_admin_select" ON miaa_conversations FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert via service_role uniquement (l'API utilise supabaseAdmin)

CREATE INDEX IF NOT EXISTS idx_miaa_conv_tenant  ON miaa_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_miaa_conv_module  ON miaa_conversations(module);
CREATE INDEX IF NOT EXISTS idx_miaa_conv_created ON miaa_conversations(created_at DESC);


-- =============================================================================
-- TABLE 2 — admin_alerts : alertes générées par les agents soldats
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT        NOT NULL,
  severity     TEXT        NOT NULL CHECK (severity IN ('info','haute','critique')),
  message      TEXT        NOT NULL,
  action_prise TEXT,
  lu           BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Seuls les super-admins peuvent lire les alertes
DO $$ BEGIN
  CREATE POLICY "admin_alerts_select" ON admin_alerts FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_lu        ON admin_alerts(lu) WHERE lu = false;
CREATE INDEX IF NOT EXISTS idx_alerts_created   ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type      ON admin_alerts(type);


-- =============================================================================
-- TABLE 3 — ips_bloquees : IPs détectées comme suspectes par l'agent sécurité
-- =============================================================================

CREATE TABLE IF NOT EXISTS ips_bloquees (
  ip             TEXT        PRIMARY KEY,
  raison         TEXT,
  nb_tentatives  INTEGER     NOT NULL DEFAULT 1,
  bloque_jusqu   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ips_bloquees ENABLE ROW LEVEL SECURITY;

-- Seuls les super-admins peuvent lire/modifier
DO $$ BEGIN
  CREATE POLICY "ips_bloquees_admin" ON ips_bloquees FOR ALL
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ips_bloque_jusqu ON ips_bloquees(bloque_jusqu)
  WHERE bloque_jusqu IS NOT NULL;


-- =============================================================================
-- TABLE 4 — performance_logs : latences mesurées par l'agent performance
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  latence_ms  INTEGER     NOT NULL,
  statut      TEXT        NOT NULL CHECK (statut IN ('ok','lent','critique')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "perf_logs_admin" ON performance_logs FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_perf_created ON performance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_statut  ON performance_logs(statut) WHERE statut != 'ok';

-- Purge automatique : ne garder que 30 jours
CREATE OR REPLACE FUNCTION fn_purge_performance_logs()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM performance_logs WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;


-- =============================================================================
-- TABLE 5 — backups : snapshots quotidiens du nombre d'enregistrements
-- =============================================================================

CREATE TABLE IF NOT EXISTS backups (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name          TEXT        NOT NULL,
  nb_enregistrements  INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "backups_admin" ON backups FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_backups_table   ON backups(table_name);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at DESC);


-- =============================================================================
-- VUE — v_admin_dashboard : tableau de bord super-admin agrégé
-- =============================================================================

DROP VIEW IF EXISTS v_admin_dashboard CASCADE;

CREATE OR REPLACE VIEW v_admin_dashboard AS
SELECT
  (SELECT COUNT(*) FROM tenants)                                                  AS nb_tenants,
  (SELECT COUNT(*) FROM admin_alerts WHERE lu = false)                            AS alertes_non_lues,
  (SELECT COUNT(*) FROM admin_alerts WHERE severity = 'critique' AND lu = false) AS alertes_critiques,
  (SELECT AVG(latence_ms) FROM performance_logs
     WHERE created_at >= NOW() - INTERVAL '1 hour')                              AS latence_avg_ms,
  (SELECT COUNT(*) FROM miaa_conversations
     WHERE created_at >= NOW() - INTERVAL '24 hours')                            AS miaa_conversations_24h,
  NOW()                                                                           AS calculee_a;

COMMENT ON VIEW v_admin_dashboard IS
  'KPIs super-admin en temps réel. Lecture via service_role uniquement.';


-- =============================================================================
-- FIN MIGRATION 064
-- =============================================================================
