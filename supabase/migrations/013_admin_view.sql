-- Vue globale pour le Super Admin oraforme
-- À exécuter dans le SQL Editor de Supabase

CREATE OR REPLACE VIEW admin_tenants_overview AS
SELECT
  t.id,
  t.nom_entreprise,
  t.plan,
  t.modules_actifs,
  t.created_at,
  COUNT(DISTINCT p.id)  AS nb_users,
  COUNT(DISTINCT f.id)  AS nb_factures,
  COALESCE(SUM(CASE WHEN f.statut = 'payee' THEN f.total ELSE 0 END), 0) AS revenus_total,
  COUNT(DISTINCT e.id)  AS nb_employes
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id
LEFT JOIN factures f ON f.tenant_id = t.id
LEFT JOIN employes e ON e.tenant_id = t.id
GROUP BY t.id, t.nom_entreprise, t.plan, t.modules_actifs, t.created_at;

-- Accès service_role uniquement (admin)
REVOKE ALL ON admin_tenants_overview FROM anon, authenticated;
GRANT SELECT ON admin_tenants_overview TO service_role;
