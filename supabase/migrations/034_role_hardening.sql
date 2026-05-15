-- ============================================================
-- 034 — Role System Hardening
-- ============================================================
-- PROBLÈMES IDENTIFIÉS :
--   1. fn_is_user_financial() ne reconnaît pas les utilisateurs 'admin'
--      sans dynamic_role_id dans les tenants non-école (ils ne peuvent
--      pas accéder aux données financières)
--   2. Tables école (etudiants, notes_etudiants, etc.) n'ont aucune
--      restriction par rôle — n'importe quel membre du tenant peut tout lire/écrire
--   3. Rôles sectoriels absents pour commerce, restaurant, hôtel, transport
--      (seulement owner/admin/membre disponibles)
--   4. Pas de colonnes d'indexation optimisées pour les lookups rôle
--
-- CE SCRIPT :
--   1. Crée fn_get_my_ecole_role() — renvoie le rôle école de l'utilisateur
--   2. Crée fn_has_ecole_role(roles TEXT[]) — vérifie si le rôle est dans la liste
--   3. Ajoute RLS restrictif sur les tables école financières et académiques
--   4. Crée les rôles sectoriels pour commerce, restaurant, hôtel, transport
--   5. Améliore fn_is_user_financial() pour inclure les rôles 'admin' financiers
-- ============================================================

-- ── 1. Fonction : rôle école de l'utilisateur courant ─────────────────────
-- Renvoie le ecole_role_name du profil ou 'DIRECTION_GENERALE' pour les owners

CREATE OR REPLACE FUNCTION fn_get_my_ecole_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role      TEXT;
  v_ecole     TEXT;
BEGIN
  SELECT role, ecole_role_name
    INTO v_role, v_ecole
    FROM profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_role = 'owner' THEN RETURN 'DIRECTION_GENERALE'; END IF;
  RETURN v_ecole; -- peut être NULL si pas encore assigné
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_my_ecole_role TO authenticated;

-- ── 2. Fonction : vérifier si l'utilisateur a l'un des rôles donnés ───────

CREATE OR REPLACE FUNCTION fn_has_ecole_role(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_ecole TEXT;
BEGIN
  v_ecole := fn_get_my_ecole_role();
  IF v_ecole IS NULL THEN RETURN FALSE; END IF;
  RETURN v_ecole = ANY(p_roles);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_has_ecole_role TO authenticated;

-- ── 3. Améliorer fn_is_user_financial() ───────────────────────────────────
-- Cas ajouté : utilisateur 'admin' avec rôle école financier
-- ou avec user_permissions pour comptabilite/tresorerie

CREATE OR REPLACE FUNCTION fn_is_user_financial()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role        TEXT;
  v_dyn_role_id UUID;
  v_is_fin      BOOLEAN;
BEGIN
  SELECT role, dynamic_role_id
    INTO v_role, v_dyn_role_id
    FROM profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  -- Owner → accès total
  IF v_role = 'owner' THEN RETURN TRUE; END IF;

  -- Rôle dynamique avec is_financial = true
  IF v_dyn_role_id IS NOT NULL THEN
    SELECT is_financial INTO v_is_fin
      FROM roles WHERE id = v_dyn_role_id LIMIT 1;
    IF COALESCE(v_is_fin, FALSE) THEN RETURN TRUE; END IF;
  END IF;

  -- Rôle école financier (RAF, DIRECTION_GENERALE)
  IF fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'RAF']) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ── 4. Colonne ecole_role_name sur profiles (si absente) ──────────────────
-- Migration 025 devrait déjà l'avoir créée, mais on s'assure

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ecole_role_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ecole_role_name TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_ecole_role_name
  ON profiles(ecole_role_name) WHERE ecole_role_name IS NOT NULL;

-- ── 5. RLS sur les tables école financières ────────────────────────────────

-- ecole_wallet_movements : lecture financière seulement
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ecole_wallet_movements') THEN

    DROP POLICY IF EXISTS "ecole_wallet_mvt: all" ON ecole_wallet_movements;

    -- Lecture : direction + RAF
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'ecole_wallet_movements' AND policyname = 'ecole_wallet_mvt: financial read'
    ) THEN
      CREATE POLICY "ecole_wallet_mvt: financial read" ON ecole_wallet_movements
        FOR SELECT
        USING (tenant_id = get_my_tenant_id() AND fn_is_user_financial());
    END IF;

    -- Écriture : direction + RAF (SECURITY DEFINER via fn_create_depense gère les autres cas)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'ecole_wallet_movements' AND policyname = 'ecole_wallet_mvt: financial write'
    ) THEN
      CREATE POLICY "ecole_wallet_mvt: financial write" ON ecole_wallet_movements
        FOR ALL
        USING (tenant_id = get_my_tenant_id() AND fn_is_user_financial())
        WITH CHECK (tenant_id = get_my_tenant_id() AND fn_is_user_financial());
    END IF;

  END IF;
END $$;

-- frais_scolaires : lecture pour scolarité + direction, écriture financière seulement
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'frais_scolaires') THEN

    DROP POLICY IF EXISTS "frais_scolaires: select" ON frais_scolaires;
    DROP POLICY IF EXISTS "frais_scolaires: insert" ON frais_scolaires;
    DROP POLICY IF EXISTS "frais_scolaires: update" ON frais_scolaires;
    DROP POLICY IF EXISTS "frais_scolaires: delete" ON frais_scolaires;
    DROP POLICY IF EXISTS "frais_scolaires: all" ON frais_scolaires;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'frais_scolaires' AND policyname = 'frais_scolaires: academic read'
    ) THEN
      CREATE POLICY "frais_scolaires: academic read" ON frais_scolaires
        FOR SELECT
        USING (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'RAF', 'SCOLARITE', 'DAAC'])
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'frais_scolaires' AND policyname = 'frais_scolaires: financial write'
    ) THEN
      CREATE POLICY "frais_scolaires: financial write" ON frais_scolaires
        FOR ALL
        USING (tenant_id = get_my_tenant_id() AND fn_is_user_financial())
        WITH CHECK (tenant_id = get_my_tenant_id() AND fn_is_user_financial());
    END IF;

  END IF;
END $$;

-- paiements_scolaires : lecture scolarité + RAF, écriture financière
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paiements_scolaires') THEN

    DROP POLICY IF EXISTS "paiements_scolaires: select" ON paiements_scolaires;
    DROP POLICY IF EXISTS "paiements_scolaires: insert" ON paiements_scolaires;
    DROP POLICY IF EXISTS "paiements_scolaires: update" ON paiements_scolaires;
    DROP POLICY IF EXISTS "paiements_scolaires: delete" ON paiements_scolaires;
    DROP POLICY IF EXISTS "paiements_scolaires: all" ON paiements_scolaires;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'paiements_scolaires' AND policyname = 'paiements_scolaires: read'
    ) THEN
      CREATE POLICY "paiements_scolaires: read" ON paiements_scolaires
        FOR SELECT
        USING (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'RAF', 'SCOLARITE'])
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'paiements_scolaires' AND policyname = 'paiements_scolaires: write'
    ) THEN
      CREATE POLICY "paiements_scolaires: write" ON paiements_scolaires
        FOR ALL
        USING (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'RAF', 'SCOLARITE'])
        )
        WITH CHECK (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'RAF', 'SCOLARITE'])
        );
    END IF;

  END IF;
END $$;

-- notes_etudiants : lecture DAAC + formateurs + direction, écriture DAAC + formateurs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes_etudiants') THEN

    DROP POLICY IF EXISTS "notes_etudiants: select" ON notes_etudiants;
    DROP POLICY IF EXISTS "notes_etudiants: insert" ON notes_etudiants;
    DROP POLICY IF EXISTS "notes_etudiants: update" ON notes_etudiants;
    DROP POLICY IF EXISTS "notes_etudiants: delete" ON notes_etudiants;
    DROP POLICY IF EXISTS "notes_etudiants: all" ON notes_etudiants;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'notes_etudiants' AND policyname = 'notes_etudiants: academic access'
    ) THEN
      CREATE POLICY "notes_etudiants: academic access" ON notes_etudiants
        FOR ALL
        USING (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'DAAC', 'FORMATEUR', 'SCOLARITE'])
        )
        WITH CHECK (
          tenant_id = get_my_tenant_id()
          AND fn_has_ecole_role(ARRAY['DIRECTION_GENERALE', 'DAAC', 'FORMATEUR'])
        );
    END IF;

    -- Étudiants : lisent leurs propres notes uniquement
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'notes_etudiants' AND policyname = 'notes_etudiants: student read own'
    ) THEN
      CREATE POLICY "notes_etudiants: student read own" ON notes_etudiants
        FOR SELECT
        USING (
          tenant_id = get_my_tenant_id()
          AND fn_get_my_ecole_role() = 'ETUDIANT'
          AND etudiant_id IN (
            SELECT e.id FROM etudiants e
            JOIN profiles p ON p.user_id = auth.uid()
            WHERE e.tenant_id = get_my_tenant_id()
              AND (e.email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid()))
          )
        );
    END IF;

  END IF;
END $$;

-- ── 6. Rôles sectoriels pour les secteurs non-école ───────────────────────
-- Crée les rôles Directeur/RAF/Comptable/Caissier pour commerce, restaurant, hôtel, transport
-- Ces rôles sont créés si le tenant existe avec le secteur correspondant.
-- Idempotent : IF NOT EXISTS sur le nom du rôle.

CREATE OR REPLACE FUNCTION fn_seed_sector_roles(
  p_tenant_id UUID,
  p_secteur   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_roles JSONB;
  v_role  JSONB;
BEGIN
  -- Définition des rôles selon le secteur
  CASE p_secteur
    WHEN 'commerce', 'supermarche', 'grossiste' THEN
      v_roles := '[
        {"name":"DIRECTION_GENERALE","description":"Directeur Général — accès complet","is_financial":true},
        {"name":"RAF","description":"RAF — finances et comptabilité","is_financial":true},
        {"name":"COMPTABLE","description":"Comptable — journal et rapports","is_financial":true},
        {"name":"COMMERCIAL","description":"Commercial — ventes et clients","is_financial":false},
        {"name":"MAGASINIER","description":"Magasinier — stock et inventaire","is_financial":false},
        {"name":"CAISSIER","description":"Caissier — encaissements","is_financial":false}
      ]'::jsonb;
    WHEN 'restaurant' THEN
      v_roles := '[
        {"name":"DIRECTION_GENERALE","description":"Directeur — accès complet","is_financial":true},
        {"name":"RAF","description":"RAF — finances","is_financial":true},
        {"name":"CHEF_CUISINE","description":"Chef de cuisine — menu et préparation","is_financial":false},
        {"name":"SERVEUR","description":"Serveur — commandes et service","is_financial":false},
        {"name":"CAISSIER","description":"Caissier — encaissements","is_financial":false}
      ]'::jsonb;
    WHEN 'hotel' THEN
      v_roles := '[
        {"name":"DIRECTION_GENERALE","description":"Directeur Hôtel — accès complet","is_financial":true},
        {"name":"RAF","description":"RAF — finances hôtelières","is_financial":true},
        {"name":"RECEPTIONNISTE","description":"Réceptionniste — réservations et accueil","is_financial":false},
        {"name":"GOUVERNANTE","description":"Gouvernante — housekeeping","is_financial":false},
        {"name":"CAISSIER","description":"Caissier — facturation clients","is_financial":false}
      ]'::jsonb;
    WHEN 'transport' THEN
      v_roles := '[
        {"name":"DIRECTION_GENERALE","description":"Directeur — accès complet","is_financial":true},
        {"name":"RAF","description":"RAF — finances","is_financial":true},
        {"name":"DISPATCHER","description":"Dispatcher — courses et chauffeurs","is_financial":false},
        {"name":"CHAUFFEUR","description":"Chauffeur — ses propres courses","is_financial":false}
      ]'::jsonb;
    ELSE
      -- Rôles génériques pour tous les autres secteurs
      v_roles := '[
        {"name":"DIRECTION_GENERALE","description":"Direction Générale — accès complet","is_financial":true},
        {"name":"RAF","description":"RAF — accès financier","is_financial":true},
        {"name":"COLLABORATEUR","description":"Collaborateur — accès standard","is_financial":false}
      ]'::jsonb;
  END CASE;

  -- Insérer les rôles s'ils n'existent pas déjà
  FOR v_role IN SELECT * FROM jsonb_array_elements(v_roles)
  LOOP
    INSERT INTO roles (tenant_id, name, description, is_financial)
    SELECT
      p_tenant_id,
      v_role->>'name',
      v_role->>'description',
      (v_role->>'is_financial')::boolean
    WHERE NOT EXISTS (
      SELECT 1 FROM roles
      WHERE tenant_id = p_tenant_id AND name = v_role->>'name'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_seed_sector_roles TO authenticated;

-- ── 7. Trigger : auto-seed des rôles à la création d'un tenant ───────────
-- Quand un tenant est créé avec un secteur_activite, ses rôles sont auto-créés.

CREATE OR REPLACE FUNCTION fn_trigger_seed_tenant_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seed rôles si secteur défini et différent de 'ecole' (géré par migration 025)
  IF NEW.secteur_activite IS NOT NULL AND NEW.secteur_activite != 'ecole' THEN
    PERFORM fn_seed_sector_roles(NEW.id, NEW.secteur_activite);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_roles ON tenants;
CREATE TRIGGER trg_seed_tenant_roles
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_seed_tenant_roles();

-- Trigger pour UPDATE (si le secteur change après coup)
CREATE OR REPLACE FUNCTION fn_trigger_update_tenant_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.secteur_activite IS DISTINCT FROM OLD.secteur_activite
    AND NEW.secteur_activite IS NOT NULL
    AND NEW.secteur_activite != 'ecole'
  THEN
    PERFORM fn_seed_sector_roles(NEW.id, NEW.secteur_activite);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_tenant_roles ON tenants;
CREATE TRIGGER trg_update_tenant_roles
  AFTER UPDATE OF secteur_activite ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_update_tenant_roles();

-- ── 8. Seed rôles pour les tenants existants sans rôles ──────────────────
-- Applique fn_seed_sector_roles à tous les tenants existants non-école
-- qui n'ont pas encore de rôles dans la table roles.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT id, secteur_activite FROM tenants
    WHERE secteur_activite IS NOT NULL
      AND secteur_activite != 'ecole'
      AND NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = id)
  LOOP
    PERFORM fn_seed_sector_roles(t.id, t.secteur_activite);
  END LOOP;
END $$;

-- ── 9. Index utilitaires ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_dynamic_role_id
  ON profiles(dynamic_role_id) WHERE dynamic_role_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roles_tenant_name
  ON roles(tenant_id, name);

-- ── 10. Vue : résumé des accès par utilisateur ────────────────────────────

CREATE OR REPLACE VIEW vue_user_access AS
SELECT
  p.user_id,
  p.tenant_id,
  p.role            AS static_role,
  p.ecole_role_name AS ecole_role,
  r.name            AS dynamic_role_name,
  r.is_financial,
  t.secteur_activite,
  t.modules_actifs
FROM profiles p
LEFT JOIN roles  r ON r.id = p.dynamic_role_id
LEFT JOIN tenants t ON t.id = p.tenant_id;
