-- ════════════════════════════════════════════════════════════════════════════
-- Migration 108 — get_entity_kpis() : KPI consolidés par entité (groupe)
-- Utilisé par le dashboard Société drill-down (Phase 3)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Fonction get_entity_kpis(p_tenant_id) ──────────────────────────────────
-- SECURITY DEFINER : contourne le RLS pour lire les données d'un tenant fils
-- Sécurité : vérifie que p_tenant_id ∈ get_my_group_tenant_ids() avant tout accès

CREATE OR REPLACE FUNCTION public.get_entity_kpis(p_tenant_id UUID)
RETURNS TABLE (
  ca_ytd                 NUMERIC,
  ca_mois                NUMERIC,
  tresorerie_nette       NUMERIC,
  nb_employes            INTEGER,
  nb_factures_en_attente INTEGER,
  nb_factures_payees_ytd INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Contrôle d'accès ────────────────────────────────────────────────────────
  -- Le demandeur doit appartenir à un groupe qui inclut p_tenant_id
  IF NOT (p_tenant_id = ANY(get_my_group_tenant_ids())) THEN
    RAISE EXCEPTION 'Accès refusé au tenant %', p_tenant_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    -- CA année en cours (factures payées depuis le 1er janvier)
    COALESCE((
      SELECT SUM(f.total)
      FROM   factures f
      WHERE  f.tenant_id = p_tenant_id
        AND  f.statut    = 'payee'
        AND  f.created_at >= date_trunc('year', now())
    ), 0) AS ca_ytd,

    -- CA mois en cours (factures payées depuis le 1er du mois)
    COALESCE((
      SELECT SUM(f.total)
      FROM   factures f
      WHERE  f.tenant_id = p_tenant_id
        AND  f.statut    = 'payee'
        AND  f.created_at >= date_trunc('month', now())
    ), 0) AS ca_mois,

    -- Trésorerie nette = solde comptes bancaires + solde caisses
    COALESCE((
      SELECT SUM(cb.solde)
      FROM   comptes_bancaires cb
      WHERE  cb.tenant_id = p_tenant_id
    ), 0)
    +
    COALESCE((
      SELECT SUM(c.solde)
      FROM   caisses c
      WHERE  c.tenant_id = p_tenant_id
    ), 0) AS tresorerie_nette,

    -- Effectifs actifs
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM   employes e
      WHERE  e.tenant_id = p_tenant_id
        AND  e.statut    = 'actif'
    ), 0) AS nb_employes,

    -- Factures en attente (envoyées ou en retard)
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM   factures f
      WHERE  f.tenant_id = p_tenant_id
        AND  f.statut IN ('envoyee', 'retard')
    ), 0) AS nb_factures_en_attente,

    -- Nombre de factures payées cette année
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM   factures f
      WHERE  f.tenant_id = p_tenant_id
        AND  f.statut    = 'payee'
        AND  f.created_at >= date_trunc('year', now())
    ), 0) AS nb_factures_payees_ytd;

END;
$$;

-- ── 2. Accorder EXECUTE à authenticated ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_entity_kpis(UUID) TO authenticated;

-- ── 3. Commentaire ────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.get_entity_kpis(UUID) IS
  'KPI consolidés pour une entité du groupe. SECURITY DEFINER — vérifie que le demandeur '
  'appartient à un groupe incluant p_tenant_id via entity_group_members.';

-- ── 4. Smoke test (rollback si objet manquant) ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.proname = 'get_entity_kpis'
  ) THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: get_entity_kpis manquant';
  END IF;
  RAISE NOTICE 'Migration 108 — get_entity_kpis OK';
END;
$$;
