-- Migration 161 — Fix advisor sécurité ERROR "auth_users_exposed"
--
-- Contexte : vue_team_access (migration 039_multi_tenant_hardening.sql) joint
-- profiles à auth.users (au.email, au.created_at) et filtre par
-- p.tenant_id = get_my_tenant_id(). Le rôle "anon" (non authentifié) a reçu
-- un GRANT ALL par défaut sur cette vue (comportement par défaut des
-- privilèges Supabase sur le schéma public), ce qui a déclenché le finding
-- ERROR "auth_users_exposed" de l'advisor sécurité Supabase.
--
-- Analyse de risque réel : get_my_tenant_id() fait
--   SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1
-- Pour une requête anon, auth.uid() = NULL → la fonction retourne NULL →
-- p.tenant_id = NULL n'est jamais vrai → la vue retourne 0 ligne pour anon
-- aujourd'hui. Il n'y a donc PAS de fuite de données actuellement exploitée,
-- mais la surface d'attaque ne devrait pas exister : c'est un accès qui ne
-- repose que sur une coïncidence de sémantique NULL, pas sur un déni exprès.
--
-- Vérifié avant ce fix : vue_team_access n'est référencée nulle part dans le
-- code applicatif (grep sur /app, /lib) — aucune fonctionnalité ne dépend
-- d'un accès anon à cette vue. Seul le rôle "authenticated" doit y accéder
-- (c'est une vue "équipe" : chaque utilisateur connecté voit les membres de
-- son propre tenant, comportement inchangé par ce fix).
--
-- Fix : retirer tous les privilèges du rôle anon sur cette vue uniquement.
-- Aucun changement pour "authenticated" ni "service_role" — comportement
-- applicatif strictement inchangé pour tous les usages existants.

REVOKE ALL ON vue_team_access FROM anon;

DO $$
BEGIN
  RAISE NOTICE 'Migration 161 OK — accès anon révoqué sur vue_team_access (auth_users_exposed corrigé)';
END $$;
