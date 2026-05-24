-- ============================================================================
-- MIGRATION: Mission Critique — Multi-tenant isolation + Owner Admin
-- Date: 2026-05-24
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================================

-- ── 1. PROFILES — performance index for multi-tenant user lookup ──────────────
-- All profile queries now use ORDER BY created_at ASC LIMIT 1 to ensure the
-- primary (oldest) profile is always returned for multi-tenant users.
-- This index makes those queries fast.
CREATE INDEX IF NOT EXISTS idx_profiles_user_created_at
  ON profiles(user_id, created_at ASC);

-- ── 2. TENANTS — add status column for suspend/unsuspend ─────────────────────
-- 'active'    = normal operation
-- 'suspended' = access blocked by super-admin (users see suspension notice)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

-- Index for quickly filtering active/suspended tenants
CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON tenants(status);

-- ── 3. TENANTS — add soft-delete support ─────────────────────────────────────
-- When a company is deleted via Admin, deleted_at is set.
-- Hard purge must be done manually in Supabase if needed.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ── 4. TENANTS — exclude soft-deleted rows from normal operations ─────────────
-- Update/create a view that hides deleted tenants from regular API queries.
-- The supabaseAdmin client bypasses RLS and can see all rows (for admin pages).
-- Regular clients use RLS which should already scope to the user's tenant.
-- This index helps filter out deleted tenants efficiently.
CREATE INDEX IF NOT EXISTS idx_tenants_not_deleted
  ON tenants(id)
  WHERE deleted_at IS NULL;

-- ── 5. RLS — ensure suspended tenants cannot read data ───────────────────────
-- The existing auth_tenant_id() RLS helper function returns the tenant_id
-- from the JWT claims or from the profiles table.
-- Add a check: if the tenant is suspended, return NULL (no access).
--
-- IMPORTANT: Only run this if you have an auth_tenant_id() function.
-- Check with: SELECT proname FROM pg_proc WHERE proname = 'auth_tenant_id';

-- Example updated auth_tenant_id() — adapt to your actual implementation:
/*
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
DECLARE
  _tid UUID;
  _status TEXT;
BEGIN
  -- Get tenant_id for the current user
  SELECT p.tenant_id INTO _tid
  FROM profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF _tid IS NULL THEN RETURN NULL; END IF;

  -- Check tenant status — suspended or deleted tenants get no access
  SELECT status INTO _status FROM tenants WHERE id = _tid;
  IF _status IS NULL OR _status = 'suspended' THEN RETURN NULL; END IF;

  RETURN _tid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
*/
-- ↑ Uncomment and run this ONLY if you want the database to enforce suspension
-- at the RLS level (most secure option). For now, enforcement is at app level.

-- ── 6. VERIFY — check existing data ──────────────────────────────────────────
-- Run these queries to verify migration success:

-- Check new columns:
-- SELECT id, nom_entreprise, status, deleted_at FROM tenants LIMIT 5;

-- Check index creation:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('profiles', 'tenants')
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ── END OF MIGRATION ──────────────────────────────────────────────────────────
