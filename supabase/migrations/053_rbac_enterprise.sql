-- ============================================================
-- Migration 053 — RBAC Enterprise Grade
-- Fixes critiques + permissions granulaires + rôles par défaut
-- ============================================================

-- ── 1. FIX CRITIQUE : get_my_tenant_id() avec ORDER BY ───────────────────────
-- BUG: sans ORDER BY, PostgreSQL choisit n'importe quelle ligne pour un
-- utilisateur multi-tenant (super-admin membre de plusieurs entreprises).
-- Résultat: ECAM CONGO peut voir les données de BADIBA et vice-versa.
-- FIX: ORDER BY created_at ASC → le profil primaire (le plus ancien) gagne toujours.

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM   profiles
  WHERE  user_id = auth.uid()
  ORDER  BY created_at ASC
  LIMIT  1;
$$;

COMMENT ON FUNCTION get_my_tenant_id IS
  'Retourne le tenant_id primaire du user connecté (ORDER BY created_at ASC = profil le plus ancien).
   FIX v2 (053): ajout ORDER BY pour isoler correctement les super-admins multi-tenant.
   SECURITY DEFINER pour éviter la récursion RLS.';

-- ── 2. FIX CRITIQUE : get_my_role() scopé au tenant courant ──────────────────
-- BUG: sans scoping tenant, un admin d'une entreprise pouvait avoir le rôle
-- "owner" d'une autre entreprise retourné, cassant toutes les policies RLS.

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   profiles
  WHERE  user_id  = auth.uid()
    AND  tenant_id = get_my_tenant_id()
  LIMIT  1;
$$;

COMMENT ON FUNCTION get_my_role IS
  'Retourne le rôle de l''utilisateur scopé à son tenant courant.
   FIX v2 (053): scoping tenant_id = get_my_tenant_id() pour isolation correcte.';

-- ── 3. FIX : get_my_profile_id() scopé au tenant courant ─────────────────────

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM   profiles
  WHERE  user_id  = auth.uid()
    AND  tenant_id = get_my_tenant_id()
  LIMIT  1;
$$;

-- ── 4. Fonction owner check (utilisée dans policies) ─────────────────────────

CREATE OR REPLACE FUNCTION fn_is_owner()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_my_role() = 'owner';
$$;

-- ── 5. Colonnes granulaires sur role_permissions ──────────────────────────────

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS can_export   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_validate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve  BOOLEAN NOT NULL DEFAULT false;

-- ── 6. Colonnes granulaires sur user_permissions ─────────────────────────────

ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS can_export   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_validate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve  BOOLEAN NOT NULL DEFAULT false;

-- ── 7. Contrainte UNIQUE sur role_permissions si absente ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_module_unique'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_role_module_unique UNIQUE (role_id, module_key);
  END IF;
END $$;

-- ── 8. Table rbac_audit_log — trace toutes modifications de rôles/permissions ──

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    UUID,           -- profile_id de l'auteur
  action      TEXT NOT NULL,  -- 'role_created', 'role_deleted', 'perm_updated', 'role_assigned', ...
  target_type TEXT,           -- 'role', 'permission', 'user_role'
  target_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rbac_audit_tenant_idx ON rbac_audit_log(tenant_id, created_at DESC);

ALTER TABLE rbac_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY rbac_audit_read ON rbac_audit_log
  FOR SELECT USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY rbac_audit_insert ON rbac_audit_log
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 9. Trigger : log automatique des changements de role_permissions ───────────

CREATE OR REPLACE FUNCTION fn_audit_role_perm_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO rbac_audit_log (tenant_id, actor_id, action, target_type, target_id, details)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    get_my_profile_id(),
    CASE TG_OP WHEN 'INSERT' THEN 'perm_created' WHEN 'UPDATE' THEN 'perm_updated' ELSE 'perm_deleted' END,
    'permission',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'module_key', COALESCE(NEW.module_key, OLD.module_key),
      'role_id',    COALESCE(NEW.role_id, OLD.role_id),
      'op',         TG_OP
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_perm ON role_permissions;
CREATE TRIGGER trg_audit_role_perm
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_role_perm_change();

-- ── 10. Trigger : log assignation de rôle à un utilisateur ───────────────────

CREATE OR REPLACE FUNCTION fn_audit_dynamic_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.dynamic_role_id IS DISTINCT FROM NEW.dynamic_role_id THEN
    INSERT INTO rbac_audit_log (tenant_id, actor_id, action, target_type, target_id, details)
    VALUES (
      NEW.tenant_id,
      get_my_profile_id(),
      'role_assigned',
      'user_role',
      NEW.id,
      jsonb_build_object(
        'profile_id',   NEW.id,
        'old_role_id',  OLD.dynamic_role_id,
        'new_role_id',  NEW.dynamic_role_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_role ON profiles;
CREATE TRIGGER trg_audit_profile_role
  AFTER UPDATE OF dynamic_role_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_dynamic_role_change();

-- ── 11. Fonction : créer les rôles par défaut pour un tenant ─────────────────

CREATE OR REPLACE FUNCTION fn_create_default_roles(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- ── DG — Direction Générale ───────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Direction Générale', 'Accès complet à tous les modules stratégiques', '#2563EB', true)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'direction',     true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'finance',        true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'analytics',      true,  false, false, true,  false, false),
      (v_role_id, p_tenant_id, 'audit',          true,  false, false, true,  false, false),
      (v_role_id, p_tenant_id, 'comptabilite',   true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'tresorerie',     true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'facturation',    true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'depenses',       true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'rh',             true,  true,  false, true,  true,  false),
      (v_role_id, p_tenant_id, 'crm',            true,  true,  false, true,  false, false),
      (v_role_id, p_tenant_id, 'stock',          true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'achats',         true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'notifications',  true,  true,  false, false, false, false),
      (v_role_id, p_tenant_id, 'ged',            true,  true,  false, true,  false, false),
      (v_role_id, p_tenant_id, 'bizbot',         true,  true,  false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Finance Manager ───────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Finance Manager', 'Responsable finance et comptabilité', '#16A34A', true)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'finance',      true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'comptabilite', true,  true,  false, true,  true,  true),
      (v_role_id, p_tenant_id, 'tresorerie',   true,  true,  false, true,  true,  false),
      (v_role_id, p_tenant_id, 'facturation',  true,  true,  false, true,  true,  false),
      (v_role_id, p_tenant_id, 'depenses',     true,  true,  false, true,  true,  false),
      (v_role_id, p_tenant_id, 'analytics',    true,  false, false, true,  false, false),
      (v_role_id, p_tenant_id, 'direction',    true,  false, false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Comptable ─────────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Comptable', 'Saisie comptable et journaux OHADA', '#0891B2', true)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'comptabilite', true, true,  false, true,  false, false),
      (v_role_id, p_tenant_id, 'facturation',  true, true,  false, true,  false, false),
      (v_role_id, p_tenant_id, 'depenses',     true, true,  false, false, false, false),
      (v_role_id, p_tenant_id, 'tresorerie',   true, false, false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Caissier ──────────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Caissier', 'Gestion de caisse et encaissements', '#F59E0B', true)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'tresorerie',  true, true,  false, false, false, false),
      (v_role_id, p_tenant_id, 'facturation', true, false, false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── RH Manager ───────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'RH Manager', 'Gestion du personnel et de la paie', '#7C3AED', false)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'rh',        true, true, true,  true,  true,  false),
      (v_role_id, p_tenant_id, 'depenses',   true, true, false, false, false, false),
      (v_role_id, p_tenant_id, 'direction',  true, false,false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Responsable Stock ─────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Responsable Stock', 'Gestion des stocks et inventaires', '#DC2626', false)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'stock',  true, true, true,  true,  true,  false),
      (v_role_id, p_tenant_id, 'achats', true, true, false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Acheteur ──────────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Acheteur', 'Gestion des achats et fournisseurs', '#EA580C', false)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'achats', true, true,  false, true,  false, false),
      (v_role_id, p_tenant_id, 'stock',  true, false, false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Commercial ────────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Commercial', 'Gestion clients et facturation', '#059669', false)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'crm',        true, true,  true,  true,  false, false),
      (v_role_id, p_tenant_id, 'facturation', true, true,  false, true,  false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

  -- ── Support ───────────────────────────────────────────────────────────────
  INSERT INTO roles (tenant_id, name, description, color, is_financial)
    VALUES (p_tenant_id, 'Support', 'Support utilisateurs et documentation', '#64748B', false)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING id INTO v_role_id;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, tenant_id, module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve)
    VALUES
      (v_role_id, p_tenant_id, 'ged',           true, true,  false, false, false, false),
      (v_role_id, p_tenant_id, 'notifications',  true, true,  false, false, false, false)
    ON CONFLICT (role_id, module_key) DO NOTHING;
  END IF;

END;
$$;

-- ── 12. Vue résumé des rôles et leurs membres ─────────────────────────────────

CREATE OR REPLACE VIEW v_roles_summary AS
SELECT
  r.id,
  r.tenant_id,
  r.name,
  r.description,
  r.color,
  r.is_financial,
  r.created_at,
  COUNT(DISTINCT p.id) AS nb_membres,
  COUNT(DISTINCT rp.module_key) AS nb_permissions
FROM roles r
LEFT JOIN profiles p ON p.dynamic_role_id = r.id AND p.tenant_id = r.tenant_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY r.id, r.tenant_id, r.name, r.description, r.color, r.is_financial, r.created_at;

-- ── 13. Index supplémentaires pour performance ────────────────────────────────

CREATE INDEX IF NOT EXISTS rp_tenant_module_idx  ON role_permissions (tenant_id, module_key);
CREATE INDEX IF NOT EXISTS up_tenant_profile_idx ON user_permissions (tenant_id, profile_id);
CREATE INDEX IF NOT EXISTS profiles_tenant_role_idx ON profiles (tenant_id, dynamic_role_id);

-- ── 14. Policy update : roles — admin peut aussi créer des rôles ───────────────

DROP POLICY IF EXISTS "roles_write" ON roles;
CREATE POLICY "roles_write" ON roles FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "roles_upd" ON roles;
CREATE POLICY "roles_upd" ON roles FOR UPDATE
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "roles_del" ON roles;
CREATE POLICY "roles_del" ON roles FOR DELETE
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "rp_write" ON role_permissions;
CREATE POLICY "rp_write" ON role_permissions FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "rp_upd" ON role_permissions;
CREATE POLICY "rp_upd" ON role_permissions FOR UPDATE
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "rp_del" ON role_permissions;
CREATE POLICY "rp_del" ON role_permissions FOR DELETE
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

-- ── COMMENTAIRES ──────────────────────────────────────────────────────────────

COMMENT ON TABLE rbac_audit_log IS 'Journal de toutes les modifications RBAC (rôles, permissions, assignations)';
COMMENT ON FUNCTION fn_create_default_roles IS 'Crée les rôles par défaut pour un nouveau tenant. Appeler depuis onboarding.';
COMMENT ON VIEW v_roles_summary IS 'Vue résumé: rôles + nombre de membres + nombre de permissions';
