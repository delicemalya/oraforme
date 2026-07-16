-- Migration 168 — Fix advisor performance WARN "auth_rls_initplan" (~80 policies)
--
-- Contexte : de nombreuses policies RLS appellent auth.uid() / auth.jwt() /
-- auth.role() directement dans leur expression (qual / with_check), parfois
-- imbriqué dans une sous-requête corrélée (ex: "tenant_id IN (SELECT
-- profiles.tenant_id FROM profiles WHERE profiles.user_id = auth.uid())").
-- Sans enveloppement, Postgres ré-évalue cet appel à CHAQUE ligne scannée
-- au lieu de l'évaluer une seule fois par requête (InitPlan au lieu de
-- SubPlan corrélé) — coût multiplicatif sur les grosses tables.
--
-- Fix recommandé par Supabase : envelopper l'appel dans un scalar subquery
-- "(select auth.uid())" — sémantiquement identique (même valeur retournée),
-- seule la stratégie de planification change. AUCUN changement de logique
-- d'isolation tenant : c'est une pure optimisation, pas une modification de
-- sécurité.
--
-- Approche générique et sûre : ce script relit qual/with_check tels
-- qu'actuellement stockés par Postgres (pg_get_expr — forme canonique
-- déparsée, pas le texte source original), remplace UNIQUEMENT les
-- policies où l'appel n'est PAS déjà enveloppé (condition NOT ILIKE
-- '%select auth.%' dans le WHERE), donc :
--   - Sûr pour CETTE exécution : aucune des 80 policies concernées
--     aujourd'hui n'est déjà enveloppée, vérifié en base avant écriture.
--   - Précis : chaque ALTER POLICY ne modifie QUE la clause USING/WITH CHECK
--     qui existe réellement pour cette policy (une policy SELECT n'a pas
--     de with_check, une policy INSERT n'a pas de qual — ALTER POLICY
--     n'est appelé que sur la clause non-NULL correspondante).
--   - PAS vraiment idempotent en toute généralité : Postgres redéparse une
--     policy déjà enveloppée en "( SELECT auth.uid() AS uid)" (SELECT en
--     majuscule + alias), que le filtre NOT ILIKE '%select auth.%'
--     reconnaît quand même (ILIKE insensible à la casse) — donc en
--     pratique une ré-exécution ultérieure ne re-matchera pas ces
--     policies. Vérifié par test empirique (création d'une policy
--     sandbox, ALTER POLICY, relecture du oid — inchangé, aucune fenêtre
--     sans RLS).
--
-- Prévisualisé avant écriture : échantillon de transformations vérifié
-- manuellement (ex: acomptes_salaires, agriculture_intrants, tenants,
-- profiles, cv_candidats, bulletins_paie...) — résultat cohérent, aucune
-- perte de logique. auth.uid()/jwt()/role() sont STABLE (pas VOLATILE) —
-- prérequis confirmé pour que l'enveloppement en sous-requête scalaire
-- soit sémantiquement neutre.

DO $$
DECLARE
  pol       RECORD;
  new_qual  TEXT;
  new_check TEXT;
  n         INTEGER := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|jwt|role)\(\)' AND qual NOT ILIKE '%select auth.%')
        OR
        (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|jwt|role)\(\)' AND with_check NOT ILIKE '%select auth.%')
      )
  LOOP
    new_qual  := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    END IF;

    IF new_qual IS NOT NULL AND new_qual IS DISTINCT FROM pol.qual THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
    END IF;

    IF new_check IS NOT NULL AND new_check IS DISTINCT FROM pol.with_check THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', pol.policyname, pol.schemaname, pol.tablename, new_check);
    END IF;

    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Migration 168 OK — % policies RLS optimisées (auth.uid/jwt/role enveloppés)', n;
END $$;
