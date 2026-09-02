-- ══════════════════════════════════════════════════════════════════════════════
-- WAVE 4A — RAPPORT CONSOLIDÉ RLS
-- Ce script génère le rapport final automatiquement.
-- Exécuter après avoir appliqué la migration 120.
-- Ne nécessite aucun UUID.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Vue d'ensemble : policies actives ──────────────────────────────────────

WITH modules AS (
  SELECT unnest(ARRAY[
    'etudiants','notes_etudiants','paiements_scolaires',
    'absences_etudiants','recrutements_ecole',
    'candidatures','entretiens',
    'cabinet_affaires','cabinet_audiences',
    'ass_partenaires','ass_produits'
  ]) AS tablename
),
policy_status AS (
  SELECT
    m.tablename,
    COALESCE(t.rowsecurity, false)    AS rls_active,
    count(pol.policyname)             AS nb_policies,
    bool_or(pol.cmd = 'ALL')          AS has_all,
    bool_or(pol.cmd = 'SELECT')       AS has_select,
    bool_or(pol.cmd = 'INSERT')       AS has_insert,
    bool_or(pol.cmd = 'UPDATE')       AS has_update,
    bool_or(pol.cmd = 'DELETE')       AS has_delete
  FROM modules m
  LEFT JOIN pg_tables t
         ON t.schemaname = 'public' AND t.tablename = m.tablename
  LEFT JOIN pg_policies pol
         ON pol.schemaname = 'public' AND pol.tablename = m.tablename
  GROUP BY m.tablename, t.rowsecurity
)
SELECT
  ps.tablename                                                    AS "Table",
  CASE WHEN rls_active THEN '✓' ELSE '✗' END                    AS "RLS",
  nb_policies::TEXT                                              AS "Policies",
  CASE
    WHEN NOT rls_active             THEN '✗ FAILLE CRITIQUE'
    WHEN nb_policies = 0            THEN '✗ FAILLE CRITIQUE'
    WHEN has_all                    THEN '✓ SÉCURISÉ'
    WHEN has_select AND has_update
         AND has_delete             THEN '✓ SÉCURISÉ'
    WHEN has_select                 THEN '⚠ Lecture seule protégée'
    ELSE                                 '✗ INSUFFISANT'
  END                                                            AS "Résultat",
  CASE
    WHEN has_all     THEN 'ALL'
    ELSE concat_ws(', ',
      CASE WHEN has_select THEN 'SELECT' END,
      CASE WHEN has_insert THEN 'INSERT' END,
      CASE WHEN has_update THEN 'UPDATE' END,
      CASE WHEN has_delete THEN 'DELETE' END
    )
  END                                                            AS "Ops couvertes"
FROM policy_status ps
ORDER BY
  CASE WHEN NOT rls_active THEN 0 WHEN nb_policies = 0 THEN 1 ELSE 2 END,
  tablename;


-- ── 2. Texte policy exact pour chaque table ───────────────────────────────────

SELECT
  tablename                                                       AS "Table",
  policyname                                                      AS "Policy",
  cmd                                                            AS "Op",
  qual                                                           AS "USING (lecture/modif)",
  with_check                                                     AS "WITH CHECK (écriture)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'etudiants','notes_etudiants','paiements_scolaires',
    'absences_etudiants','recrutements_ecole',
    'candidatures','entretiens',
    'cabinet_affaires','cabinet_audiences',
    'ass_partenaires','ass_produits'
  )
ORDER BY tablename, policyname;


-- ── 3. Comptage données par tenant ────────────────────────────────────────────
-- Prouve que les données sont bien isolées entre tenants.

SELECT
  t.nom_entreprise                                               AS "Tenant",
  t.id                                                           AS "tenant_id",
  (SELECT count(*) FROM etudiants         WHERE tenant_id = t.id)  AS "Étudiants",
  (SELECT count(*) FROM notes_etudiants   WHERE tenant_id = t.id)  AS "Notes",
  (SELECT count(*) FROM candidatures      WHERE tenant_id = t.id)  AS "Candidatures",
  (SELECT count(*) FROM entretiens        WHERE tenant_id = t.id)  AS "Entretiens",
  (SELECT count(*) FROM cabinet_affaires  WHERE cabinet_tenant_id = t.id) AS "Affaires",
  (SELECT count(*) FROM ass_produits      WHERE tenant_id = t.id)  AS "Produits ass.",
  (SELECT count(*) FROM ass_partenaires   WHERE tenant_id = t.id)  AS "Partenaires ass."
FROM tenants t
ORDER BY t.created_at
LIMIT 10;


-- ── 4. Conclusion automatique ─────────────────────────────────────────────────

WITH per_table AS (
  SELECT
    t.tablename,
    t.rowsecurity,
    count(pol.policyname) AS nb_policies
  FROM pg_tables t
  LEFT JOIN pg_policies pol
         ON pol.schemaname = t.schemaname
        AND pol.tablename  = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'etudiants','notes_etudiants','paiements_scolaires',
      'absences_etudiants','recrutements_ecole',
      'candidatures','entretiens',
      'cabinet_affaires','cabinet_audiences',
      'ass_partenaires','ass_produits'
    )
  GROUP BY t.tablename, t.rowsecurity
),
totaux AS (
  SELECT
    count(*) FILTER (WHERE NOT rowsecurity) AS nb_rls_off,
    count(*) FILTER (WHERE nb_policies = 0) AS nb_no_policy
  FROM per_table
)
SELECT
  CASE
    WHEN nb_rls_off = 0 AND nb_no_policy = 0
    THEN '✓ VALIDÉ — Aucune opération cross-tenant possible sur les 11 tables Wave 4A.'
    ELSE format(
      '✗ FAILLES DÉTECTÉES — %s table(s) sans RLS, %s table(s) sans policy.',
      nb_rls_off, nb_no_policy
    )
  END AS "CONCLUSION WAVE 4A"
FROM totaux;
