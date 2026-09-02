-- ══════════════════════════════════════════════════════════════════════════════
-- WAVE 4A — VALIDATION RLS COMPLÈTE
-- Prouve que les protections multi-tenant fonctionnent réellement.
--
-- MODE D'EMPLOI (4 étapes dans Supabase SQL Editor) :
--   1. Exécuter la SECTION A  → vérifie que les policies existent
--   2. Exécuter la SECTION B  → affiche les UUIDs de 2 tenants réels
--   3. Remplacer dans SECTION C :
--        <USER_A>    → user_id du tenant A (colonne user_id section B)
--        <TENANT_B>  → id du tenant B      (colonne tenant_id section B)
--   4. Exécuter chaque bloc SECTION C → résultat attendu : 0 lignes / refus
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION A — AUDIT DES POLICIES RLS
-- Exécuter tel quel (ne nécessite aucun UUID)
-- Résultat attendu : toutes les tables listées ont au moins 1 policy
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  p.tablename                                          AS "Table",
  CASE WHEN p.rowsecurity THEN '✓ ACTIVE' ELSE '✗ INACTIVE' END  AS "RLS",
  string_agg(pol.policyname, ', ' ORDER BY pol.policyname)        AS "Policies",
  string_agg(DISTINCT pol.cmd,     ', ' ORDER BY pol.cmd)         AS "Ops couvertes"
FROM pg_tables p
LEFT JOIN pg_policies pol
       ON pol.schemaname = p.schemaname
      AND pol.tablename  = p.tablename
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    -- ── Éducation ──────────────────────────────
    'etudiants',
    'notes_etudiants',
    'paiements_scolaires',
    'absences_etudiants',
    'recrutements_ecole',
    -- ── Recrutement ────────────────────────────
    'candidatures',
    'entretiens',
    -- ── Cabinet Juridique ──────────────────────
    'cabinet_affaires',
    'cabinet_audiences',
    -- ── Assurance ──────────────────────────────
    'ass_partenaires',
    'ass_produits'
  )
GROUP BY p.tablename, p.rowsecurity
ORDER BY p.tablename;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION B — INVENTAIRE : 2 TENANTS AVEC DONNÉES
-- Exécuter pour obtenir les UUIDs à utiliser dans la Section C
-- Copier : user_id (colonne 1) = USER_A, tenant_id (colonne 2) = TENANT_B
-- (choisir deux lignes avec tenant_id DIFFÉRENTS)
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  p.user_id,
  p.tenant_id,
  t.nom               AS tenant_nom,
  (SELECT count(*) FROM etudiants   WHERE tenant_id = t.id) AS nb_etudiants,
  (SELECT count(*) FROM candidatures WHERE tenant_id = t.id) AS nb_candidatures,
  (SELECT count(*) FROM ass_produits WHERE tenant_id = t.id) AS nb_produits_ass
FROM profiles p
JOIN tenants  t ON t.id = p.tenant_id
WHERE p.user_id IS NOT NULL
ORDER BY t.created_at
LIMIT 6;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION C — SIMULATIONS D'ATTAQUES CROSS-TENANT
--
-- Avant de lancer : remplacer dans chaque bloc :
--   <USER_A>    → user_id du Tenant A  (UUID)
--   <TENANT_B>  → id      du Tenant B  (UUID)
--
-- Chaque bloc est indépendant (BEGIN … ROLLBACK).
-- Aucune modification n'est commitée.
-- Résultat attendu partout : 0 lignes ou erreur RLS.
-- ══════════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────────
-- C-01 · LECTURE CROSS-TENANT · étudiants
-- Scénario : Tenant A essaie de lire les étudiants de Tenant B
-- Attendu  : 0 ligne
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "etudiants_tenant_B_visibles_par_A  [attendu=0]"
  FROM etudiants
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-02 · LECTURE CROSS-TENANT · notes_etudiants
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "notes_tenant_B_visibles_par_A  [attendu=0]"
  FROM notes_etudiants
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-03 · LECTURE CROSS-TENANT · paiements_scolaires
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "paiements_scolaires_tenant_B_visibles_par_A  [attendu=0]"
  FROM paiements_scolaires
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-04 · LECTURE CROSS-TENANT · absences_etudiants
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "absences_tenant_B_visibles_par_A  [attendu=0]"
  FROM absences_etudiants
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-05 · INSERTION CROSS-TENANT · etudiants
-- Scénario : Tenant A essaie d'insérer un étudiant avec tenant_id = Tenant B
-- Attendu  : 0 ligne insérée (WITH CHECK RLS bloque)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  INSERT INTO etudiants (tenant_id, nom, prenom, statut)
  VALUES ('<TENANT_B>', 'ATTAQUE', 'cross-tenant', 'actif');

  -- Si on arrive ici : vérifier que la ligne n'existe pas avec le bon tenant
  SELECT count(*) AS "insertion_cross_tenant_reussie  [attendu=0]"
  FROM etudiants
  WHERE nom = 'ATTAQUE' AND tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-06 · UPDATE CROSS-TENANT · etudiants
-- Scénario : Tenant A essaie de modifier un étudiant appartenant à Tenant B
-- Attendu  : 0 ligne modifiée
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE etudiants
    SET statut = 'suspendu'
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "etudiants_tenant_B_modifies_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-07 · DELETE CROSS-TENANT · etudiants
-- Scénario : Tenant A essaie de supprimer un étudiant de Tenant B
-- Attendu  : 0 ligne supprimée
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH deleted AS (
    DELETE FROM etudiants
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "etudiants_tenant_B_supprimes_par_A  [attendu=0]"
  FROM deleted;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-08 · LECTURE CROSS-TENANT · candidatures
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "candidatures_tenant_B_visibles_par_A  [attendu=0]"
  FROM candidatures
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-09 · UPDATE CROSS-TENANT · candidatures
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE candidatures
    SET statut = 'retenu'
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "candidatures_tenant_B_modifiees_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-10 · LECTURE CROSS-TENANT · entretiens
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "entretiens_tenant_B_visibles_par_A  [attendu=0]"
  FROM entretiens
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-11 · UPDATE CROSS-TENANT · entretiens
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE entretiens
    SET statut = 'annule'
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "entretiens_tenant_B_modifies_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-12 · LECTURE CROSS-TENANT · cabinet_affaires
-- (La colonne pivot est cabinet_tenant_id, pas tenant_id)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "affaires_tenant_B_visibles_par_A  [attendu=0]"
  FROM cabinet_affaires
  WHERE cabinet_tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-13 · INSERTION CROSS-TENANT · cabinet_affaires
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  INSERT INTO cabinet_affaires (cabinet_tenant_id, reference, intitule, client_nom)
  VALUES ('<TENANT_B>', 'ATK-001', 'Attaque cross-tenant', 'Hacker');

  SELECT count(*) AS "affaires_cross_tenant_inserees  [attendu=0]"
  FROM cabinet_affaires
  WHERE reference = 'ATK-001' AND cabinet_tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-14 · UPDATE CROSS-TENANT · cabinet_affaires
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE cabinet_affaires
    SET statut = 'archive'
    WHERE cabinet_tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "affaires_tenant_B_modifiees_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-15 · LECTURE CROSS-TENANT · ass_produits (Assurance)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  SELECT count(*) AS "produits_ass_tenant_B_visibles_par_A  [attendu=0]"
  FROM ass_produits
  WHERE tenant_id = '<TENANT_B>';
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-16 · UPDATE CROSS-TENANT · ass_produits (Assurance)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE ass_produits
    SET actif = false
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "produits_ass_tenant_B_modifies_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-17 · DELETE CROSS-TENANT · ass_produits (Assurance)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH deleted AS (
    DELETE FROM ass_produits
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "produits_ass_tenant_B_supprimes_par_A  [attendu=0]"
  FROM deleted;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-18 · UPDATE CROSS-TENANT · ass_partenaires (Assurance)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE ass_partenaires
    SET actif = false
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "partenaires_ass_tenant_B_modifies_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ──────────────────────────────────────────────────────────────────────────────
-- C-19 · UPDATE CROSS-TENANT · recrutements_ecole (RH École)
-- ──────────────────────────────────────────────────────────────────────────────
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"<USER_A>","role":"authenticated"}';

  WITH updated AS (
    UPDATE recrutements_ecole
    SET statut = 'ferme'
    WHERE tenant_id = '<TENANT_B>'
    RETURNING id
  )
  SELECT count(*) AS "recrutements_ecole_tenant_B_modifies_par_A  [attendu=0]"
  FROM updated;
ROLLBACK;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION D — RAPPORT AUTOMATIQUE FINAL
-- Exécuter après toutes les sections (ne nécessite aucun UUID)
-- Affiche le statut complet de chaque table
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  t.tablename                                                     AS "Table",
  CASE WHEN t.rowsecurity THEN '✓' ELSE '✗ MANQUE' END          AS "RLS",
  COALESCE(count(pol.policyname)::TEXT, '0')                     AS "Nb policies",
  COALESCE(
    string_agg(pol.cmd, ',' ORDER BY pol.cmd),
    '⚠ AUCUNE'
  )                                                              AS "Opérations",
  CASE
    WHEN NOT t.rowsecurity            THEN '✗ CRITIQUE — RLS désactivé'
    WHEN count(pol.policyname) = 0    THEN '✗ CRITIQUE — 0 policy'
    WHEN string_agg(pol.cmd,',') LIKE '%ALL%'        THEN '✓ Protégée (ALL)'
    WHEN string_agg(pol.cmd,',') LIKE '%SELECT%'
     AND string_agg(pol.cmd,',') LIKE '%UPDATE%'
     AND string_agg(pol.cmd,',') LIKE '%DELETE%'     THEN '✓ Protégée (S/U/D)'
    ELSE '⚠ Vérifier couverture ops'
  END                                                            AS "Statut"
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
ORDER BY
  CASE WHEN NOT t.rowsecurity THEN 0
       WHEN count(pol.policyname) = 0 THEN 1
       ELSE 2
  END,
  t.tablename;
