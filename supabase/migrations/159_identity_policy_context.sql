-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 159 — Identity Policy Context Function
--
-- Provides fn_policy_context_counters() for buildPolicyContext().
-- Single aggregated query over auth_logs — avoids N+1 in the context builder.
-- STABLE SECURITY DEFINER — read-only, runs as service role.
-- ─────────────────────────────────────────────────────────────────────────────

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
        AND created_at < NOW() - INTERVAL '1 second'  -- exclude the current event
    ) AS last_login_success

  FROM auth_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days'
$$;

COMMENT ON FUNCTION fn_policy_context_counters(UUID) IS
  'Returns aggregated auth event counters for a single user, used by buildPolicyContext() in the Policy Engine context builder. All counters are computed in a single pass over the last 30 days.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Grant execute to service role only (context builder uses supabaseAdmin)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM anon;
REVOKE ALL ON FUNCTION fn_policy_context_counters(UUID) FROM authenticated;
