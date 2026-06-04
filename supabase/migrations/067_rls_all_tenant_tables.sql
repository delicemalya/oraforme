-- ============================================================
-- 067 — RLS pour TOUTES les tables tenant
-- ============================================================
-- PROBLÈME : les tables créées après la migration 001 n'ont pas
-- de policies RLS → Supabase refuse silencieusement les écritures
-- côté client (anon key) → "rien ne s'enregistre"
--
-- SOLUTION : policy universelle par tenant pour chaque table.
-- Pattern : tenant_id = get_my_tenant_id() pour SELECT/INSERT/UPDATE/DELETE
-- ============================================================

-- Helper déjà créé dans 003, on s'assure qu'il existe
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- Macro helper pour créer une policy tenant universelle
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    -- Finance & achats
    'achats', 'fournisseurs', 'depenses', 'devis', 'devis_lignes',
    'encaissements', 'decaissements', 'remboursements',
    'cheques', 'virements', 'transferts',
    'comptes_bancaires', 'caisses', 'caisse_operations',
    'mobile_money_wallets', 'mobile_wallet_operations',
    'wallets', 'wallet_operations',
    'rapprochement_bancaire', 'rapprochements_bancaires',
    'previsions_tresorerie', 'alertes_tresorerie', 'alertes_config',
    -- Comptabilité
    'journal_comptable', 'journal_entries',
    'plan_comptable', 'tiers', 'centres_couts', 'cost_centers',
    'immobilisations', 'amortissements', 'clotures_comptables',
    'fiscal_years',
    -- Facturation
    'facture_lignes', 'paiements_factures',
    -- Clients & CRM
    'clients',
    -- RH
    'conges', 'sanctions', 'evaluations', 'avantages',
    'documents_rh', 'presences', 'recrutements_ecole',
    'offres_emploi', 'cv_candidats',
    -- Stock
    'products', 'product_categories', 'suppliers',
    'purchases', 'purchase_orders', 'purchase_order_items', 'purchase_items',
    'stock_movements', 'stock_inventories', 'stock_inventory_items',
    'stock_reception_items', 'stock_sortie_items', 'stock_retours',
    'stock_transferts', 'warehouses', 'unit_conversions',
    -- Resto
    'resto_achats', 'resto_tables', 'resto_recettes',
    'rapport_caisse',
    -- Hôtel
    'hotel_chambres', 'hotel_reservations', 'hotel_housekeeping',
    -- École
    'etudiants', 'enseignants', 'classes_ecole', 'subjects',
    'frais_scolaires', 'paiements_scolaires', 'notes_etudiants',
    'notes_ecole', 'absences_etudiants', 'absences_ecole',
    'sessions_ecole', 'exams', 'exam_grades', 'staff_ecole',
    'partenaires_ecole', 'annonces_ecole', 'bourses_etudiants',
    'conges_ecole', 'paie_ecole', 'cours_numeriques', 'devoirs',
    'diplomas', 'defenses', 'attestations',
    'planning_ecole', 'teacher_hours',
    -- Santé
    'clinique_patients', 'clinique_medecins', 'clinique_consultations', 'clinique_rdv',
    -- Pharmacie
    'pharmacie_medicaments', 'pharmacie_ventes', 'pharmacie_vente_lignes',
    -- Collab & outils
    'tasks', 'task_comments', 'events', 'documents',
    'document_dossiers', 'document_signatures',
    'notifications',
    -- Entreprise
    'entreprise_config',
    -- Misc
    'courses', 'chauffeurs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      -- Activer RLS si pas encore activé
      EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);

      -- Supprimer les anciennes policies génériques
      EXECUTE format('DROP POLICY IF EXISTS %L ON %I', t || ': tenant', t);
      EXECUTE format('DROP POLICY IF EXISTS %L ON %I', 'tenant_isolation', t);
      EXECUTE format('DROP POLICY IF EXISTS %L ON %I', t || ': all', t);

      -- Créer la policy universelle tenant
      EXECUTE format(
        'CREATE POLICY %L ON %I FOR ALL
         USING (tenant_id = get_my_tenant_id())
         WITH CHECK (tenant_id = get_my_tenant_id())',
        t || ': tenant',
        t
      );

      RAISE NOTICE 'RLS activé pour table: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Table % ignorée: %', t, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ── TRANSACTIONS : assouplir la policy "financial only" ───────────────────────
-- La migration 030 bloque les transactions sauf rôle financier.
-- On simplifie : tout membre du tenant peut lire/écrire ses propres transactions.
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: financial read"  ON transactions;
DROP POLICY IF EXISTS "transactions: financial write" ON transactions;
DROP POLICY IF EXISTS "transactions: tenant only"     ON transactions;
DROP POLICY IF EXISTS "transactions: tenant"          ON transactions;

CREATE POLICY "transactions: tenant" ON transactions
  FOR ALL
  USING   (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── TEAM_INVITES : lecture par email uniquement ───────────────────────────────
ALTER TABLE IF EXISTS team_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_invites: select" ON team_invites;
CREATE POLICY "team_invites: select" ON team_invites
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── USER_PERMISSIONS & ROLES : lecture par tenant ────────────────────────────
ALTER TABLE IF EXISTS user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_permissions: tenant" ON user_permissions;
CREATE POLICY "user_permissions: tenant" ON user_permissions
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles: tenant" ON roles;
CREATE POLICY "roles: tenant" ON roles
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
