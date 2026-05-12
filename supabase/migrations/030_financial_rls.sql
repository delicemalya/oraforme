-- ============================================================
-- 030 — RLS financier : transactions, journal_entries, CoA
-- ============================================================
-- Seuls les profils avec is_financial = true (ou owner) peuvent
-- lire/écrire les tables financières sensibles.
-- ============================================================

-- ── 1. Fonction helper : is_financial pour le user courant ───

CREATE OR REPLACE FUNCTION fn_is_user_financial()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role        TEXT;
  v_dyn_role_id UUID;
  v_is_fin      BOOLEAN;
BEGIN
  SELECT role, dynamic_role_id
    INTO v_role, v_dyn_role_id
    FROM profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  -- owner voit tout
  IF v_role = 'owner' THEN RETURN TRUE; END IF;

  -- rôle dynamique
  IF v_dyn_role_id IS NOT NULL THEN
    SELECT is_financial INTO v_is_fin
      FROM roles WHERE id = v_dyn_role_id LIMIT 1;
    RETURN COALESCE(v_is_fin, FALSE);
  END IF;

  RETURN FALSE;
END;
$$;

-- ── 2. RLS sur transactions ───────────────────────────────────

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: tenant only"     ON transactions;
DROP POLICY IF EXISTS "transactions: financial read"  ON transactions;
DROP POLICY IF EXISTS "transactions: financial write" ON transactions;

CREATE POLICY "transactions: financial read" ON transactions
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

CREATE POLICY "transactions: financial write" ON transactions
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

-- ── 3. RLS sur journal_entries ────────────────────────────────

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries: tenant only"     ON journal_entries;
DROP POLICY IF EXISTS "journal_entries: financial read"  ON journal_entries;
DROP POLICY IF EXISTS "journal_entries: financial write" ON journal_entries;

CREATE POLICY "journal_entries: financial read" ON journal_entries
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

CREATE POLICY "journal_entries: financial write" ON journal_entries
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

-- ── 4. RLS sur chart_of_accounts ─────────────────────────────

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chart_of_accounts: tenant only"     ON chart_of_accounts;
DROP POLICY IF EXISTS "chart_of_accounts: financial read"  ON chart_of_accounts;
DROP POLICY IF EXISTS "chart_of_accounts: financial write" ON chart_of_accounts;

-- Lecture : tout membre du tenant (plan comptable = référentiel)
CREATE POLICY "chart_of_accounts: tenant read" ON chart_of_accounts
  FOR SELECT USING (tenant_id = get_my_tenant_id());

-- Écriture : financiers uniquement
CREATE POLICY "chart_of_accounts: financial write" ON chart_of_accounts
  FOR INSERT WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

CREATE POLICY "chart_of_accounts: financial update" ON chart_of_accounts
  FOR UPDATE USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

CREATE POLICY "chart_of_accounts: financial delete" ON chart_of_accounts
  FOR DELETE USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

-- ── 5. RLS sur fiscal_years ───────────────────────────────────

ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_years: financial"      ON fiscal_years;
DROP POLICY IF EXISTS "fiscal_years: tenant read"    ON fiscal_years;
DROP POLICY IF EXISTS "fiscal_years: financial write" ON fiscal_years;

CREATE POLICY "fiscal_years: tenant read" ON fiscal_years
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "fiscal_years: financial write" ON fiscal_years
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );

-- ── 6. RLS sur cost_centers ───────────────────────────────────

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_centers: tenant read"     ON cost_centers;
DROP POLICY IF EXISTS "cost_centers: financial write" ON cost_centers;

CREATE POLICY "cost_centers: tenant read" ON cost_centers
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "cost_centers: financial write" ON cost_centers
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND fn_is_user_financial()
  );
