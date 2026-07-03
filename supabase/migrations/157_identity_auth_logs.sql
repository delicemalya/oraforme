-- ============================================================
-- Migration 157 — Identity Observability : auth_logs
-- C-001.1 — Identity Core Observability Foundation
-- ============================================================

-- ── Table auth_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       uuid,       -- NOT FK to auth.users — must survive user deletion
  event_type    text        NOT NULL,
  -- Trace context
  request_id    uuid        NOT NULL DEFAULT gen_random_uuid(),
  session_id    text,
  ip            text,
  device        text        CHECK (device IN ('desktop','mobile','tablet') OR device IS NULL),
  browser       text        CHECK (browser IN ('chrome','firefox','safari','edge','opera','other') OR browser IS NULL),
  -- Event metadata
  provider      text        CHECK (provider IN ('email','google','azure','phone','magic_link') OR provider IS NULL),
  error_code    text,
  error_message text,
  duration_ms   integer     CHECK (duration_ms >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Constraints ───────────────────────────────────────────────
ALTER TABLE auth_logs
  ADD CONSTRAINT auth_logs_event_type_check
  CHECK (event_type IN (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
    'TOKEN_REFRESH', 'SESSION_EXPIRED', 'PASSWORD_RESET',
    'EMAIL_VERIFIED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
    'MFA_SUCCESS', 'MFA_FAILED'
  ));

-- ── Indexes ───────────────────────────────────────────────────
-- Primary query pattern: tenant + time range
CREATE INDEX idx_auth_logs_tenant_time  ON auth_logs (tenant_id, created_at DESC);
-- Security: failed logins per IP (brute-force detection)
CREATE INDEX idx_auth_logs_ip_event     ON auth_logs (ip, event_type, created_at DESC);
-- User activity
CREATE INDEX idx_auth_logs_user_time    ON auth_logs (user_id, created_at DESC);
-- Event type filtering
CREATE INDEX idx_auth_logs_event_time   ON auth_logs (event_type, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Admins and owners can read their own tenant's logs
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

-- Only service role can insert (no direct client inserts)
-- INSERT blocked for all authenticated users — use supabaseAdmin from server only
CREATE POLICY "auth_logs_service_insert" ON auth_logs
  FOR INSERT
  WITH CHECK (false);  -- blocked for all roles; service role bypasses RLS

-- ── Aggregation view for metrics dashboard ────────────────────
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

-- ── Function: brute-force detection ──────────────────────────
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

-- ── Function: get tenant auth summary ────────────────────────
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

-- ── Retention: auto-delete logs older than 90 days ────────────
-- (run via pg_cron or supabase scheduled function)
CREATE OR REPLACE FUNCTION fn_auth_logs_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth_logs WHERE created_at < now() - interval '90 days';
$$;

COMMENT ON TABLE auth_logs IS 'C-001.1 — Identity Core Observability. All auth events journalized here. Written by supabaseAdmin only. Retained 90 days.';
