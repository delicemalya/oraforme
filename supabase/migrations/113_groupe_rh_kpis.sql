-- ════════════════════════════════════════════════════════════════
-- Migration 113 — KPIs Groupe & Dashboard Consolidé
-- Étend la hiérarchie groupe avec snapshots KPI et métriques RH
-- ════════════════════════════════════════════════════════════════

-- ── 1. Table entity_kpi_snapshots (cache des KPI par entité) ─────────────────
-- Stocke un snapshot quotidien des KPI par entity.
-- Alimentée manuellement (bouton "Actualiser") ou via cron.

CREATE TABLE IF NOT EXISTS entity_kpi_snapshots (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date            DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- KPI Financiers
  ca_ytd                   NUMERIC     NOT NULL DEFAULT 0,
  ca_mois                  NUMERIC     NOT NULL DEFAULT 0,
  tresorerie_nette         NUMERIC     NOT NULL DEFAULT 0,
  nb_factures_en_attente   INT         NOT NULL DEFAULT 0,
  nb_factures_payees_ytd   INT         NOT NULL DEFAULT 0,

  -- KPI RH Généraux
  nb_employes              INT         NOT NULL DEFAULT 0,

  -- KPI Recrutement (secteur spécifique)
  nb_candidats_actifs      INT         NOT NULL DEFAULT 0,
  nb_missions_en_cours     INT         NOT NULL DEFAULT 0,
  nb_placements_mois       INT         NOT NULL DEFAULT 0,
  nb_contrats_actifs       INT         NOT NULL DEFAULT 0,
  nb_clients_actifs        INT         NOT NULL DEFAULT 0,
  nb_offres_actives        INT         NOT NULL DEFAULT 0,

  -- Score audit (calculé par migration 086)
  score_audit              INT         NOT NULL DEFAULT 0,

  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_eks_tenant_date
  ON entity_kpi_snapshots (tenant_id, snapshot_date DESC);

ALTER TABLE entity_kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Lecture : visible pour tous les membres du même groupe
DO $$ BEGIN
  CREATE POLICY "eks: groupe membres peuvent lire"
    ON entity_kpi_snapshots FOR SELECT
    USING (tenant_id = ANY(get_my_group_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Écriture : SECURITY DEFINER uniquement (via fn_refresh_entity_kpi_snapshot)
GRANT SELECT ON entity_kpi_snapshots TO authenticated;

COMMENT ON TABLE entity_kpi_snapshots IS
  'Snapshots quotidiens des KPI par entité du groupe. Alimentée par fn_refresh_entity_kpi_snapshot().';


-- ── 2. fn_refresh_entity_kpi_snapshot(p_tenant_id) ────────────────────────────
-- Calcule et upsert un snapshot KPI pour l''entité donnée.
-- SECURITY DEFINER : contourne RLS pour lire les données de l''entité.
-- Vérifie que p_tenant_id ∈ get_my_group_tenant_ids().

CREATE OR REPLACE FUNCTION public.fn_refresh_entity_kpi_snapshot(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ca_ytd                 NUMERIC := 0;
  v_ca_mois                NUMERIC := 0;
  v_tresorerie             NUMERIC := 0;
  v_nb_fact_attente        INT     := 0;
  v_nb_fact_payees_ytd     INT     := 0;
  v_nb_employes            INT     := 0;
  v_nb_candidats           INT     := 0;
  v_nb_missions            INT     := 0;
  v_nb_placements_mois     INT     := 0;
  v_nb_contrats            INT     := 0;
  v_nb_clients             INT     := 0;
  v_nb_offres              INT     := 0;
  v_score_audit            INT     := 0;
BEGIN
  -- Contrôle d'accès
  IF NOT (p_tenant_id = ANY(get_my_group_tenant_ids())) THEN
    RAISE EXCEPTION 'Accès refusé au tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- CA année en cours
  SELECT COALESCE(SUM(total), 0) INTO v_ca_ytd
  FROM   factures
  WHERE  tenant_id = p_tenant_id AND statut = 'payee'
    AND  created_at >= date_trunc('year', now());

  -- CA mois en cours
  SELECT COALESCE(SUM(total), 0) INTO v_ca_mois
  FROM   factures
  WHERE  tenant_id = p_tenant_id AND statut = 'payee'
    AND  created_at >= date_trunc('month', now());

  -- Trésorerie = comptes bancaires + caisses
  SELECT COALESCE(SUM(solde), 0) INTO v_tresorerie FROM comptes_bancaires WHERE tenant_id = p_tenant_id;
  SELECT v_tresorerie + COALESCE(SUM(solde), 0) INTO v_tresorerie FROM caisses WHERE tenant_id = p_tenant_id;

  -- Factures en attente
  SELECT COALESCE(COUNT(*), 0) INTO v_nb_fact_attente
  FROM   factures WHERE tenant_id = p_tenant_id AND statut IN ('envoyee', 'retard');

  -- Factures payées cette année
  SELECT COALESCE(COUNT(*), 0) INTO v_nb_fact_payees_ytd
  FROM   factures WHERE tenant_id = p_tenant_id AND statut = 'payee'
    AND  created_at >= date_trunc('year', now());

  -- Effectifs actifs
  SELECT COALESCE(COUNT(*), 0) INTO v_nb_employes
  FROM   employes WHERE tenant_id = p_tenant_id AND statut = 'actif';

  -- Candidats actifs (table candidats si secteur recrutement)
  SELECT COALESCE(COUNT(*), 0) INTO v_nb_candidats
  FROM   candidats WHERE tenant_id = p_tenant_id;

  -- Missions en cours (offres actives)
  SELECT COALESCE(COUNT(*), 0) INTO v_nb_offres
  FROM   offres_emploi WHERE tenant_id = p_tenant_id AND statut = 'active';

  -- Placements ce mois (from rh_placements)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rh_placements' AND table_schema = 'public') THEN
    SELECT COALESCE(COUNT(*), 0) INTO v_nb_placements_mois
    FROM   rh_placements WHERE tenant_id = p_tenant_id
      AND  created_at >= date_trunc('month', now());
  END IF;

  -- Contrats actifs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rh_contrats' AND table_schema = 'public') THEN
    SELECT COALESCE(COUNT(*), 0) INTO v_nb_contrats
    FROM   rh_contrats WHERE tenant_id = p_tenant_id AND statut = 'actif';
  END IF;

  -- Clients actifs (cabinet/crm)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
    SELECT COALESCE(COUNT(*), 0) INTO v_nb_clients
    FROM   clients WHERE tenant_id = p_tenant_id AND actif IS NOT FALSE;
  END IF;

  -- Score audit (heuristique simple : CA > 0 → 70, tréso > 0 → +20, effectifs > 0 → +10)
  v_score_audit :=
    CASE WHEN v_ca_ytd       > 0 THEN 40 ELSE 0 END +
    CASE WHEN v_tresorerie   > 0 THEN 30 ELSE 0 END +
    CASE WHEN v_nb_employes  > 0 THEN 20 ELSE 0 END +
    CASE WHEN v_nb_candidats > 0 THEN 10 ELSE 0 END;

  -- Upsert snapshot
  INSERT INTO entity_kpi_snapshots (
    tenant_id, snapshot_date,
    ca_ytd, ca_mois, tresorerie_nette, nb_factures_en_attente, nb_factures_payees_ytd,
    nb_employes, nb_candidats_actifs, nb_missions_en_cours,
    nb_placements_mois, nb_contrats_actifs, nb_clients_actifs, nb_offres_actives,
    score_audit, computed_at
  ) VALUES (
    p_tenant_id, CURRENT_DATE,
    v_ca_ytd, v_ca_mois, v_tresorerie, v_nb_fact_attente, v_nb_fact_payees_ytd,
    v_nb_employes, v_nb_candidats, v_nb_missions, v_nb_placements_mois,
    v_nb_contrats, v_nb_clients, v_nb_offres, v_score_audit, now()
  )
  ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
    ca_ytd                 = EXCLUDED.ca_ytd,
    ca_mois                = EXCLUDED.ca_mois,
    tresorerie_nette       = EXCLUDED.tresorerie_nette,
    nb_factures_en_attente = EXCLUDED.nb_factures_en_attente,
    nb_factures_payees_ytd = EXCLUDED.nb_factures_payees_ytd,
    nb_employes            = EXCLUDED.nb_employes,
    nb_candidats_actifs    = EXCLUDED.nb_candidats_actifs,
    nb_missions_en_cours   = EXCLUDED.nb_missions_en_cours,
    nb_placements_mois     = EXCLUDED.nb_placements_mois,
    nb_contrats_actifs     = EXCLUDED.nb_contrats_actifs,
    nb_clients_actifs      = EXCLUDED.nb_clients_actifs,
    nb_offres_actives      = EXCLUDED.nb_offres_actives,
    score_audit            = EXCLUDED.score_audit,
    computed_at            = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_refresh_entity_kpi_snapshot TO authenticated;

COMMENT ON FUNCTION public.fn_refresh_entity_kpi_snapshot IS
  'Calcule et upsert le snapshot KPI pour une entité du groupe. SECURITY DEFINER.';


-- ── 3. fn_refresh_group_snapshots() — refresh tout le groupe ─────────────────
-- Boucle sur tous les membres du groupe du tenant courant.

CREATE OR REPLACE FUNCTION public.fn_refresh_group_snapshots()
RETURNS TABLE(tenant_id UUID, ok BOOLEAN, err TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ids UUID[];
BEGIN
  v_ids := get_my_group_tenant_ids();

  FOREACH v_id IN ARRAY v_ids LOOP
    BEGIN
      PERFORM fn_refresh_entity_kpi_snapshot(v_id);
      tenant_id := v_id; ok := TRUE; err := NULL; RETURN NEXT;
    EXCEPTION WHEN others THEN
      tenant_id := v_id; ok := FALSE; err := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_refresh_group_snapshots TO authenticated;

COMMENT ON FUNCTION public.fn_refresh_group_snapshots IS
  'Rafraîchit les snapshots KPI pour tous les membres du groupe du tenant courant.';


-- ── 4. get_group_consolidated() — KPI consolidés du groupe ───────────────────
-- Agrège les snapshots les plus récents par entité.

CREATE OR REPLACE FUNCTION public.get_group_consolidated()
RETURNS TABLE (
  nb_entites             INT,
  total_ca_ytd           NUMERIC,
  total_ca_mois          NUMERIC,
  total_tresorerie       NUMERIC,
  total_employes         INT,
  total_candidats        INT,
  total_placements_mois  INT,
  total_offres           INT,
  total_contrats         INT,
  avg_score_audit        INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT s.tenant_id)::INT,
    COALESCE(SUM(s.ca_ytd),            0),
    COALESCE(SUM(s.ca_mois),           0),
    COALESCE(SUM(s.tresorerie_nette),  0),
    COALESCE(SUM(s.nb_employes),       0)::INT,
    COALESCE(SUM(s.nb_candidats_actifs),  0)::INT,
    COALESCE(SUM(s.nb_placements_mois),   0)::INT,
    COALESCE(SUM(s.nb_offres_actives),    0)::INT,
    COALESCE(SUM(s.nb_contrats_actifs),   0)::INT,
    COALESCE(AVG(s.score_audit),       0)::INT
  FROM entity_kpi_snapshots s
  WHERE s.tenant_id = ANY(get_my_group_tenant_ids())
    AND s.snapshot_date = (
      SELECT MAX(s2.snapshot_date)
      FROM entity_kpi_snapshots s2
      WHERE s2.tenant_id = s.tenant_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_consolidated TO authenticated;


-- ── 5. get_entities_with_kpis() — liste des entités + leurs KPIs ──────────────

CREATE OR REPLACE FUNCTION public.get_entities_with_kpis()
RETURNS TABLE (
  tenant_id              UUID,
  nom_entreprise         TEXT,
  type_entite            TEXT,
  pays                   TEXT,
  secteur_activite       TEXT,
  parent_tenant_id       UUID,
  depth                  INT,
  ordre_affichage        INT,
  allow_consolidation    BOOLEAN,
  ca_ytd                 NUMERIC,
  ca_mois                NUMERIC,
  tresorerie_nette       NUMERIC,
  nb_employes            INT,
  nb_candidats_actifs    INT,
  nb_placements_mois     INT,
  nb_offres_actives      INT,
  nb_contrats_actifs     INT,
  nb_clients_actifs      INT,
  score_audit            INT,
  snapshot_date          DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.nom_entreprise,
    t.type_entite,
    t.pays,
    t.secteur_activite,
    t.parent_tenant_id,
    COALESCE(get_entity_depth(t.id), 0)::INT,
    t.ordre_affichage,
    t.allow_consolidation,
    COALESCE(s.ca_ytd,            0),
    COALESCE(s.ca_mois,           0),
    COALESCE(s.tresorerie_nette,  0),
    COALESCE(s.nb_employes,       0)::INT,
    COALESCE(s.nb_candidats_actifs,  0)::INT,
    COALESCE(s.nb_placements_mois,   0)::INT,
    COALESCE(s.nb_offres_actives,    0)::INT,
    COALESCE(s.nb_contrats_actifs,   0)::INT,
    COALESCE(s.nb_clients_actifs,    0)::INT,
    COALESCE(s.score_audit,       0)::INT,
    s.snapshot_date
  FROM tenants t
  LEFT JOIN LATERAL (
    SELECT *
    FROM entity_kpi_snapshots eks
    WHERE eks.tenant_id = t.id
    ORDER BY eks.snapshot_date DESC
    LIMIT 1
  ) s ON TRUE
  WHERE t.id = ANY(get_my_group_tenant_ids())
  ORDER BY COALESCE(get_entity_depth(t.id), 0), t.ordre_affichage, t.nom_entreprise;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_entities_with_kpis TO authenticated;

COMMENT ON FUNCTION public.get_entities_with_kpis IS
  'Liste toutes les entités du groupe avec leurs KPIs depuis entity_kpi_snapshots.';


-- ── 6. Smoke test ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'entity_kpi_snapshots'
  ) THEN RAISE EXCEPTION 'entity_kpi_snapshots manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_refresh_entity_kpi_snapshot'
  ) THEN RAISE EXCEPTION 'fn_refresh_entity_kpi_snapshot manquante'; END IF;

  RAISE NOTICE '✅ Migration 113 — Groupe RH KPIs : OK';
END;
$$;
