-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 180 — P0-CRITICAL-01 : ferme deux fuites RLS actives
-- Source : docs/MASTER-A-Z-AUDIT-2026-09.md, §32 risques #1 et #2
-- ═════════════════════════════════════════════════════════════════════════════
--
-- FUITE #1 — tenants
--   La policy "tenants_select" (qual: auth.uid() IS NOT NULL, AUCUN filtre tenant)
--   permet à n'importe quel utilisateur authentifié de lire les 26 tenants de
--   production (nom_entreprise, secteur, plan, RCCM, numero_fiscal, dirigeant_*...).
--   Recherche exhaustive confirmée : cette policy n'existe dans AUCUNE migration
--   versionnée du dépôt (grep "tenants_select" supabase/migrations/*.sql = 0
--   résultat) — c'est une dérive de configuration appliquée hors-pipeline
--   (SQL Editor / Dashboard Supabase), non datable ni attribuable depuis le dépôt.
--
--   Policies restantes après cette migration (déjà correctement scopées, non
--   modifiées ici) :
--     "tenants: select"                 -> id = get_my_tenant_id()
--     "tenants: visibilite groupe membres" -> id = ANY(get_my_group_tenant_ids())
--   La seconde couvre la visibilité légitime Groupe→Société→Agence
--   (entity_group_members) — elle inclut déjà get_my_tenant_id(), ce n'est pas
--   une fuite, c'est la hiérarchie documentée.
--
--   NOTE (hors périmètre de cette migration, signalée séparément) : la policy
--   "tenants: insert" (with_check: auth.uid() IS NOT NULL, sans validation) reste
--   ouverte. Elle n'est PAS corrigée ici — voir ticket P0CRIT01-TENANTS-INSERT-OPEN
--   dans docs/REPAIR-LOG.md, à traiter dans une mission dédiée.
--
-- FUITE #2 — journal_entries
--   La migration 026_erp_interconnection.sql (lignes 118-131) a créé 4 policies
--   larges ("select"/"insert"/"update"/"delete", tenant seul, SANS vérification
--   financière). La migration 030_financial_rls.sql (lignes 66-80) a ensuite
--   ajouté des policies strictes ("financial read"/"financial write", avec
--   fn_is_user_financial()) sans jamais faire DROP POLICY sur les 4 policies
--   larges de 026. En PostgreSQL, les policies PERMISSIVE d'une même commande
--   s'additionnent en OR : la policy stricte n'avait donc jamais eu d'effet
--   réel — n'importe quel membre du tenant (rôle "membre" compris) pouvait
--   lire/écrire/supprimer le grand livre comptable via l'API REST Supabase.
--
--   Policies restantes après cette migration (déjà correctement scopées, non
--   modifiées ici) :
--     "journal_entries: financial read"  -> tenant_id = get_my_tenant_id() AND fn_is_user_financial()
--     "journal_entries: financial write" -> idem, commande ALL (couvre INSERT/UPDATE/DELETE)
--
-- IMPACT SUR LE MOTEUR COMPTABLE — vérifié par requête directe avant écriture de
-- cette migration (pg_proc / pg_roles / pg_class) : emit_accounting_event(),
-- fn_ae_execute_event(), fn_reverse_accounting_event() et fn_replay_accounting_event()
-- sont toutes SECURITY DEFINER, appartiennent au rôle `postgres`
-- (rolbypassrls = true), et journal_entries/tenants n'ont PAS
-- FORCE ROW LEVEL SECURITY (relforcerowsecurity = false). Ces fonctions ont donc
-- TOUJOURS contourné RLS sur ces tables, indépendamment des policies — cette
-- migration ne change rien à leur fonctionnement. Le service_role (routes API
-- serveur, supabaseAdmin) contourne également RLS nativement et n'est pas
-- affecté.
--
-- Idempotente (IF EXISTS sur tous les DROP, ré-exécutable sans erreur).
-- Aucune donnée modifiée. Bloc de rollback documenté en fin de fichier
-- (non exécuté automatiquement).
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. tenants : retirer la policy SELECT non filtrée par tenant ───────────────
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;

-- ── 2. journal_entries : retirer les 4 policies larges non filtrées par
--       fn_is_user_financial() ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "journal_entries: select" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries: insert" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries: update" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries: delete" ON public.journal_entries;

-- ── 3. Vérification post-migration — échoue bruyamment si l'état cible n'est
--       pas atteint, pour ne jamais laisser croire à un correctif appliqué qui
--       ne le serait pas réellement ─────────────────────────────────────────────
DO $$
DECLARE
  v_cnt INT;
BEGIN
  SELECT COUNT(*) INTO v_cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenants_select';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'Migration 180 échouée : policy "tenants_select" toujours présente sur tenants';
  END IF;

  SELECT COUNT(*) INTO v_cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'journal_entries'
      AND policyname IN ('journal_entries: select', 'journal_entries: insert',
                          'journal_entries: update', 'journal_entries: delete');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'Migration 180 échouée : % policy(ies) large(s) encore présente(s) sur journal_entries', v_cnt;
  END IF;

  SELECT COUNT(*) INTO v_cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'journal_entries'
      AND policyname IN ('journal_entries: financial read', 'journal_entries: financial write');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'Migration 180 échouée : policies financières journal_entries manquantes (trouvé %, attendu 2)', v_cnt;
  END IF;

  RAISE NOTICE 'Migration 180 vérifiée : tenants_select retirée, 4 policies larges journal_entries retirées, 2 policies financières intactes.';
END $$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — à exécuter manuellement en cas de besoin de revenir à l'état
-- précédent (NON recommandé : cela restaure les deux fuites RLS)
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- CREATE POLICY "tenants_select" ON public.tenants
--   FOR SELECT USING (auth.uid() IS NOT NULL);
-- CREATE POLICY "journal_entries: select" ON public.journal_entries
--   FOR SELECT USING (tenant_id = get_my_tenant_id());
-- CREATE POLICY "journal_entries: insert" ON public.journal_entries
--   FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
-- CREATE POLICY "journal_entries: update" ON public.journal_entries
--   FOR UPDATE USING (tenant_id = get_my_tenant_id());
-- CREATE POLICY "journal_entries: delete" ON public.journal_entries
--   FOR DELETE USING (tenant_id = get_my_tenant_id());
-- COMMIT;
