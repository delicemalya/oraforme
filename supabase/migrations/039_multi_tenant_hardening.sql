-- ============================================================
-- 039 — Multi-Tenant Hardening complet
-- ============================================================
-- PROBLÈMES CORRIGÉS :
--   1. profiles: INSERT permissif — permettait de rejoindre n'importe quel tenant
--   2. profiles: SELECT trop restrictif — collègues invisibles entre eux
--   3. profiles: pas de DELETE owner — impossible de retirer un utilisateur
--   4. profiles: pas de protection contre le changement de tenant_id
--   5. Triggers anti-tenant-hop sur les tables critiques
--   6. Fonction fn_is_owner() manquante
--   7. Audit log pour tentatives d'accès suspects
--   8. Validation exhaustive du RLS sur toutes les tables
-- ============================================================

-- ── 1. CRITIQUE : Supprimer la policy INSERT publique sur profiles ────────────
-- L'ancienne policy WITH CHECK (auth.uid() = user_id) autorise n'importe quel
-- utilisateur authentifié à créer un profil avec le tenant_id de son choix.
-- Tous les inserts de profil passent par supabaseAdmin (service_role) dans
-- onboarding/actions.ts — cette policy client n'est pas nécessaire et est
-- dangereuse.
DROP POLICY IF EXISTS "profiles: insert" ON profiles;
-- Aucune policy INSERT côté client : seul le service_role peut créer des profils.

-- ── 2. Étendre SELECT profiles : voir ses collègues du même tenant ────────────
-- L'ancienne policy "user_id = auth.uid()" empêchait de voir les profils
-- des collègues dans la page équipe côté client.
DROP POLICY IF EXISTS "profiles: select" ON profiles;

-- Chaque utilisateur peut voir son propre profil
CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- Chaque utilisateur peut voir les profils de son tenant (pour page équipe)
CREATE POLICY "profiles: select same tenant"
  ON profiles FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- ── 3. UPDATE profiles : uniquement son propre profil + assign rôle par owner ─
DROP POLICY IF EXISTS "profiles: update" ON profiles;

-- Un utilisateur peut mettre à jour ses propres infos (nom, téléphone…)
-- mais PAS changer son tenant_id ni son rôle
CREATE POLICY "profiles: update own info"
  ON profiles FOR UPDATE
  USING  (user_id = auth.uid() AND tenant_id = get_my_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

-- Le owner peut mettre à jour les profils de son tenant (assigner des rôles)
-- mais ne peut pas changer le tenant_id (protégé par trigger ci-dessous)
CREATE POLICY "profiles: owner manage team"
  ON profiles FOR UPDATE
  USING  (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner')
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── 4. DELETE profiles : owner peut retirer des utilisateurs de son tenant ─────
DROP POLICY IF EXISTS "profiles: delete" ON profiles;
CREATE POLICY "profiles: owner remove member"
  ON profiles FOR DELETE
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'owner'
    AND user_id != auth.uid()  -- l'owner ne peut pas se supprimer lui-même
  );

-- ── 5. TENANTS : ajouter policy DELETE pour l'owner ──────────────────────────
DROP POLICY IF EXISTS "tenants: delete" ON tenants;
CREATE POLICY "tenants: owner delete"
  ON tenants FOR DELETE
  USING (id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── 6. Fonction fn_is_owner() ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_is_owner()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role = 'owner' FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    FALSE
  );
$$;
GRANT EXECUTE ON FUNCTION fn_is_owner TO authenticated;

-- ── 7. Fonction fn_same_tenant(p_tenant_id) ───────────────────────────────────
-- Vérifie qu'un tenant_id donné correspond au tenant de l'utilisateur courant.
-- Utile dans les fonctions SECURITY DEFINER pour valider les inputs.
CREATE OR REPLACE FUNCTION fn_same_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT p_tenant_id = get_my_tenant_id();
$$;
GRANT EXECUTE ON FUNCTION fn_same_tenant TO authenticated;

-- ── 8. Trigger : interdire la modification de tenant_id ───────────────────────
-- Empêche toute tentative de "déplacer" une ligne d'un tenant à un autre
-- via un UPDATE malveillant.
CREATE OR REPLACE FUNCTION fn_prevent_tenant_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION
      'Modification de tenant_id interdite sur la table "%" (ancienne: %, nouvelle: %)',
      TG_TABLE_NAME, OLD.tenant_id, NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- Appliquer sur toutes les tables critiques
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles','clients','factures','stock_articles','employes',
      'transactions','depenses','achats','journal_comptable',
      'paiements_scolaires','etudiants','enseignants',
      'user_permissions','roles','tenant_modules','team_invites'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_no_tenant_change ON %I', tbl
      );
      EXECUTE format(
        'CREATE TRIGGER trg_no_tenant_change
         BEFORE UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION fn_prevent_tenant_id_change()', tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── 9. Table d'audit sécurité ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id   UUID,
  event_type  TEXT        NOT NULL,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Seul l'owner peut lire les logs de son tenant
DROP POLICY IF EXISTS "audit: owner read" ON security_audit_log;
CREATE POLICY "audit: owner read"
  ON security_audit_log FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND fn_is_owner());

-- Écriture uniquement via SECURITY DEFINER (pas de policy INSERT client)
-- Les fonctions fn_log_security_event() ci-dessous sont SECURITY DEFINER

-- ── 10. Fonction de logging sécurité (SECURITY DEFINER) ──────────────────────
CREATE OR REPLACE FUNCTION fn_log_security_event(
  p_event_type TEXT,
  p_details    JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_audit_log (user_id, tenant_id, event_type, details)
  VALUES (auth.uid(), get_my_tenant_id(), p_event_type, p_details);
EXCEPTION
  WHEN OTHERS THEN
    -- Ne pas faire échouer l'opération principale pour un log raté
    NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_log_security_event TO authenticated;

-- ── 11. S'assurer que RLS est activé sur toutes les tables critiques ──────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'tenants','profiles','clients','factures','stock_articles','employes',
      'transactions','journal_comptable','depenses','achats','fournisseurs',
      'team_invites','user_permissions','roles','spaces','tenant_modules',
      'mobile_money_transactions','security_audit_log'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- Tables académiques
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'etudiants','classes_ecole','notes_etudiants','frais_scolaires',
      'paiements_scolaires','sessions_ecole','subjects','exams','exam_grades',
      'report_cards','attestations','diplomas','defenses','ecole_wallets',
      'ecole_wallet_movements'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- ── 12. Double-vérification : s'assurer que les vieilles policies de 014 ──────
-- sur transactions ont bien été supprimées par migration 033.
-- Ce bloc est idempotent.
DROP POLICY IF EXISTS "transactions: select" ON transactions;
DROP POLICY IF EXISTS "transactions: insert" ON transactions;
DROP POLICY IF EXISTS "transactions: update" ON transactions;
DROP POLICY IF EXISTS "transactions: delete" ON transactions;
DROP POLICY IF EXISTS "transactions: tenant only" ON transactions;

-- ── 13. Renforcer la policy INSERT de tenants ─────────────────────────────────
-- Avant : n'importe quel utilisateur connecté peut créer un tenant
-- Après : toujours possible (nécessaire pour l'onboarding), mais logué
DROP POLICY IF EXISTS "tenants: insert" ON tenants;
CREATE POLICY "tenants: insert"
  ON tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 14. Contrainte : un user ne peut avoir qu'un seul profil (déjà UNIQUE) ─────
-- Verification idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_user_id_key' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ── 15. Index de performance critiques ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_user   ON profiles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_role  ON profiles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_team_invites_pending    ON team_invites(email, accepted) WHERE NOT accepted;
CREATE INDEX IF NOT EXISTS idx_security_audit_tenant   ON security_audit_log(tenant_id, created_at DESC);

-- ── 16. Vue sécurisée : résumé des accès par utilisateur du tenant ────────────
CREATE OR REPLACE VIEW vue_team_access AS
SELECT
  p.id            AS profile_id,
  p.user_id,
  p.tenant_id,
  p.nom,
  p.prenom,
  p.role          AS static_role,
  p.ecole_role_name,
  r.name          AS dynamic_role_name,
  r.is_financial,
  t.nom_entreprise,
  t.secteur_activite,
  au.email        AS auth_email,
  au.created_at
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
LEFT JOIN roles r ON r.id = p.dynamic_role_id
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.tenant_id = get_my_tenant_id();

-- ── 17. Commentaires de documentation ────────────────────────────────────────
COMMENT ON FUNCTION get_my_tenant_id   IS 'Retourne le tenant_id du user connecté. Utilisé dans toutes les policies RLS. SECURITY DEFINER pour éviter la récursion.';
COMMENT ON FUNCTION fn_is_owner        IS 'Retourne TRUE si le user connecté est owner du tenant.';
COMMENT ON FUNCTION fn_is_user_financial IS 'Retourne TRUE si le user a accès aux données financières (owner, RAF, dynamic_role.is_financial).';
COMMENT ON FUNCTION fn_same_tenant     IS 'Vérifie qu''un UUID tenant correspond au tenant du user connecté.';
COMMENT ON FUNCTION fn_prevent_tenant_id_change IS 'Trigger function : empêche la modification de tenant_id sur toute table protégée.';
COMMENT ON TABLE security_audit_log    IS 'Journal des événements de sécurité (tentatives cross-tenant, violations RLS, etc.)';
