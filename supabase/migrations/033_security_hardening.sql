-- ============================================================
-- 033 — Security Hardening : RLS fixes + write helpers
-- ============================================================
-- PROBLÈME IDENTIFIÉ :
-- Migration 014 a créé des politiques permissives sur transactions
-- ("transactions: select/insert/update/delete") accessibles à TOUT
-- membre du tenant. Migration 030 a ajouté des politiques
-- financières restrictives MAIS n'a jamais supprimé les anciennes.
-- En PostgreSQL, plusieurs politiques RLS sont combinées en OR.
-- Résultat : le RLS financier de 030 est complètement court-circuité.
--
-- Ce script :
--   1. Supprime les anciennes politiques permissives (014 + 026)
--   2. Garde uniquement les politiques financières (030)
--   3. Crée fn_create_depense() SECURITY DEFINER → tout membre peut
--      enregistrer une dépense; la transaction est créée côté serveur
--   4. Crée fn_delete_depense() SECURITY DEFINER → suppression sécurisée
--   5. Ajoute colonnes manquantes (created_by, libelle)
--   6. Corrige les noms de politiques resto_tables / resto_recettes
--   7. Vérifie RLS sur ecole_wallet_movements
-- ============================================================

-- ── 1. Supprimer les anciennes politiques permissives sur transactions ─

-- Policies from migration 014 (open to all tenant members — bypassed 030)
DROP POLICY IF EXISTS "transactions: select" ON transactions;
DROP POLICY IF EXISTS "transactions: insert" ON transactions;
DROP POLICY IF EXISTS "transactions: update" ON transactions;
DROP POLICY IF EXISTS "transactions: delete" ON transactions;

-- Policy from migration 026 (may have been created with this name)
DROP POLICY IF EXISTS "transactions: tenant only" ON transactions;

-- Les politiques financières de migration 030 restent intactes :
--   "transactions: financial read"
--   "transactions: financial write"

-- ── 2. Supprimer les anciennes politiques permissives sur journal_comptable ─
-- journal_comptable garde la lecture ouverte à tous (pour les pages de
-- comptabilité), mais les écritures passent en accès financier uniquement.

DROP POLICY IF EXISTS "journal_comptable: insert" ON journal_comptable;
DROP POLICY IF EXISTS "journal_comptable: update" ON journal_comptable;
DROP POLICY IF EXISTS "journal_comptable: delete" ON journal_comptable;

CREATE POLICY "journal_comptable: financial write" ON journal_comptable
  FOR ALL
  USING (tenant_id = get_my_tenant_id() AND fn_is_user_financial())
  WITH CHECK (tenant_id = get_my_tenant_id() AND fn_is_user_financial());

-- ── 3. Colonnes manquantes ────────────────────────────────────────────

-- Traçabilité auteur sur transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS libelle    TEXT;

-- Traçabilité auteur sur depenses
ALTER TABLE depenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Traçabilité auteur sur achats
ALTER TABLE achats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ── 4. Fonction : enregistrer une dépense (tout membre du tenant) ─────
-- SECURITY DEFINER → s'exécute avec les droits du propriétaire de la
-- fonction (superuser / service_role) → contourne le RLS financier sur
-- transactions. Validation du tenant est faite explicitement dans le corps.

CREATE OR REPLACE FUNCTION fn_create_depense(
  p_categorie      TEXT,
  p_description    TEXT,
  p_montant        NUMERIC(12,0),
  p_date           DATE,
  p_mode_paiement  TEXT,
  p_reference      TEXT  DEFAULT NULL,
  p_cost_center_id UUID  DEFAULT NULL,
  p_debit_account  TEXT  DEFAULT '651000',
  p_credit_account TEXT  DEFAULT '571000'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id   UUID;
  v_dep_id    UUID;
BEGIN
  v_tenant_id := get_my_tenant_id();
  v_user_id   := auth.uid();

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'non authentifié ou aucun tenant';
  END IF;

  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'le montant doit être positif';
  END IF;

  -- Insérer la dépense
  INSERT INTO depenses (
    tenant_id,       categorie,       description,
    montant,         date,            mode_paiement,
    reference_piece, cost_center_id,  debit_account,
    credit_account,  created_by
  ) VALUES (
    v_tenant_id,     p_categorie,     p_description,
    p_montant,       p_date,          p_mode_paiement,
    p_reference,     p_cost_center_id, p_debit_account,
    p_credit_account, v_user_id
  )
  RETURNING id INTO v_dep_id;

  -- Insérer la transaction (SECURITY DEFINER contourne RLS financier)
  INSERT INTO transactions (
    tenant_id,       type,       categorie,
    description,     montant,    date,
    mode_paiement,   source,     source_id,
    debit_account,   credit_account, cost_center_id,
    created_by
  ) VALUES (
    v_tenant_id,    'sortie',   'Dépenses & Charges',
    p_description,  p_montant,  p_date,
    p_mode_paiement,'depense',  v_dep_id,
    p_debit_account, p_credit_account, p_cost_center_id,
    v_user_id
  );

  RETURN v_dep_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_depense TO authenticated;

-- ── 5. Fonction : supprimer une dépense (propriétaire du tenant) ──────

CREATE OR REPLACE FUNCTION fn_delete_depense(p_dep_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_my_tenant_id();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'non authentifié ou aucun tenant';
  END IF;

  -- Vérifier que la dépense appartient au tenant
  IF NOT EXISTS (
    SELECT 1 FROM depenses
    WHERE id = p_dep_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'dépense introuvable ou accès refusé';
  END IF;

  -- Supprimer la transaction liée
  DELETE FROM transactions
  WHERE source = 'depense' AND source_id = p_dep_id
    AND tenant_id = v_tenant_id;

  -- Supprimer la dépense
  DELETE FROM depenses
  WHERE id = p_dep_id AND tenant_id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_delete_depense TO authenticated;

-- ── 6. Renommer les politiques resto_tables (noms courts peu lisibles) ─
-- Migration 009 avait créé "sel_tables", "ins_tables", etc.
-- On les remplace par des noms standardisés.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'resto_tables'
  ) THEN

    DROP POLICY IF EXISTS "sel_tables" ON resto_tables;
    DROP POLICY IF EXISTS "ins_tables" ON resto_tables;
    DROP POLICY IF EXISTS "upd_tables" ON resto_tables;
    DROP POLICY IF EXISTS "del_tables" ON resto_tables;

    -- Recréer avec noms standardisés (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_tables' AND policyname = 'resto_tables: select'
    ) THEN
      CREATE POLICY "resto_tables: select" ON resto_tables
        FOR SELECT USING (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_tables' AND policyname = 'resto_tables: insert'
    ) THEN
      CREATE POLICY "resto_tables: insert" ON resto_tables
        FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_tables' AND policyname = 'resto_tables: update'
    ) THEN
      CREATE POLICY "resto_tables: update" ON resto_tables
        FOR UPDATE USING (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_tables' AND policyname = 'resto_tables: delete'
    ) THEN
      CREATE POLICY "resto_tables: delete" ON resto_tables
        FOR DELETE USING (tenant_id = get_my_tenant_id());
    END IF;

  END IF;
END $$;

-- ── 7. Renommer les politiques resto_recettes ─────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'resto_recettes'
  ) THEN

    DROP POLICY IF EXISTS "sel_recettes" ON resto_recettes;
    DROP POLICY IF EXISTS "ins_recettes" ON resto_recettes;
    DROP POLICY IF EXISTS "upd_recettes" ON resto_recettes;
    DROP POLICY IF EXISTS "del_recettes" ON resto_recettes;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_recettes' AND policyname = 'resto_recettes: select'
    ) THEN
      CREATE POLICY "resto_recettes: select" ON resto_recettes
        FOR SELECT USING (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_recettes' AND policyname = 'resto_recettes: insert'
    ) THEN
      CREATE POLICY "resto_recettes: insert" ON resto_recettes
        FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_recettes' AND policyname = 'resto_recettes: update'
    ) THEN
      CREATE POLICY "resto_recettes: update" ON resto_recettes
        FOR UPDATE USING (tenant_id = get_my_tenant_id());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'resto_recettes' AND policyname = 'resto_recettes: delete'
    ) THEN
      CREATE POLICY "resto_recettes: delete" ON resto_recettes
        FOR DELETE USING (tenant_id = get_my_tenant_id());
    END IF;

  END IF;
END $$;

-- ── 8. RLS ecole_wallet_movements (migration 029) ────────────────────
-- Vérification idempotente — la migration 029 active RLS mais ce
-- bloc assure la cohérence si la table existe dans un autre ordre.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ecole_wallet_movements'
  ) THEN
    ALTER TABLE ecole_wallet_movements ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'ecole_wallet_movements' AND policyname = 'ecole_wallet_mvt: all'
    ) THEN
      CREATE POLICY "ecole_wallet_mvt: all" ON ecole_wallet_movements
        FOR ALL
        USING (tenant_id = get_my_tenant_id())
        WITH CHECK (tenant_id = get_my_tenant_id());
    END IF;
  END IF;
END $$;

-- ── 9. RLS rapprochement_bancaire (migration 031) ────────────────────
-- Vérification idempotente

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'rapprochement_bancaire'
  ) THEN
    ALTER TABLE rapprochement_bancaire ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'rapprochement_bancaire' AND policyname = 'rapprochement: all'
    ) THEN
      CREATE POLICY "rapprochement: all" ON rapprochement_bancaire
        FOR ALL
        USING (tenant_id = get_my_tenant_id())
        WITH CHECK (tenant_id = get_my_tenant_id());
    END IF;
  END IF;
END $$;

-- ── 10. Indexes utilitaires manquants ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_created_by
  ON transactions(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_depenses_created_by
  ON depenses(created_by) WHERE created_by IS NOT NULL;

-- ── 11. Vue : résumé des dépenses par catégorie et tenant ────────────

CREATE OR REPLACE VIEW vue_depenses_stats AS
SELECT
  tenant_id,
  categorie,
  DATE_TRUNC('month', date)        AS mois,
  COUNT(*)                         AS nb_depenses,
  SUM(montant)                     AS total_montant,
  AVG(montant)                     AS moyenne_montant
FROM depenses
GROUP BY tenant_id, categorie, DATE_TRUNC('month', date);
