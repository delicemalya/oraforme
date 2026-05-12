-- ── Migration 022 — RBAC : espaces + permissions utilisateurs ────────────────

-- Fonction utilitaire : rôle de l'utilisateur courant (SECURITY DEFINER pour éviter la récursion RLS)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Fonction utilitaire : id du profil de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── Espaces / départements ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spaces_tenant_iso" ON spaces
  FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── Permissions par module et par utilisateur ─────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT true,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, module_key)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Tout membre du tenant peut lire les permissions (sidebar en a besoin)
CREATE POLICY "up_read" ON user_permissions
  FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- Seul le owner peut insérer / modifier / supprimer
CREATE POLICY "up_owner_write" ON user_permissions
  FOR INSERT
  WITH CHECK (
    tenant_id = get_my_tenant_id() AND get_my_role() = 'owner'
  );

CREATE POLICY "up_owner_update" ON user_permissions
  FOR UPDATE
  USING  (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner')
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

CREATE POLICY "up_owner_delete" ON user_permissions
  FOR DELETE
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── Invitations d'équipe ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_by   UUID NOT NULL REFERENCES profiles(id),
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('admin', 'membre')),
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ti_tenant_iso" ON team_invites
  FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── Espaces par défaut pour les nouveaux tenants selon le secteur ─────────────
-- (peuplés à l'onboarding via la server action, pas ici)

-- Index pour les performances
CREATE INDEX IF NOT EXISTS user_permissions_profile_idx ON user_permissions (profile_id);
CREATE INDEX IF NOT EXISTS user_permissions_tenant_idx  ON user_permissions (tenant_id);
CREATE INDEX IF NOT EXISTS team_invites_token_idx       ON team_invites (token);
CREATE INDEX IF NOT EXISTS team_invites_email_idx       ON team_invites (email);
