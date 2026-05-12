-- ============================================================
-- Fix : infinite recursion in RLS policies
-- Cause : profiles policy référençait profiles (self-join)
--         tenants policy référençait profiles avec RLS actif
-- Solution : fonction SECURITY DEFINER qui bypass le RLS
-- ============================================================

-- Fonction qui récupère le tenant_id sans déclencher le RLS
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- TENANTS : recréer les policies sans récursion
-- ============================================================
DROP POLICY IF EXISTS "tenants: insert" ON tenants;
DROP POLICY IF EXISTS "tenants: select" ON tenants;
DROP POLICY IF EXISTS "tenants: update" ON tenants;

CREATE POLICY "tenants: insert"
  ON tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tenants: select"
  ON tenants FOR SELECT
  USING (id = get_my_tenant_id());

CREATE POLICY "tenants: update"
  ON tenants FOR UPDATE
  USING (id = get_my_tenant_id());

-- ============================================================
-- PROFILES : recréer sans self-join (cause de la récursion)
-- ============================================================
DROP POLICY IF EXISTS "profiles: insert" ON profiles;
DROP POLICY IF EXISTS "profiles: select" ON profiles;
DROP POLICY IF EXISTS "profiles: update" ON profiles;

-- INSERT : un utilisateur connecté peut créer son propre profil
CREATE POLICY "profiles: insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- SELECT : on voit uniquement ses propres lignes (pas de self-join)
CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- UPDATE : modifier uniquement son propre profil
CREATE POLICY "profiles: update"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());
