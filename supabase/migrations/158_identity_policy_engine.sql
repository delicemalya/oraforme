-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 158 — Identity Policy Engine
-- C-001.2 : tables de traçabilité des politiques d'accès
-- Aucune logique métier — uniquement l'infrastructure de décision Identity
-- ─────────────────────────────────────────────────────────────────────────────

-- ── policy_history ─────────────────────────────────────────────────────────
-- Toutes les décisions de politique, qu'elles soient ALLOW/DENY/FLAG/MONITOR.
-- Immuable : pas de UPDATE ni DELETE (assurés par RLS).

CREATE TABLE IF NOT EXISTS policy_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       text NOT NULL,
  policy_name     text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         uuid,                          -- NOT FK to auth.users (peut être null)
  request_id      uuid NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('ALLOW','DENY','FLAG','MONITOR')),
  severity        text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason          text NOT NULL,                 -- JAMAIS vide — toute décision doit être expliquée
  action_type     text NOT NULL CHECK (action_type IN (
    'NONE','LOG_ONLY','NOTIFY_ADMIN','FLAG_USER','REQUIRE_MFA',
    'LOCK_ACCOUNT','FORCE_LOGOUT','BLOCK_IP','INVALIDATE_SESSIONS'
  )),
  action_reason   text NOT NULL,
  action_delay_ms integer NOT NULL DEFAULT 0 CHECK (action_delay_ms >= 0),
  action_success  boolean,                       -- null = non encore exécuté
  evidence        jsonb NOT NULL DEFAULT '{}',   -- PolicyEvidence sérialisée
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE policy_history IS
  'Journal immuable de toutes les décisions du Policy Engine. Aucune action ne peut être silencieuse.';

COMMENT ON COLUMN policy_history.reason IS
  'Explication obligatoire de la décision — jamais vide, jamais "N/A".';

-- Index principaux
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

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE policy_history ENABLE ROW LEVEL SECURITY;

-- INSERT : bloqué pour tous les rôles authentifiés (seul le service role peut insérer)
CREATE POLICY "policy_history_insert_blocked"
  ON policy_history FOR INSERT
  WITH CHECK (false);

-- SELECT : chaque tenant voit uniquement ses propres données
CREATE POLICY "policy_history_select_tenant"
  ON policy_history FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- UPDATE/DELETE : bloqués (journal immuable)
CREATE POLICY "policy_history_no_update"
  ON policy_history FOR UPDATE
  WITH CHECK (false);

CREATE POLICY "policy_history_no_delete"
  ON policy_history FOR DELETE
  USING (false);

-- ── policy_violations ───────────────────────────────────────────────────────
-- Sous-ensemble de policy_history : uniquement les verdicts DENY + FLAG.
-- Vue matérialisée mise à jour au fil de l'eau via INSERT dans policy_history.
-- Utilisée pour les alertes opérationnelles et le tableau de bord.

CREATE TABLE IF NOT EXISTS policy_violations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id      uuid NOT NULL REFERENCES policy_history(id) ON DELETE CASCADE,
  policy_id       text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         uuid,
  severity        text NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('DENY','FLAG')),
  resolved        boolean NOT NULL DEFAULT false,
  resolved_by     uuid,                    -- user_id de l'opérateur qui a résolu
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE policy_violations IS
  'Violations de politiques (verdict DENY ou FLAG) — suivies séparément pour la résolution et l'alerte.';

CREATE INDEX IF NOT EXISTS idx_policy_violations_tenant
  ON policy_violations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_violations_unresolved
  ON policy_violations (tenant_id, resolved, severity, created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_policy_violations_policy
  ON policy_violations (policy_id, created_at DESC);

ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_violations_insert_blocked"
  ON policy_violations FOR INSERT
  WITH CHECK (false);

CREATE POLICY "policy_violations_select_tenant"
  ON policy_violations FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ── Agrégation rapide — vue pour le dashboard ───────────────────────────────
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

-- ── Fonction utilitaire : violation count par tenant ────────────────────────
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

-- ── Nettoyage : archivage des entrées > 90 jours ────────────────────────────
-- (exécuté manuellement ou via cron Supabase Edge Function)
CREATE OR REPLACE FUNCTION fn_policy_history_cleanup(p_retain_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM policy_history
  WHERE created_at < now() - make_interval(days => p_retain_days)
    AND verdict IN ('ALLOW','MONITOR');  -- garder DENY/FLAG plus longtemps
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
