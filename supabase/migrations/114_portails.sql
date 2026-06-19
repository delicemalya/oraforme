-- ════════════════════════════════════════════════════════════════
-- Migration 114 — Portails Client & Candidat
-- Tokens d'accès, notifications temps réel, messagerie portail
-- ════════════════════════════════════════════════════════════════

-- ── 1. portal_tokens — Magic link d'accès aux portails ───────────────────────

CREATE TABLE IF NOT EXISTS portal_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  portal_type   TEXT        NOT NULL CHECK (portal_type IN ('client', 'candidat')),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_id     UUID        NOT NULL,  -- client.id OR candidat.id
  target_nom    TEXT,
  target_email  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '365 days',
  last_used_at  TIMESTAMPTZ,
  revoked       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token      ON portal_tokens (token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_tenant     ON portal_tokens (tenant_id, portal_type);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_target     ON portal_tokens (target_id, portal_type);

-- Token visible uniquement par le tenant propriétaire (via service_role dans les API routes)
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_tokens: tenant owner"
  ON portal_tokens FOR ALL
  USING (tenant_id = (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    ORDER BY created_at LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE ON portal_tokens TO authenticated;

COMMENT ON TABLE portal_tokens IS
  'Tokens magic-link pour l''accès aux portails Client et Candidat. '
  'Validés exclusivement par les API routes via service_role.';


-- ── 2. portal_notifications — Notifications temps réel (Supabase Realtime) ───

CREATE TABLE IF NOT EXISTS portal_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_type  TEXT        NOT NULL CHECK (portal_type IN ('client', 'candidat')),
  target_id    UUID        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT,
  type         TEXT        NOT NULL DEFAULT 'info',
  -- ex: 'candidat_propose', 'facture', 'contrat_signe', 'mission', 'paie', 'info'
  data         JSONB,
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portalnotif_target ON portal_notifications(target_id, portal_type, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portalnotif_tenant ON portal_notifications(tenant_id, created_at DESC);

ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

-- Service_role écrit les notifs ; lecture par API route uniquement
CREATE POLICY "portal_notifications: tenant"
  ON portal_notifications FOR SELECT
  USING (tenant_id = (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    ORDER BY created_at LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE ON portal_notifications TO authenticated;

-- Activer Realtime sur cette table (nécessite ALTER PUBLICATION dans Supabase Dashboard)
COMMENT ON TABLE portal_notifications IS
  'Notifications temps réel pour les portails. '
  'Activer Realtime dans Supabase Dashboard : Database → Replication → supabase_realtime → portal_notifications.';


-- ── 3. portal_messages — Messagerie portail bidirectionnelle ─────────────────

CREATE TABLE IF NOT EXISTS portal_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_type  TEXT        NOT NULL CHECK (portal_type IN ('client', 'candidat')),
  target_id    UUID        NOT NULL,
  direction    TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  -- inbound = depuis le portail vers l'agence ; outbound = depuis l'agence vers le portail
  subject      TEXT,
  body         TEXT        NOT NULL,
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_msgs_target ON portal_messages(target_id, portal_type, created_at DESC);

ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_messages: tenant"
  ON portal_messages FOR ALL
  USING (tenant_id = (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    ORDER BY created_at LIMIT 1
  ));

GRANT SELECT, INSERT ON portal_messages TO authenticated;


-- ── 4. portal_candidats_proposes — Statut des propositions candidats ─────────
-- Liaison candidature → client avec statut (proposé / accepté / refusé)

CREATE TABLE IF NOT EXISTS portal_candidats_proposes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL,  -- rh_partenaires.id or clients.id
  candidat_id     UUID        NOT NULL,  -- cv_candidats.id or candidats.id
  offre_id        UUID,                  -- offres_emploi.id
  poste           TEXT        NOT NULL,
  statut          TEXT        NOT NULL DEFAULT 'propose'
    CHECK (statut IN ('propose', 'accepte', 'refuse', 'entretien_planifie', 'place')),
  score_match     INT,                    -- 0-100
  message_agence  TEXT,
  retour_client   TEXT,
  date_proposition TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_retour     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcp_client ON portal_candidats_proposes(client_id, statut);
CREATE INDEX IF NOT EXISTS idx_pcp_tenant ON portal_candidats_proposes(tenant_id);

ALTER TABLE portal_candidats_proposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcp: tenant" ON portal_candidats_proposes
  FOR ALL USING (tenant_id = (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    ORDER BY created_at LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE ON portal_candidats_proposes TO authenticated;


-- ── 5. Colonne portal_token_id sur clients/candidats (référence rapide) ───────

-- Ajouter une colonne portal_access sur cv_candidats si elle n'existe pas
ALTER TABLE cv_candidats
  ADD COLUMN IF NOT EXISTS portal_access    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_email     TEXT;

-- Ajouter colonne portal_access sur clients si la table existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS portal_access    BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS portal_email     TEXT;
    RAISE NOTICE 'clients: +portal_access, +portal_email';
  ELSE
    RAISE NOTICE 'clients: table not found, skipping';
  END IF;
END $$;


-- ── 6. Fonction fn_create_portal_token() ──────────────────────────────────────
-- Crée ou renouvelle un token pour un client/candidat.
-- Utilisée depuis les API routes avec service_role.

CREATE OR REPLACE FUNCTION public.fn_create_portal_token(
  p_portal_type  TEXT,
  p_tenant_id    UUID,
  p_target_id    UUID,
  p_target_nom   TEXT DEFAULT NULL,
  p_target_email TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Révoquer les anciens tokens du même target
  UPDATE portal_tokens
  SET revoked = TRUE
  WHERE portal_type = p_portal_type
    AND tenant_id   = p_tenant_id
    AND target_id   = p_target_id
    AND revoked     = FALSE;

  -- Créer un nouveau token
  INSERT INTO portal_tokens (portal_type, tenant_id, target_id, target_nom, target_email)
  VALUES (p_portal_type, p_tenant_id, p_target_id, p_target_nom, p_target_email)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_portal_token TO authenticated;


-- ── 7. Smoke test ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_tokens'
  ) THEN RAISE EXCEPTION 'portal_tokens manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_notifications'
  ) THEN RAISE EXCEPTION 'portal_notifications manquante'; END IF;

  RAISE NOTICE '✅ Migration 114 — Portails Client & Candidat : OK';
  RAISE NOTICE '   Tables : portal_tokens, portal_notifications, portal_messages,';
  RAISE NOTICE '            portal_candidats_proposes';
  RAISE NOTICE '   Action requise : activer Realtime sur portal_notifications dans Dashboard';
END;
$$;
