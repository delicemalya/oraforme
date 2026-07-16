-- Migration 165 — Fix advisor sécurité WARN "function_search_path_mutable" (101 fonctions)
--
-- Contexte : aucune fonction du schéma "public" n'a de search_path fixé.
-- Sans ça, une fonction (surtout SECURITY DEFINER — 51 des fonctions
-- concernées ici tournent avec les privilèges du propriétaire) résout les
-- identifiants non qualifiés (noms de table/fonction) selon le search_path
-- de la session appelante. Un attaquant capable de créer un objet dans un
-- schéma présent dans son propre search_path (ex: un schéma qu'il possède,
-- ou "public" si écriture y est permise) peut potentiellement faire
-- résoudre un identifiant non qualifié vers SON objet au lieu du vrai —
-- une attaque d'injection de search_path classique en Postgres.
--
-- Fix : épingler search_path = public, pg_temp sur chaque fonction du
-- schéma public qui ne l'a pas déjà. Pur changement de métadonnée
-- (ALTER FUNCTION ... SET search_path), AUCUNE modification du corps des
-- fonctions — comportement fonctionnel strictement inchangé, seule la
-- résolution des noms non qualifiés est désormais figée sur (public, pg_temp)
-- au lieu d'hériter du search_path de l'appelant.
--
-- Générique et idempotent : boucle sur pg_proc, ne touche que les
-- fonctions du schéma public sans search_path déjà configuré — sûr à
-- ré-exécuter si de nouvelles fonctions sont ajoutées plus tard sans ce
-- réglage.

DO $$
DECLARE
  fn RECORD;
  n  INTEGER := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Migration 165 OK — search_path fixé sur % fonctions', n;
END $$;
