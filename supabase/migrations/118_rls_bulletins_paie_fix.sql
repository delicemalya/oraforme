-- Migration 118: Fix complet RLS bulletins_paie + acomptes_salaires + prime_risque
--
-- DIAGNOSTIC RACINE :
-- profiles.id = UUID auto-généré (PAS auth.uid())
-- profiles.user_id = auth UUID (clé étrangère vers auth.users)
-- Migrations 037–116 utilisaient "WHERE id = auth.uid()" → retournait toujours NULL
-- get_my_tenant_id() n'avait pas de ORDER BY → non-déterministe pour utilisateurs multi-tenant
--
-- Ce fichier corrige :
-- 1. Recrée get_my_tenant_id() avec ORDER BY ASC LIMIT 1
-- 2. Supprime les vieilles policies bulletins_paie (007 + 077) et recrée une bonne
-- 3. Supprime la vieille policy acomptes_salaires (077) et recrée une bonne
-- 4. Ajoute prime_risque à bulletins_paie (colonne manquante)

-- ── 1. Corriger get_my_tenant_id() ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id
  FROM profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- ── 2. bulletins_paie : supprimer TOUTES les vieilles policies ───────────────
DROP POLICY IF EXISTS "tenant_paie"               ON bulletins_paie;
DROP POLICY IF EXISTS "insert_paie"               ON bulletins_paie;
DROP POLICY IF EXISTS "update_paie"               ON bulletins_paie;
DROP POLICY IF EXISTS "delete_paie"               ON bulletins_paie;
DROP POLICY IF EXISTS "bulletins_tenant_isolation" ON bulletins_paie;

-- Recréer UNE seule policy propre (user_id = auth.uid(), IN pour multi-tenant)
CREATE POLICY "bulletins_tenant_isolation" ON bulletins_paie
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ── 3. acomptes_salaires : même correction ────────────────────────────────────
DROP POLICY IF EXISTS "acomptes_tenant_isolation" ON acomptes_salaires;

CREATE POLICY "acomptes_tenant_isolation" ON acomptes_salaires
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ── 4. Ajouter prime_risque à bulletins_paie (colonne absente) ───────────────
ALTER TABLE bulletins_paie
  ADD COLUMN IF NOT EXISTS prime_risque NUMERIC(12,0) DEFAULT 0;

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
