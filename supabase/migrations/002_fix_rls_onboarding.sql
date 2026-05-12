-- ============================================================
-- Fix RLS : autoriser la création de tenant + profil
-- lors de l'onboarding (utilisateur sans tenant_id encore)
-- ============================================================

-- TENANTS : supprimer les anciennes policies bloquantes
DROP POLICY IF EXISTS "tenants: voir son tenant" ON tenants;
DROP POLICY IF EXISTS "tenants: modifier son tenant" ON tenants;

-- Nouvelle policy INSERT : tout utilisateur connecté peut créer UN tenant
CREATE POLICY "tenants: insert"
  ON tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Nouvelle policy SELECT : voir uniquement son propre tenant
CREATE POLICY "tenants: select"
  ON tenants FOR SELECT
  USING (id IN (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Nouvelle policy UPDATE : modifier uniquement son propre tenant
CREATE POLICY "tenants: update"
  ON tenants FOR UPDATE
  USING (id IN (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
  ));

-- PROFILES : supprimer les anciennes policies
DROP POLICY IF EXISTS "profiles: voir les profils de son tenant" ON profiles;
DROP POLICY IF EXISTS "profiles: insérer son propre profil" ON profiles;
DROP POLICY IF EXISTS "profiles: modifier son profil" ON profiles;

-- Nouvelle policy INSERT : l'utilisateur peut créer son propre profil
CREATE POLICY "profiles: insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Nouvelle policy SELECT : voir les profils de son tenant
CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Nouvelle policy UPDATE : modifier son propre profil
CREATE POLICY "profiles: update"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());
