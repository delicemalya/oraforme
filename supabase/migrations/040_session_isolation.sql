-- ============================================================
-- Migration 040 — Session Isolation & Multi-Tenant Final Hardening
-- Fixes: stale tenant data after account switching / cross-tab sessions
-- ============================================================

-- ── 1. Enforce tenant_id match on all profile reads ──────────────────────────
-- The existing RLS on `profiles` uses get_my_tenant_id().
-- We add a check to make sure that function is stable and cannot be spoofed.

-- Recreate get_my_tenant_id() with SECURITY DEFINER + stable search_path
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM   public.profiles
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

COMMENT ON FUNCTION get_my_tenant_id() IS
  'Returns the tenant_id for the currently authenticated user. '
  'SECURITY DEFINER + fixed search_path prevents search_path injection.';

-- ── 2. Ensure `profiles` RLS is ON (idempotent) ──────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially-broad existing SELECT policy and replace with tight version
DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"             ON public.profiles;

CREATE POLICY "profiles_select_own_tenant"
  ON public.profiles
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    OR user_id = auth.uid()   -- always allow reading own profile
  );

-- ── 3. Protect tenant_id from post-creation mutations ────────────────────────
-- (idempotent — migration 039 may have added this already)
CREATE OR REPLACE FUNCTION fn_prevent_tenant_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable after creation (table: %)', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to profiles (idempotent)
DROP TRIGGER IF EXISTS trg_immutable_tenant_id_profiles ON public.profiles;
CREATE TRIGGER trg_immutable_tenant_id_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_tenant_id_change();

-- Apply to tenants table itself (idempotent)
DROP TRIGGER IF EXISTS trg_immutable_tenant_id_tenants ON public.tenants;
CREATE TRIGGER trg_immutable_tenant_id_tenants
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_tenant_id_change();

-- ── 4. Ensure `tenants` RLS is ON and policy is tight ────────────────────────
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
CREATE POLICY "tenants_select_own"
  ON public.tenants
  FOR SELECT
  USING (id = get_my_tenant_id());

-- Only owner can update their tenant row
DROP POLICY IF EXISTS "tenants_update_owner" ON public.tenants;
CREATE POLICY "tenants_update_owner"
  ON public.tenants
  FOR UPDATE
  USING (
    id = get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND tenant_id = get_my_tenant_id()
        AND role = 'owner'
    )
  );

-- ── 5. Ensure `tenant_modules` RLS is tight ──────────────────────────────────
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_modules_select_own" ON public.tenant_modules;
CREATE POLICY "tenant_modules_select_own"
  ON public.tenant_modules
  FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- ── 6. Ensure `user_permissions` RLS is tight ────────────────────────────────
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions_select_own_tenant" ON public.user_permissions;
CREATE POLICY "user_permissions_select_own_tenant"
  ON public.user_permissions
  FOR SELECT
  USING (
    -- The profile being queried must belong to the current user's tenant
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_permissions.profile_id
        AND p.tenant_id = get_my_tenant_id()
    )
  );

-- ── 7. Verification query (run manually to confirm) ──────────────────────────
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM   pg_policies
-- WHERE  tablename IN ('profiles', 'tenants', 'tenant_modules', 'user_permissions')
-- ORDER  BY tablename, policyname;
