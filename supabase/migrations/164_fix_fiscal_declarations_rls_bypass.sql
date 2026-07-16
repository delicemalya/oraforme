-- Migration 164 — Fix CRITIQUE : fiscal_declarations totalement ouverte
--
-- Contexte : l'advisor sécurité Supabase signale la policy RLS
-- "service_role_fiscal_declarations" comme rls_policy_always_true.
-- Vérification en base : cette policy a `roles = {public}` (PAS service_role
-- malgré son nom) et `qual = true` / `with_check = true` — c'est-à-dire
-- accès total (SELECT/INSERT/UPDATE/DELETE) sans AUCUNE restriction, pour
-- N'IMPORTE QUEL rôle. De plus, `anon` a un GRANT direct (SELECT/INSERT/
-- UPDATE/DELETE) sur la table elle-même (vérifié via
-- information_schema.role_table_grants).
--
-- Impact réel : n'importe qui, sans authentification, en appelant
-- directement l'API REST Supabase avec la clé anon (publique par design,
-- embarquée dans le bundle client) peut lire, créer, modifier ou supprimer
-- les déclarations fiscales de N'IMPORTE QUEL tenant. C'est le finding le
-- plus grave de tout l'audit — données financières/légales sensibles,
-- cross-tenant, sans authentification.
--
-- Vérifié : app/api/fiscalite/declarations/route.ts et [id]/route.ts
-- utilisent déjà requireTenant() + supabaseAdmin + filtre .eq('tenant_id', ...)
-- — l'application elle-même est saine. Le trou est uniquement au niveau
-- base de données (accessible en contournant l'app via l'API REST directe).
-- Aucun code applicatif ne dépend d'un accès anon à cette table.
--
-- Fix : remplacer la policy par l'isolation tenant standard du projet
-- (même pattern que tva_declarations, declarations_cnss...), et retirer
-- tout privilège anon sur la table.

DROP POLICY IF EXISTS "service_role_fiscal_declarations" ON fiscal_declarations;

REVOKE ALL ON fiscal_declarations FROM anon;

CREATE POLICY "fiscal_declarations_tenant_isolation" ON fiscal_declarations
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

DO $$
BEGIN
  RAISE NOTICE 'Migration 164 OK — fiscal_declarations isolée par tenant, accès anon retiré';
END $$;
