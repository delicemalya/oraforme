-- Migration 118: Fix RLS policy on bulletins_paie
-- Root cause: FOR ALL with only USING clause — PostgreSQL applies USING as WITH CHECK
-- for INSERT, but when user has multiple profiles (multi-tenant), the ORDER BY ASC LIMIT 1
-- returns the OLDEST profile's tenant_id which may differ from the active tenant.
-- Fix: use IN subquery so ANY matching profile grants access.

-- Step 1: Drop the broken policy
DROP POLICY IF EXISTS "bulletins_tenant_isolation" ON bulletins_paie;

-- Step 2: Recreate with explicit WITH CHECK using IN (multi-profile safe)
CREATE POLICY "bulletins_tenant_isolation" ON bulletins_paie
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Step 3: Also fix acomptes_salaires if it has the same pattern
DROP POLICY IF EXISTS "acomptes_tenant_isolation" ON acomptes_salaires;
CREATE POLICY "acomptes_tenant_isolation" ON acomptes_salaires
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
