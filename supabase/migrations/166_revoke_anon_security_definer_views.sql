-- Migration 166 — Fix exposition anon sur 39 vues SECURITY DEFINER
--
-- Contexte : les 40 vues SECURITY DEFINER signalées par l'advisor sécurité
-- (auth_users_exposed sur vue_team_access déjà traité en migration 161) ont
-- TOUTES un GRANT SELECT par défaut au rôle "anon" — vérifié exhaustivement
-- via information_schema.role_table_grants. C'est le même pattern
-- systémique que vue_team_access : privilèges par défaut Supabase sur le
-- schéma public jamais révoqués, pas une exposition voulue.
--
-- Ces vues couvrent des données sensibles : comptabilité (grand_livre,
-- compte_resultat, balance_tiers, mouvements_comptables, v_financial_ledger,
-- v_soldes_syscohada...), facturation/MRR (v_billing_mrr, v_billing_summary),
-- dashboard admin (v_admin_dashboard, audit_dashboard), moteur comptable
-- interne (v_accounting_*), notifications/mémoire IA (miaa_*), etc.
--
-- Vérifié avant ce fix : sur ces 39 vues, seules 3 sont référencées dans le
-- code applicatif (compte_resultat, grand_livre, v_entity_tree) — toutes les
-- 3 uniquement depuis des pages sous /dashboard, protégées par une session
-- obligatoire (proxy.ts redirige vers /login si non authentifié). Le
-- rôle "anon" n'est donc JAMAIS utilisé par un usage légitime de l'app pour
-- lire ces vues — retirer son accès ne change aucun comportement pour un
-- utilisateur connecté (ses requêtes passent en rôle "authenticated").
--
-- Ce fix ne touche PAS au statut SECURITY DEFINER lui-même (le retirer vue
-- par vue nécessite une revue individuelle — plusieurs de ces vues peuvent
-- ne fonctionner QUE grâce aux privilèges élevés du propriétaire, comme
-- confirmé pour vue_team_access qui lit auth.users). C'est un chantier
-- séparé, documenté mais volontairement hors scope ici.

REVOKE ALL ON audit_dashboard                    FROM anon;
REVOKE ALL ON balance_tiers                      FROM anon;
REVOKE ALL ON cabinet_declarations_urgentes      FROM anon;
REVOKE ALL ON compta_summary_view                FROM anon;
REVOKE ALL ON compte_resultat                    FROM anon;
REVOKE ALL ON grand_livre                        FROM anon;
REVOKE ALL ON htl_kpis_occupation                FROM anon;
REVOKE ALL ON miaa_memory_overview               FROM anon;
REVOKE ALL ON miaa_notifications_summary         FROM anon;
REVOKE ALL ON miaa_rapports_summary              FROM anon;
REVOKE ALL ON mouvements_comptables              FROM anon;
REVOKE ALL ON v_accounting_alerts                FROM anon;
REVOKE ALL ON v_accounting_balance_check         FROM anon;
REVOKE ALL ON v_accounting_dead_letter           FROM anon;
REVOKE ALL ON v_accounting_events_errors         FROM anon;
REVOKE ALL ON v_accounting_events_status         FROM anon;
REVOKE ALL ON v_accounting_extourne_chain        FROM anon;
REVOKE ALL ON v_accounting_fiscal_params_active  FROM anon;
REVOKE ALL ON v_accounting_replay_queue          FROM anon;
REVOKE ALL ON v_accounting_rules_active          FROM anon;
REVOKE ALL ON v_admin_dashboard                  FROM anon;
REVOKE ALL ON v_billing_mrr                      FROM anon;
REVOKE ALL ON v_billing_summary                  FROM anon;
REVOKE ALL ON v_devises_utilisees                FROM anon;
REVOKE ALL ON v_entity_tree                      FROM anon;
REVOKE ALL ON v_events_this_month                FROM anon;
REVOKE ALL ON v_financial_ledger                 FROM anon;
REVOKE ALL ON v_hotel_occupation                 FROM anon;
REVOKE ALL ON v_my_notifications                 FROM anon;
REVOKE ALL ON v_pharmacie_stock_faible           FROM anon;
REVOKE ALL ON v_rdv_today                        FROM anon;
REVOKE ALL ON v_soldes_nets_syscohada            FROM anon;
REVOKE ALL ON v_soldes_syscohada                 FROM anon;
REVOKE ALL ON v_tasks_with_counts                FROM anon;
REVOKE ALL ON v_treso_summary                    FROM anon;
REVOKE ALL ON vue_automation_stats               FROM anon;
REVOKE ALL ON vue_balance_clients                FROM anon;
REVOKE ALL ON vue_depenses_stats                 FROM anon;
REVOKE ALL ON vue_resultat_net                   FROM anon;

DO $$
BEGIN
  RAISE NOTICE 'Migration 166 OK — accès anon révoqué sur 39 vues SECURITY DEFINER';
END $$;
