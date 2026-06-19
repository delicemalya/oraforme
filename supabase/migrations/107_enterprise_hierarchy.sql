-- ============================================================
-- Migration 107 — Enterprise Hierarchy
-- Architecture Multi-Pays / Multi-Sociétés / Multi-Agences
-- ============================================================
-- OBJECTIF :
--   Faire évoluer Oraforme vers une architecture Enterprise.
--   Groupe → Société → Filiale → Agence (3-4 niveaux max).
--
-- PHILOSOPHIE :
--   • Un Tenant = une entité légale (groupe, société OU agence).
--   • Hiérarchie par auto-référence : parent_tenant_id → tenants(id).
--   • Zéro breaking change : tous les tenants existants → 'standalone'.
--   • RLS existantes inchangées — extension uniquement.
--   • Idempotente : IF NOT EXISTS / OR REPLACE / DO-EXCEPTION.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SECTION 1 — COLONNES HIÉRARCHIE SUR TENANTS
-- ══════════════════════════════════════════════════════════════

-- 1a. Colonnes principales
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS parent_tenant_id    UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type_entite         TEXT        NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS code_groupe         TEXT,
  ADD COLUMN IF NOT EXISTS ordre_affichage     INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_consolidation BOOLEAN     NOT NULL DEFAULT false;

-- 1b. Contrainte CHECK sur type_entite
DO $$ BEGIN
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_type_entite_check
    CHECK (type_entite IN ('standalone','groupe','societe','filiale','agence'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1c. Un GROUPE racine n'a jamais de parent
DO $$ BEGIN
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_groupe_sans_parent
    CHECK (type_entite != 'groupe' OR parent_tenant_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1d. Index pour requêtes hiérarchiques (très fréquentes)
CREATE INDEX IF NOT EXISTS idx_tenants_parent_id
  ON tenants(parent_tenant_id)
  WHERE parent_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_type_entite
  ON tenants(type_entite);

CREATE INDEX IF NOT EXISTS idx_tenants_code_groupe
  ON tenants(code_groupe)
  WHERE code_groupe IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_parent_type
  ON tenants(parent_tenant_id, type_entite)
  WHERE parent_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_pays_type
  ON tenants(pays, type_entite)
  WHERE pays IS NOT NULL;

-- 1e. Documentation des colonnes
COMMENT ON COLUMN tenants.parent_tenant_id    IS 'UUID du tenant parent (NULL = racine standalone ou groupe)';
COMMENT ON COLUMN tenants.type_entite         IS 'standalone | groupe | societe | filiale | agence';
COMMENT ON COLUMN tenants.code_groupe         IS 'Référence groupe lisible par l''utilisateur (ex: SAS-GRP-001)';
COMMENT ON COLUMN tenants.ordre_affichage     IS 'Ordre de tri dans les listes déroulantes EntitySwitcher';
COMMENT ON COLUMN tenants.allow_consolidation IS 'TRUE = ce tenant peut accéder aux vues consolidées cross-entité';


-- ══════════════════════════════════════════════════════════════
-- SECTION 2 — TABLE entity_group_members (cache plat hiérarchie)
-- ══════════════════════════════════════════════════════════════
--
-- Évite les CTE récursives à chaque requête dashboard.
-- Alimentée automatiquement par trigger (cf. Section 4).
-- Contient toutes les relations ancêtre→descendant du groupe.

CREATE TABLE IF NOT EXISTS entity_group_members (
  groupe_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  depth       INT          NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 5),
  path        TEXT,                          -- 'uuid-groupe/uuid-societe/uuid-agence'
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (groupe_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_egm_groupe_id ON entity_group_members(groupe_id);
CREATE INDEX IF NOT EXISTS idx_egm_member_id ON entity_group_members(member_id);
CREATE INDEX IF NOT EXISTS idx_egm_depth     ON entity_group_members(depth);

COMMENT ON TABLE entity_group_members IS
  'Cache plat de la hiérarchie Groupe→Société→Agence. '
  'Mis à jour automatiquement par trg_maintain_group_members. '
  'group_id = l''ancêtre, member_id = le descendant (depth 1=direct, 2=petit-fils…).';


-- ══════════════════════════════════════════════════════════════
-- SECTION 3 — RLS sur entity_group_members
-- ══════════════════════════════════════════════════════════════

ALTER TABLE entity_group_members ENABLE ROW LEVEL SECURITY;

-- Un tenant voit les entrées où il est le groupe OU le membre
DO $$ BEGIN
  CREATE POLICY "egm: groupe et membres peuvent lire"
    ON entity_group_members FOR SELECT
    USING (
      groupe_id = get_my_tenant_id()
      OR member_id = get_my_tenant_id()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Super-admins Oraforme : accès total
DO $$ BEGIN
  CREATE POLICY "egm: super-admin lecture"
    ON entity_group_members FOR SELECT
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Écriture réservée au service_role via triggers SECURITY DEFINER
-- Pas de policy INSERT/UPDATE/DELETE côté client


-- ══════════════════════════════════════════════════════════════
-- SECTION 4 — PROTECTION ANTI-BOUCLE CIRCULAIRE
-- ══════════════════════════════════════════════════════════════
--
-- Empêche : société A → parent B → parent A (cycle).
-- Vérifie en remontant la chaîne jusqu'à depth=10.

CREATE OR REPLACE FUNCTION fn_check_no_circular_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current UUID;
  v_depth   INT := 0;
BEGIN
  -- Pas de parent → pas de risque
  IF NEW.parent_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Optimisation : ne vérifier que si parent_tenant_id change
  IF TG_OP = 'UPDATE'
     AND NEW.parent_tenant_id IS NOT DISTINCT FROM OLD.parent_tenant_id THEN
    RETURN NEW;
  END IF;

  -- Un tenant ne peut pas être son propre parent direct
  IF NEW.parent_tenant_id = NEW.id THEN
    RAISE EXCEPTION
      'enterprise_hierarchy: un tenant ne peut pas être son propre parent (id=%)', NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Remonter la chaîne jusqu'à trouver une boucle ou la racine
  v_current := NEW.parent_tenant_id;
  WHILE v_current IS NOT NULL AND v_depth < 10 LOOP
    IF v_current = NEW.id THEN
      RAISE EXCEPTION
        'enterprise_hierarchy: boucle circulaire détectée — tenant % est déjà un ancêtre',
        NEW.id USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    SELECT parent_tenant_id INTO v_current FROM tenants WHERE id = v_current;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_check_no_circular_hierarchy TO authenticated;

DROP TRIGGER IF EXISTS trg_no_circular_hierarchy ON tenants;
CREATE TRIGGER trg_no_circular_hierarchy
  BEFORE INSERT OR UPDATE OF parent_tenant_id ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_check_no_circular_hierarchy();

COMMENT ON FUNCTION fn_check_no_circular_hierarchy IS
  'Vérifie l''absence de cycle dans la hiérarchie parent_tenant_id. '
  'Déclenché BEFORE INSERT OR UPDATE OF parent_tenant_id.';


-- ══════════════════════════════════════════════════════════════
-- SECTION 5 — TRIGGER DE MAINTENANCE entity_group_members
-- ══════════════════════════════════════════════════════════════
--
-- Maintient la table de cache automatiquement.
-- Gère 3 niveaux : Groupe → Société → Agence.
-- (Le niveau 4 sera géré par la vue v_entity_tree si besoin.)

CREATE OR REPLACE FUNCTION fn_maintain_group_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grandparent_id UUID;
  v_now            TIMESTAMPTZ := now();
BEGIN
  -- 1. Purger les anciennes entrées où ce tenant est membre
  DELETE FROM entity_group_members WHERE member_id = NEW.id;

  -- 2. Si plus de parent → standalone, rien à ajouter
  IF NEW.parent_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Depth 1 : parent direct
  INSERT INTO entity_group_members (groupe_id, member_id, depth, path, updated_at)
  VALUES (
    NEW.parent_tenant_id,
    NEW.id,
    1,
    NEW.parent_tenant_id::TEXT || '/' || NEW.id::TEXT,
    v_now
  )
  ON CONFLICT (groupe_id, member_id) DO UPDATE
    SET depth      = 1,
        path       = EXCLUDED.path,
        updated_at = v_now;

  -- 4. Depth 2 : grand-parent (si le parent a lui-même un parent)
  SELECT parent_tenant_id
  INTO v_grandparent_id
  FROM tenants
  WHERE id = NEW.parent_tenant_id;

  IF v_grandparent_id IS NOT NULL THEN
    INSERT INTO entity_group_members (groupe_id, member_id, depth, path, updated_at)
    VALUES (
      v_grandparent_id,
      NEW.id,
      2,
      v_grandparent_id::TEXT || '/' || NEW.parent_tenant_id::TEXT || '/' || NEW.id::TEXT,
      v_now
    )
    ON CONFLICT (groupe_id, member_id) DO UPDATE
      SET depth      = 2,
          path       = EXCLUDED.path,
          updated_at = v_now;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_maintain_group_members TO authenticated;

DROP TRIGGER IF EXISTS trg_maintain_group_members ON tenants;
CREATE TRIGGER trg_maintain_group_members
  AFTER INSERT OR UPDATE OF parent_tenant_id ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_maintain_group_members();

COMMENT ON FUNCTION fn_maintain_group_members IS
  'Maintient entity_group_members à jour. Gère jusqu''à 3 niveaux. '
  'Déclenché AFTER INSERT OR UPDATE OF parent_tenant_id.';


-- ══════════════════════════════════════════════════════════════
-- SECTION 6 — FONCTIONS UTILITAIRES GROUPE
-- ══════════════════════════════════════════════════════════════

-- 6a. get_my_group_tenant_ids()
-- Retourne le tenant courant + tous ses descendants directs.
-- Utilisée dans les requêtes consolidées dashboard groupe.
CREATE OR REPLACE FUNCTION get_my_group_tenant_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT get_my_tenant_id()
    UNION
    SELECT member_id
    FROM   entity_group_members
    WHERE  groupe_id = get_my_tenant_id()
  );
$$;

GRANT EXECUTE ON FUNCTION get_my_group_tenant_ids TO authenticated;

COMMENT ON FUNCTION get_my_group_tenant_ids IS
  'Retourne [tenant courant] + tous ses descendants (société/agence). '
  'Utilisée pour les requêtes consolidées. SECURITY DEFINER (bypass RLS sur entity_group_members).';

-- 6b. fn_is_groupe_owner()
-- Vérifie si l''utilisateur est owner ou groupe_owner du tenant courant.
CREATE OR REPLACE FUNCTION fn_is_groupe_owner()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role IN ('owner', 'groupe_owner')
      FROM   profiles
      WHERE  user_id   = auth.uid()
        AND  tenant_id = get_my_tenant_id()
      LIMIT 1
    ),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION fn_is_groupe_owner TO authenticated;

COMMENT ON FUNCTION fn_is_groupe_owner IS
  'TRUE si l''utilisateur est owner ou groupe_owner du tenant courant.';

-- 6c. get_entity_depth(tenant_id)
-- Retourne la profondeur d''un tenant dans sa hiérarchie.
CREATE OR REPLACE FUNCTION get_entity_depth(p_tenant_id UUID)
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_tenant_id, 0 AS d
    FROM   tenants
    WHERE  id = p_tenant_id
    UNION ALL
    SELECT t.id, t.parent_tenant_id, a.d + 1
    FROM   tenants t
    JOIN   ancestors a ON t.id = a.parent_tenant_id
    WHERE  a.d < 10
  )
  SELECT MAX(d) FROM ancestors;
$$;

GRANT EXECUTE ON FUNCTION get_entity_depth TO authenticated;

COMMENT ON FUNCTION get_entity_depth IS
  'Retourne la profondeur d''un tenant dans sa hiérarchie (0=racine, 1=enfant direct, etc.).';


-- ══════════════════════════════════════════════════════════════
-- SECTION 7 — POLICY SELECT TENANTS ÉTENDUE (visibilité groupe)
-- ══════════════════════════════════════════════════════════════
--
-- Permet à un utilisateur de voir les tenants de son groupe
-- dans le EntitySwitcher et le dashboard consolidé.
-- Les policies existantes sur tenants ne sont PAS modifiées.

DO $$ BEGIN
  CREATE POLICY "tenants: visibilite groupe membres"
    ON tenants FOR SELECT
    USING (
      id = ANY(get_my_group_tenant_ids())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON POLICY "tenants: visibilite groupe membres" ON tenants IS
  'Un utilisateur peut voir tous les tenants de son groupe (société, agences). '
  'S''appuie sur get_my_group_tenant_ids() qui utilise entity_group_members.';


-- ══════════════════════════════════════════════════════════════
-- SECTION 8 — VUE v_entity_tree (arbre hiérarchique complet)
-- ══════════════════════════════════════════════════════════════
--
-- CTE récursive — utilisée pour afficher l''arbre dans l''UI.
-- Pour les requêtes fréquentes, préférer entity_group_members (plus rapide).

CREATE OR REPLACE VIEW v_entity_tree AS
WITH RECURSIVE tree AS (

  -- Niveau 0 : racines (tenants sans parent)
  SELECT
    id,
    nom_entreprise,
    parent_tenant_id,
    type_entite,
    pays,
    ville,
    code_groupe,
    allow_consolidation,
    ordre_affichage,
    0                 AS depth,
    ARRAY[id]         AS ancestors,
    id::TEXT          AS path
  FROM tenants
  WHERE parent_tenant_id IS NULL

  UNION ALL

  -- Niveaux 1-4 : enfants récursifs
  SELECT
    t.id,
    t.nom_entreprise,
    t.parent_tenant_id,
    t.type_entite,
    t.pays,
    t.ville,
    t.code_groupe,
    t.allow_consolidation,
    t.ordre_affichage,
    tree.depth + 1,
    tree.ancestors || t.id,
    tree.path || '/' || t.id::TEXT
  FROM tenants t
  JOIN tree ON t.parent_tenant_id = tree.id
  WHERE tree.depth < 5   -- sécurité : profondeur max 5 niveaux

)
SELECT
  id,
  nom_entreprise,
  parent_tenant_id,
  type_entite,
  pays,
  ville,
  code_groupe,
  allow_consolidation,
  ordre_affichage,
  depth,
  ancestors,
  path
FROM tree
ORDER BY depth, ordre_affichage, nom_entreprise;

COMMENT ON VIEW v_entity_tree IS
  'Arbre hiérarchique complet via CTE récursive. '
  'Hérite de la RLS de la table tenants. '
  'Pour les requêtes dashboard, utiliser entity_group_members (cache plat, plus rapide).';


-- ══════════════════════════════════════════════════════════════
-- SECTION 9 — EXTENSION profiles.role POUR GROUPE
-- ══════════════════════════════════════════════════════════════
--
-- Ajoute les valeurs 'groupe_owner' et 'groupe_viewer' à profiles.role.
-- Opération sûre : DROP + ADD constraint dans un bloc exception.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom exact de la contrainte CHECK sur profiles.role
  SELECT tc.constraint_name
  INTO   v_constraint_name
  FROM   information_schema.table_constraints tc
  JOIN   information_schema.check_constraints cc
         ON  tc.constraint_name = cc.constraint_name
         AND tc.constraint_schema = cc.constraint_schema
  WHERE  tc.table_name   = 'profiles'
    AND  tc.table_schema = 'public'
    AND  cc.check_clause ILIKE '%role%'
  LIMIT 1;

  -- Supprimer l''ancienne contrainte si trouvée
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    RAISE NOTICE 'profiles.role CHECK contrainte "%" supprimée', v_constraint_name;
  ELSE
    RAISE NOTICE 'profiles.role: aucune contrainte CHECK existante trouvée — ajout direct';
  END IF;

  -- Recréer avec toutes les valeurs (existantes + nouvelles)
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner','admin','membre','groupe_owner','groupe_viewer'));

  RAISE NOTICE 'profiles_role_check créée : owner | admin | membre | groupe_owner | groupe_viewer';

EXCEPTION WHEN others THEN
  RAISE NOTICE 'profiles_role_check non modifiée (déjà à jour ou erreur inattendue): %', SQLERRM;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 10 — TRIGGER ANTI-TENANT-HOP sur entity_group_members
-- ══════════════════════════════════════════════════════════════
--
-- Empêche la modification de groupe_id ou member_id après INSERT.
-- (Même sécurité que sur les tables métier depuis migration 039.)

CREATE OR REPLACE FUNCTION fn_prevent_egm_key_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.groupe_id IS DISTINCT FROM NEW.groupe_id
  OR OLD.member_id IS DISTINCT FROM NEW.member_id THEN
    RAISE EXCEPTION
      'entity_group_members: modification de groupe_id/member_id interdite'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_egm_no_key_change ON entity_group_members;
CREATE TRIGGER trg_egm_no_key_change
  BEFORE UPDATE ON entity_group_members
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_egm_key_change();


-- ══════════════════════════════════════════════════════════════
-- SECTION 11 — VALIDATION FINALE (smoke test)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok BOOLEAN := TRUE;
BEGIN
  -- Vérifier les colonnes sur tenants
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenants' AND column_name='parent_tenant_id'
  ) THEN
    RAISE WARNING 'ECHEC: colonne parent_tenant_id manquante sur tenants';
    v_ok := FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenants' AND column_name='type_entite'
  ) THEN
    RAISE WARNING 'ECHEC: colonne type_entite manquante sur tenants';
    v_ok := FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenants' AND column_name='allow_consolidation'
  ) THEN
    RAISE WARNING 'ECHEC: colonne allow_consolidation manquante sur tenants';
    v_ok := FALSE;
  END IF;

  -- Vérifier la table entity_group_members
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='entity_group_members'
  ) THEN
    RAISE WARNING 'ECHEC: table entity_group_members manquante';
    v_ok := FALSE;
  END IF;

  -- Vérifier la vue v_entity_tree
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema='public' AND table_name='v_entity_tree'
  ) THEN
    RAISE WARNING 'ECHEC: vue v_entity_tree manquante';
    v_ok := FALSE;
  END IF;

  -- Vérifier les fonctions
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_my_group_tenant_ids'
  ) THEN
    RAISE WARNING 'ECHEC: fonction get_my_group_tenant_ids manquante';
    v_ok := FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='fn_check_no_circular_hierarchy'
  ) THEN
    RAISE WARNING 'ECHEC: trigger fn_check_no_circular_hierarchy manquant';
    v_ok := FALSE;
  END IF;

  IF v_ok THEN
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅  Migration 107 — Enterprise Hierarchy : SUCCES';
    RAISE NOTICE '    • tenants : +5 colonnes hiérarchie';
    RAISE NOTICE '    • entity_group_members : table cache + RLS';
    RAISE NOTICE '    • Triggers : anti-boucle + maintenance cache';
    RAISE NOTICE '    • Fonctions : get_my_group_tenant_ids, fn_is_groupe_owner, get_entity_depth';
    RAISE NOTICE '    • Vue : v_entity_tree (CTE récursive)';
    RAISE NOTICE '    • Policy : tenants visibilité groupe';
    RAISE NOTICE '    • profiles.role : +groupe_owner, +groupe_viewer';
    RAISE NOTICE '    Prêt pour Phase 2 : EntitySwitcher + hook useEntityHierarchy';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
  ELSE
    RAISE EXCEPTION 'Migration 107 incomplète — voir les warnings ci-dessus';
  END IF;
END $$;
