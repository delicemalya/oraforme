-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 184 — Stock par provenance (BOI-010)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission P0-BOI-010 · docs/BOI-010-IMPLEMENTATION-STOCK-PROVENANCE.md
-- Prérequis conception : BOI-006, BOI-007 (STOCK_PROVENANCE_MODEL = D),
-- BOI-008, BOI-009 (décision métier : CHOIX MANUEL).
--
-- CONTEXTE
--   stock_movements reste l'unique source de vérité du stock (aucune seconde
--   balance créée). Cette migration ajoute deux colonnes additives et une vue
--   dérivée, sans toucher aux tables/vues/fonctions existantes au-delà d'une
--   extension rétrocompatible de fn_stock_move (nouveaux paramètres optionnels
--   avec DEFAULT NULL — tout appelant existant continue de fonctionner à
--   l'identique).
--
--   0 ligne dans stock_movements au moment de la préparation (vérifié via
--   PostgREST, BOI-004 à BOI-010) — migration strictement additive, aucun
--   risque de perte de données, aucun backfill (une origine passée ne se
--   devine pas, BOI-007 §9 / BOI-010 §11).
--
-- ⚠️ PRÉPARÉE, NON EXÉCUTÉE. Ordre de déploiement obligatoire si validée :
--    cette migration DOIT être appliquée avant le déploiement du code qui
--    l'accompagne (app/api/stocks/purchases/route.ts, app/api/stock/move/
--    route.ts, app/dashboard/commerce/page.tsx) — ce code appelle
--    fn_stock_move avec des paramètres (p_origine, p_purchase_item_id) qui
--    n'existent pas tant que cette migration n'est pas appliquée.
--
-- AMENDEMENT C6-POST-REVIEW-FIX (2026-10-06) — anomalie B1 de
-- docs/C6-PRE-PRODUCTION-REVIEW.md §6/§9 : fn_stock_move n'isolait pas
-- p_purchase_item_id par tenant (IDOR potentielle). Corrigé dans le corps de
-- fn_stock_move ci-dessous avant toute exécution — cette migration n'a
-- jamais été appliquée, il n'y a donc pas de seconde migration de correctif
-- à écrire séparément. Le verdict 184_READY_FOR_EXECUTION=YES de la revue
-- portait sur la version SANS ce correctif ; cette version amendée doit être
-- relue avant exécution (changement localisé, pas une ré-ouverture complète
-- du dossier).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER (après revue et validation métier explicite)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fous
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'origine'
  ) THEN
    RAISE EXCEPTION 'stock_movements.origine existe déjà — état différent du diagnostic BOI-007/010, ne pas appliquer aveuglément';
  END IF;
END $$;

-- 1. Colonnes additives sur stock_movements (BOI-007 §1/§12, BOI-010 §1)
ALTER TABLE stock_movements
  ADD COLUMN origine TEXT NULL,
  ADD COLUMN purchase_item_id UUID NULL REFERENCES purchase_items(id);

-- Valeurs contrôlées : les 3 provenances confirmées (BOI-006 §4) + NULL pour
-- tout mouvement dont l'origine n'est pas documentée (historique, ou tout
-- appelant qui ne renseigne pas ce paramètre optionnel). Jamais de valeur
-- inventée pour l'historique (BOI-007 §9, BOI-010 §11).
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_origine_check
  CHECK (origine IS NULL OR origine IN ('achat_fournisseur', 'production_locale', 'import_direct'));

-- 2. Index (BOI-007 §12)
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_origine ON stock_movements(product_id, origine);
CREATE INDEX IF NOT EXISTS idx_stock_movements_purchase_item ON stock_movements(purchase_item_id);

-- 3. fn_stock_move — extension rétrocompatible (BOI-010 §1, §6)
--    Nouveaux paramètres p_origine / p_purchase_item_id, tous deux
--    DEFAULT NULL : tout appel existant (sans ces paramètres) continue de se
--    comporter exactement comme avant. Le contrôle anti-négatif GLOBAL
--    (par produit, déjà existant) n'est pas modifié. Un contrôle SUPPLÉMENTAIRE,
--    scopé à la provenance précise, s'ajoute UNIQUEMENT quand p_origine est
--    fourni sur un mouvement qui diminue le stock (v_sign < 0) — jamais de
--    bascule automatique vers une autre provenance si celle-ci est
--    insuffisante : le choix manuel (BOI-009) signifie que l'appelant a
--    explicitement désigné CETTE provenance, la demande est refusée si elle
--    ne suffit pas, point final.
--
-- BOI-010B — correction trouvée à la revue statique (aucune exécution
-- possible, MCP indisponible, donc revue de code seule) : PostgreSQL
-- n'identifie pas une fonction par son nom seul mais par (nom, types de
-- paramètres). L'ancienne fn_stock_move a 8 paramètres ; celle-ci en a 10.
-- Un simple CREATE OR REPLACE avec une liste de types différente NE
-- REMPLACE PAS la fonction existante — il crée un second fn_stock_move
-- SURCHARGÉ à côté de l'ancien. Un appel avec exactement les 8 paramètres
-- d'origine deviendrait alors AMBIGU (les deux signatures correspondent,
-- puisque les 2 nouveaux paramètres ont un DEFAULT), et PostgreSQL
-- refuserait l'appel avec une erreur « function is not unique ». Le DROP
-- explicite ci-dessous, sur l'ancienne signature exacte, garantit un
-- remplacement propre et unique plutôt qu'une surcharge dangereuse.
DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION fn_stock_move(
  p_tenant_id        UUID,
  p_product_id       UUID,
  p_type             TEXT,
  p_quantite         NUMERIC,
  p_warehouse_id     UUID DEFAULT NULL,
  p_unit_cost        NUMERIC DEFAULT NULL,
  p_reference        TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_origine          TEXT DEFAULT NULL,
  p_purchase_item_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_sign          INTEGER;
  v_stock         NUMERIC;
  v_stock_origine NUMERIC;
  v_id            UUID;
BEGIN
  IF fn_stock_sign(p_type) = 0 AND p_type NOT IN ('transfert', 'TRANSFER') THEN
    RAISE EXCEPTION 'Type de mouvement inconnu : %', p_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_quantite IS NULL OR (p_quantite <= 0 AND p_type NOT IN ('ajustement', 'ADJUSTMENT')) THEN
    RAISE EXCEPTION 'Quantité invalide : %', p_quantite
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_origine IS NOT NULL AND p_origine NOT IN ('achat_fournisseur', 'production_locale', 'import_direct') THEN
    RAISE EXCEPTION 'Origine inconnue : %', p_origine
      USING ERRCODE = 'check_violation';
  END IF;

  -- C6-POST-REVIEW-FIX / B1 — correction trouvée à C6-PRE-PRODUCTION-REVIEW.md
  -- §6 : p_purchase_item_id était accepté sans vérifier qu'il appartient au
  -- tenant appelant (IDOR potentielle si un appelant transmet l'UUID d'une
  -- ligne d'achat d'un autre tenant). fn_stock_move pouvant être appelée
  -- indépendamment de l'API (RPC exposée), la validation doit vivre ici,
  -- pas seulement côté route — défense en profondeur, même principe que la
  -- revalidation de p_origine ci-dessus.
  IF p_purchase_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM purchase_items pi
    JOIN purchases p ON p.id = pi.purchase_id
    WHERE pi.id = p_purchase_item_id AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'purchase_item_id % introuvable pour ce tenant', p_purchase_item_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT));

  v_sign := fn_stock_sign(p_type);

  SELECT COALESCE(SUM(fn_stock_sign(type) * quantite), 0)
  INTO   v_stock
  FROM   stock_movements
  WHERE  product_id = p_product_id;

  IF v_stock + v_sign * p_quantite < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant : % disponible, % demandé', v_stock, p_quantite
      USING ERRCODE = 'check_violation';
  END IF;

  -- BOI-010 : vérification supplémentaire scopée à la provenance déclarée,
  -- uniquement pour les mouvements qui diminuent le stock.
  IF p_origine IS NOT NULL AND v_sign < 0 THEN
    SELECT COALESCE(SUM(fn_stock_sign(type) * quantite), 0)
    INTO   v_stock_origine
    FROM   stock_movements
    WHERE  product_id = p_product_id AND origine = p_origine;

    IF v_stock_origine + v_sign * p_quantite < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour la provenance % : % disponible, % demandé',
        p_origine, v_stock_origine, p_quantite
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO stock_movements (
    tenant_id, product_id, warehouse_id, type, quantite, unit_cost, reference, notes,
    origine, purchase_item_id
  ) VALUES (
    p_tenant_id, p_product_id, p_warehouse_id, p_type, p_quantite, p_unit_cost, p_reference, p_notes,
    p_origine, p_purchase_item_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Vue dérivée — produit × entrepôt × origine (BOI-007 §10, BOI-010 §8)
--    Aucune seconde source de vérité : simple SELECT dérivé de
--    stock_movements, exactement le même mécanisme que v_products_stock
--    (qui reste totalement inchangée — 0 ligne modifiée, 0 consommateur
--    existant affecté). security_invoker=true : la RLS de products/
--    stock_movements s'applique normalement, isolation tenant garantie par
--    construction (§12).
CREATE OR REPLACE VIEW v_products_stock_par_origine AS
SELECT
  p.id          AS product_id,
  p.tenant_id,
  p.nom,
  m.warehouse_id,
  m.origine,
  SUM(fn_stock_sign(m.type) * m.quantite) AS quantite_disponible
FROM products p
JOIN stock_movements m ON m.product_id = p.id
WHERE m.origine IS NOT NULL
GROUP BY p.id, p.tenant_id, p.nom, m.warehouse_id, m.origine;

ALTER VIEW v_products_stock_par_origine SET (security_invoker = true);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (lecture seule, à exécuter après application)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='stock_movements'
--   AND column_name IN ('origine','purchase_item_id');
-- Attendu : les deux colonnes présentes.
--
-- SELECT pg_get_functiondef('fn_stock_move'::regproc);
-- Attendu : signature à 10 paramètres, p_origine/p_purchase_item_id en fin
-- avec DEFAULT NULL.
--
-- SELECT * FROM v_products_stock_par_origine LIMIT 1;
-- Attendu : 0 ligne (aucun mouvement n'a encore d'origine renseignée tant
-- que le code applicatif n'a pas été déployé après cette migration).

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP VIEW IF EXISTS v_products_stock_par_origine;
-- DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID);
-- -- Recréer fn_stock_move à sa définition BOI-004 (8 paramètres, sans
-- -- p_origine/p_purchase_item_id) — voir docs/BOI-004-REPAIR-PLAN-ACHATS-
-- -- STOCKS.md pour le corps de référence.
-- ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_origine_check;
-- ALTER TABLE stock_movements DROP COLUMN origine;
-- ALTER TABLE stock_movements DROP COLUMN purchase_item_id;
-- COMMIT;
