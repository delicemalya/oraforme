-- Migration 171 — ANO-C04 : fermeture des vecteurs d'escalade de privilège intra-tenant
--
-- Trois vecteurs distincts permettaient à un membre authentifié de s'octroyer
-- les droits d'un owner à l'intérieur de son propre tenant, sans passer par
-- l'interface, par simple appel PostgREST.
--
-- ── 1. profiles.role ─────────────────────────────────────────────────────────
-- 039_multi_tenant_hardening.sql:44-47 annonce en commentaire que l'utilisateur
-- « ne peut PAS changer son tenant_id ni son rôle ». Le WITH CHECK ne contraint
-- que user_id et tenant_id :
--
--   USING      (user_id = auth.uid() AND tenant_id = get_my_tenant_id())
--   WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id())
--
-- UPDATE profiles SET role = 'owner' WHERE user_id = auth.uid() satisfait le
-- prédicat. Le trigger fn_prevent_tenant_id_change (039:98) protège tenant_id,
-- rien ne protège role. Combiné à usePermissions.ts:67 (role = 'owner' → tous
-- les droits), l'impact est total.
--
-- Une policy RLS ne peut pas comparer NEW à OLD : WITH CHECK ne voit que la
-- ligne résultante. La protection doit donc être un trigger, sur le modèle de
-- fn_prevent_tenant_id_change qui existe déjà.
--
-- ── 2. user_permissions ──────────────────────────────────────────────────────
-- 022_rbac.sql réserve l'écriture à l'owner (up_owner_write/update/delete).
-- 067_rls_all_tenant_tables.sql:137-139, POSTÉRIEURE, ajoute :
--
--   CREATE POLICY "user_permissions: tenant" ON user_permissions
--     FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (...)
--
-- Les policies permissives se combinent en OR : cette policy annule la
-- restriction owner. N'importe quel membre peut s'insérer ses propres lignes
-- can_view/can_edit/can_delete/can_export/can_validate/can_approve sur tous
-- les modules de son tenant.
--
-- ── 3. roles ─────────────────────────────────────────────────────────────────
-- Même schéma : 053_rbac_enterprise.sql:361-372 réserve l'écriture à
-- owner + admin, 067:142-144 rouvre la table entière au tenant en FOR ALL.
--
-- Aucune donnée n'est modifiée. Seuls des prédicats d'accès sont resserrés,
-- sur le modèle déjà en vigueur dans 022, 039 et 053.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles : un utilisateur ne modifie pas son propre rôle
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() est NULL sous service_role : les chemins serveur légitimes
  -- (onboarding, administration) ne sont pas concernés.
  IF (SELECT auth.uid()) IS NOT NULL
     AND OLD.user_id = (SELECT auth.uid())
     AND (
       OLD.role            IS DISTINCT FROM NEW.role
       OR OLD.dynamic_role_id IS DISTINCT FROM NEW.dynamic_role_id
     )
  THEN
    RAISE EXCEPTION
      'Un utilisateur ne peut pas modifier son propre rôle (ancien: %, nouveau: %)',
      OLD.role, NEW.role
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_self_role_change ON public.profiles;
CREATE TRIGGER trg_no_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_self_role_escalation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_permissions : lecture par tenant, écriture réservée à l'owner
-- ─────────────────────────────────────────────────────────────────────────────
-- L'écran qui écrit cette table (app/dashboard/equipe/page.tsx) est déjà
-- réservé à l'owner côté interface (page.tsx:302).

DROP POLICY IF EXISTS "user_permissions: tenant" ON user_permissions;

DROP POLICY IF EXISTS "up_read" ON user_permissions;
CREATE POLICY "up_read" ON user_permissions
  FOR SELECT USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "up_owner_write" ON user_permissions;
CREATE POLICY "up_owner_write" ON user_permissions
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

DROP POLICY IF EXISTS "up_owner_update" ON user_permissions;
CREATE POLICY "up_owner_update" ON user_permissions
  FOR UPDATE USING      (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner')
             WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

DROP POLICY IF EXISTS "up_owner_delete" ON user_permissions;
CREATE POLICY "up_owner_delete" ON user_permissions
  FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. roles : lecture par tenant, écriture réservée à owner + admin
-- ─────────────────────────────────────────────────────────────────────────────
-- Rétablit l'intention de 053_rbac_enterprise.sql, alignée sur le garde de
-- app/dashboard/roles/page.tsx:188 (canManage = isOwner || role === 'admin').

DROP POLICY IF EXISTS "roles: tenant" ON roles;

DROP POLICY IF EXISTS "roles_read" ON roles;
CREATE POLICY "roles_read" ON roles
  FOR SELECT USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "roles_write" ON roles;
CREATE POLICY "roles_write" ON roles
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "roles_upd" ON roles;
CREATE POLICY "roles_upd" ON roles
  FOR UPDATE USING      (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'))
             WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "roles_del" ON roles;
CREATE POLICY "roles_del" ON roles
  FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. role_permissions : état de 053, rendu idempotent
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "role_permissions: tenant" ON role_permissions;

DROP POLICY IF EXISTS "rp_read" ON role_permissions;
CREATE POLICY "rp_read" ON role_permissions
  FOR SELECT USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "rp_write" ON role_permissions;
CREATE POLICY "rp_write" ON role_permissions
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "rp_upd" ON role_permissions;
CREATE POLICY "rp_upd" ON role_permissions
  FOR UPDATE USING      (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'))
             WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "rp_del" ON role_permissions;
CREATE POLICY "rp_del" ON role_permissions
  FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner', 'admin'));

DO $$
BEGIN
  RAISE NOTICE 'Migration 171 OK — ANO-C04 : self-role-change bloqué, écritures user_permissions/roles/role_permissions resserrées';
END $$;
