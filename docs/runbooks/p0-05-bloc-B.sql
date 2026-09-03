BEGIN;

-- ── 0. Garde-fous ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN RAISE EXCEPTION 'tenants absente'; END IF;
  IF to_regclass('public.profiles') IS NULL THEN RAISE EXCEPTION 'profiles absente'; END IF;
  IF to_regclass('public.auth_logs') IS NOT NULL THEN RAISE EXCEPTION '157 déjà appliquée : auth_logs existe'; END IF;
  IF to_regclass('public.policy_history') IS NOT NULL THEN RAISE EXCEPTION '158 déjà appliquée : policy_history existe'; END IF;
END $$;

-- ── 1. Migration 157 — journal d'authentification ────────────────────────────
CREATE TABLE IF NOT EXISTS auth_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       uuid,
  event_type    text        NOT NULL,
  request_id    uuid        NOT NULL DEFAULT gen_random_uuid(),
  session_id    text,
  ip            text,
  device        text        CHECK (device IN ('desktop','mobile','tablet') OR device IS NULL),
  browser       text        CHECK (browser IN ('chrome','firefox','safari','edge','opera','other') OR browser IS NULL),
  provider      text        CHECK (provider IN ('email','google','azure','phone','magic_link') OR provider IS NULL),
  error_code    text,
  error_message text,
  duration_ms   integer     CHECK (duration_ms >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auth_logs DROP CONSTRAINT IF EXISTS auth_logs_event_type_check;
ALTER TABLE auth_logs
  ADD CONSTRAINT auth_logs_event_type_check
  CHECK (event_type IN (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
    'TOKEN_REFRESH', 'SESSION_EXPIRED', 'PASSWORD_RESET',
    'EMAIL_VERIFIED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
    'MFA_SUCCESS', 'MFA_FAILED'
  ));
CREATE INDEX IF NOT EXISTS idx_auth_logs_tenant_time  ON auth_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_event     ON auth_logs (ip, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_time    ON auth_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_time   ON auth_logs (event_type, created_at DESC);
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_logs_tenant_read" ON auth_logs;
CREATE POLICY "auth_logs_tenant_read" ON auth_logs
  FOR SELECT
  USING (
    tenant_id = (
      SELECT p.tenant_id
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('owner', 'admin')
      ORDER BY p.created_at
      LIMIT 1
    )
  );
DROP POLICY IF EXISTS "auth_logs_service_insert" ON auth_logs;
CREATE POLICY "auth_logs_service_insert" ON auth_logs
  FOR INSERT
  WITH CHECK (false);
CREATE OR REPLACE VIEW auth_metrics_daily AS
SELECT
  tenant_id,
  date_trunc('day', created_at)       AS day,
  event_type,
  COUNT(*)                            AS event_count,
  COUNT(DISTINCT user_id)             AS unique_users,
  AVG(duration_ms)                    AS avg_duration_ms,
  COUNT(DISTINCT ip)                  AS unique_ips
FROM auth_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY tenant_id, day, event_type;
CREATE OR REPLACE FUNCTION fn_auth_failed_attempts_last_hour(
  p_ip text,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM auth_logs
  WHERE ip = p_ip
    AND event_type = 'LOGIN_FAILED'
    AND created_at >= now() - interval '1 hour'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
$$;
CREATE OR REPLACE FUNCTION fn_auth_tenant_summary(
  p_tenant_id uuid,
  p_since     timestamptz DEFAULT now() - interval '24 hours'
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'login_success',   COALESCE(SUM(CASE WHEN event_type = 'LOGIN_SUCCESS'   THEN 1 ELSE 0 END), 0),
    'login_failed',    COALESCE(SUM(CASE WHEN event_type = 'LOGIN_FAILED'    THEN 1 ELSE 0 END), 0),
    'logout',          COALESCE(SUM(CASE WHEN event_type = 'LOGOUT'          THEN 1 ELSE 0 END), 0),
    'session_expired', COALESCE(SUM(CASE WHEN event_type = 'SESSION_EXPIRED' THEN 1 ELSE 0 END), 0),
    'password_reset',  COALESCE(SUM(CASE WHEN event_type = 'PASSWORD_RESET'  THEN 1 ELSE 0 END), 0),
    'active_users',    COUNT(DISTINCT CASE WHEN event_type = 'LOGIN_SUCCESS' THEN user_id END),
    'avg_duration_ms', AVG(CASE WHEN event_type = 'LOGIN_SUCCESS' THEN duration_ms END)
  )
  FROM auth_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_since
$$;
CREATE OR REPLACE FUNCTION fn_auth_logs_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth_logs WHERE created_at < now() - interval '90 days';
$$;
COMMENT ON TABLE auth_logs IS 'C-001.1 — Identity Core Observability. All auth events journalized here. Written by supabaseAdmin only. Retained 90 days.';

-- ── 2. Migration 158 — moteur de politiques ──────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       text NOT NULL,
  policy_name     text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         uuid,
  request_id      uuid NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('ALLOW','DENY','FLAG','MONITOR')),
  severity        text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason          text NOT NULL,
  action_type     text NOT NULL CHECK (action_type IN (
    'NONE','LOG_ONLY','NOTIFY_ADMIN','FLAG_USER','REQUIRE_MFA',
    'LOCK_ACCOUNT','FORCE_LOGOUT','BLOCK_IP','INVALIDATE_SESSIONS'
  )),
  action_reason   text NOT NULL,
  action_delay_ms integer NOT NULL DEFAULT 0 CHECK (action_delay_ms >= 0),
  action_success  boolean,
  evidence        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE policy_history IS
  'Journal immuable de toutes les décisions du Policy Engine. Aucune action ne peut être silencieuse.';
COMMENT ON COLUMN policy_history.reason IS
  'Explication obligatoire de la décision — jamais vide, jamais "N/A".';
CREATE INDEX IF NOT EXISTS idx_policy_history_tenant_created
  ON policy_history (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_history_user_created
  ON policy_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_history_policy_created
  ON policy_history (policy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_history_verdict_created
  ON policy_history (verdict, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_history_severity_created
  ON policy_history (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_history_request
  ON policy_history (request_id);
ALTER TABLE policy_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_history_insert_blocked" ON policy_history;
CREATE POLICY "policy_history_insert_blocked"
  ON policy_history FOR INSERT
  WITH CHECK (false);
DROP POLICY IF EXISTS "policy_history_no_update" ON policy_history;
CREATE POLICY "policy_history_no_update"
  ON policy_history FOR UPDATE
  WITH CHECK (false);
DROP POLICY IF EXISTS "policy_history_no_delete" ON policy_history;
CREATE POLICY "policy_history_no_delete"
  ON policy_history FOR DELETE
  USING (false);
CREATE TABLE IF NOT EXISTS policy_violations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id      uuid NOT NULL REFERENCES policy_history(id) ON DELETE CASCADE,
  policy_id       text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         uuid,
  severity        text NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('DENY','FLAG')),
  resolved        boolean NOT NULL DEFAULT false,
  resolved_by     uuid,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE policy_violations IS
  'Violations de politiques (verdict DENY ou FLAG) — suivies séparément pour la résolution et l''alerte.';
CREATE INDEX IF NOT EXISTS idx_policy_violations_tenant
  ON policy_violations (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_violations_unresolved
  ON policy_violations (tenant_id, resolved, severity, created_at DESC)
  WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_policy_violations_policy
  ON policy_violations (policy_id, created_at DESC);
ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE src TEXT;
BEGIN
  -- 158 lit user_tenants ; si la table n'existe pas en production, profiles porte la même information.
  IF to_regclass('public.user_tenants') IS NOT NULL THEN
    src := '(SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() LIMIT 1)';
  ELSE
    src := '(SELECT tenant_id FROM profiles WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1)';
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS "policy_history_select_tenant" ON policy_history';
  EXECUTE 'CREATE POLICY "policy_history_select_tenant" ON policy_history FOR SELECT USING (tenant_id = ' || src || ')';
  EXECUTE 'DROP POLICY IF EXISTS "policy_violations_select_tenant" ON policy_violations';
  EXECUTE 'CREATE POLICY "policy_violations_select_tenant" ON policy_violations FOR SELECT USING (tenant_id = ' || src || ')';
END $$;

DROP POLICY IF EXISTS "policy_violations_insert_blocked" ON policy_violations;
CREATE POLICY "policy_violations_insert_blocked"
  ON policy_violations FOR INSERT
  WITH CHECK (false);
CREATE OR REPLACE VIEW policy_metrics_last_24h AS
SELECT
  tenant_id,
  policy_id,
  policy_name,
  verdict,
  severity,
  COUNT(*)                                   AS total_decisions,
  COUNT(*) FILTER (WHERE verdict IN ('DENY','FLAG')) AS violations,
  MAX(created_at)                            AS last_decision_at
FROM policy_history
WHERE created_at >= now() - INTERVAL '24 hours'
GROUP BY tenant_id, policy_id, policy_name, verdict, severity;
COMMENT ON VIEW policy_metrics_last_24h IS
  'Agrégats de décisions Policy Engine sur les dernières 24 heures.';
CREATE OR REPLACE FUNCTION fn_policy_violation_count(
  p_tenant_id uuid,
  p_hours     int DEFAULT 24
)
RETURNS TABLE (
  policy_id   text,
  policy_name text,
  severity    text,
  count       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    policy_id,
    policy_name,
    severity,
    COUNT(*) AS count
  FROM policy_history
  WHERE tenant_id = p_tenant_id
    AND verdict IN ('DENY','FLAG')
    AND created_at >= now() - make_interval(hours => p_hours)
  GROUP BY policy_id, policy_name, severity
  ORDER BY count DESC;
$$;
COMMENT ON FUNCTION fn_policy_violation_count IS
  'Nombre de violations par politique pour un tenant donné sur une fenêtre temporelle.';
CREATE OR REPLACE FUNCTION fn_policy_history_cleanup(p_retain_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM policy_history
  WHERE created_at < now() - make_interval(days => p_retain_days)
    AND verdict IN ('ALLOW','MONITOR');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ── 3. Migration 159 — compteurs de contexte ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_policy_context_counters(
  p_user_id UUID
)
RETURNS TABLE (
  failed_15m          BIGINT,
  failed_1h           BIGINT,
  refresh_1h          BIGINT,
  mfa_1h              BIGINT,
  active_sessions_4h  BIGINT,
  last_password_reset TIMESTAMPTZ,
  last_login_success  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE event_type = 'LOGIN_FAILED'
        AND user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '15 minutes'
    ) AS failed_15m,
    COUNT(*) FILTER (
      WHERE event_type = 'LOGIN_FAILED'
        AND user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '1 hour'
    ) AS failed_1h,
    COUNT(*) FILTER (
      WHERE event_type = 'TOKEN_REFRESH'
        AND user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '1 hour'
    ) AS refresh_1h,
    COUNT(*) FILTER (
      WHERE event_type = 'MFA_SUCCESS'
        AND user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '1 hour'
    ) AS mfa_1h,
    COUNT(*) FILTER (
      WHERE event_type = 'LOGIN_SUCCESS'
        AND user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '4 hours'
    ) AS active_sessions_4h,
    MAX(created_at) FILTER (
      WHERE event_type = 'PASSWORD_RESET'
        AND user_id = p_user_id
    ) AS last_password_reset,
    MAX(created_at) FILTER (
      WHERE event_type = 'LOGIN_SUCCESS'
        AND user_id = p_user_id
        AND created_at < NOW() - INTERVAL '1 second'
    ) AS last_login_success
  FROM auth_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days'
$$;
COMMENT ON FUNCTION fn_policy_context_counters(UUID) IS
  'Returns aggregated auth event counters for a single user, used by buildPolicyContext() in the Policy Engine context builder. All counters are computed in a single pass over the last 30 days.';
REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM anon;
REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM authenticated;

-- ── 4. search_path fixé sur les fonctions créées (165 reste vraie) ──────────
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
  END LOOP;
END $$;

COMMIT;

-- ── Contrôle ─────────────────────────────────────────────────────────────────
SELECT * FROM (
  SELECT '157 auth_logs' AS migration, (to_regclass('public.auth_logs') IS NOT NULL)::text AS presente
  UNION ALL SELECT '157 auth_metrics_daily', (to_regclass('public.auth_metrics_daily') IS NOT NULL)::text
  UNION ALL SELECT '157 policies auth_logs', (SELECT count(*)::text FROM pg_policies WHERE tablename='auth_logs')
  UNION ALL SELECT '158 policy_history · policy_violations',
         (to_regclass('public.policy_history') IS NOT NULL)::text || ' · ' || (to_regclass('public.policy_violations') IS NOT NULL)::text
  UNION ALL SELECT '158 source des policies SELECT',
         (SELECT CASE WHEN qual LIKE '%user_tenants%' THEN 'user_tenants' ELSE 'profiles' END FROM pg_policies WHERE policyname='policy_history_select_tenant')
  UNION ALL SELECT '159 fn_policy_context_counters(uuid)', (to_regprocedure('fn_policy_context_counters(uuid)') IS NOT NULL)::text
  UNION ALL SELECT '159 anon/authenticated sans EXECUTE',
         (NOT has_function_privilege('anon', 'fn_policy_context_counters(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'fn_policy_context_counters(uuid)', 'EXECUTE'))::text
  UNION ALL SELECT '165 fonctions sans search_path (0 attendu)',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%'))
) d ORDER BY migration;
