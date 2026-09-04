-- Migration 173 — D2 : la quantité en stock dérive de stock_movements (ANO-C03)
--
-- Le module Stocks lit products.stock_actuel sur 14 pages et 7 sites la
-- recalculent côté navigateur. Cette colonne n'a jamais existé : aucune des
-- 172 migrations ne la crée sur products. La 050 déclare même un trigger
-- AFTER UPDATE OF stock_actuel ON products, sur une colonne inexistante, dont
-- le corps est vide. Le hub Stocks affiche donc en permanence 0 produit et
-- 0 franc de stock, sans message, parce que les pages font select('*') et ne
-- reçoivent jamais d'erreur.
--
-- Les 96 mouvements de stock_movements sont la seule donnée de stock réelle.
-- La quantité devient leur somme : exacte par construction, et seule forme
-- capable de porter les deux fonctionnalités déjà écrites que la colonne
-- scalaire rend indécidables, le stock par entrepôt et le stock à une date.
--
-- ── Le second défaut : get_product_stock() renvoie 0 pour tout ──────────────
-- 016_stock_full.sql:128 fait la somme sur les types 'IN', 'OUT' et
-- 'ADJUSTMENT', avec ELSE 0. Or les 050 et 051 ont remplacé la contrainte par
-- un vocabulaire français, et les 96 lignes de production sont 48 'reception'
-- et 48 'sortie'. Elles tombent donc toutes dans ELSE 0. En cascade :
-- GET /api/stock/[id] répond 0 pour tout produit, POST /api/stock/move refuse
-- toute sortie pour stock insuffisant, et la règle comptable STK-002, déclenchée
-- sur type = 'OUT' que la contrainte n'autorise plus, ne s'émet jamais : le
-- compte 311 du bilan ne bouge pas.
--
-- Le vocabulaire retenu est le français, celui de la contrainte active, des
-- 96 lignes et des 5 pages. fn_stock_sign() reconnaît aussi l'ancien
-- vocabulaire anglais pour rester correcte si des lignes historiques existent.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Colonnes de stock_movements que la 050 prévoyait
-- ─────────────────────────────────────────────────────────────────────────────
-- Les 5 pages du module écrivent unit_cost et notes, ajoutées par 050:306.
-- Les 96 lignes de production, écrites par scripts/seed-demo-data.ts:550,
-- n'emploient que les colonnes de la 016 : quantite, reference, note. Rien ne
-- garantit donc que la section stock_movements de la 050 ait été appliquée,
-- pas plus que sa section products. Ces deux ajouts sont idempotents.
--
-- note et notes coexistent et portent la même chose. note est conservée : elle
-- porte les données des 96 lignes. Le code écrit notes.

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Le sens d'un mouvement, défini à un seul endroit
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_stock_sign(p_type TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE p_type
    -- Entrées
    WHEN 'entree'     THEN  1
    WHEN 'reception'  THEN  1
    WHEN 'IN'         THEN  1
    -- Retour client : la marchandise revient en stock. Un retour fournisseur
    -- est écrit 'sortie', le sens ne peut pas dépendre d'une autre table.
    WHEN 'retour'     THEN  1
    -- Ajustement d'inventaire : la quantité porte elle-même son signe.
    WHEN 'ajustement' THEN  1
    WHEN 'ADJUSTMENT' THEN  1
    -- Sorties
    WHEN 'sortie'     THEN -1
    WHEN 'OUT'        THEN -1
    -- Transfert entre entrepôts : neutre sur le total, significatif par entrepôt.
    WHEN 'transfert'  THEN  0
    WHEN 'TRANSFER'   THEN  0
    ELSE 0
  END;
$fn$;

COMMENT ON FUNCTION fn_stock_sign IS
  'Sens d''un mouvement de stock. Seul endroit où le vocabulaire de stock_movements.type est interprété.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_product_stock() réalignée sur le vocabulaire réel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_product_stock(p_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT COALESCE(SUM(fn_stock_sign(type) * quantite), 0)
  FROM   stock_movements
  WHERE  product_id = p_id;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. v_products_stock — les 14 lecteurs ne changent qu'un nom de table
-- ─────────────────────────────────────────────────────────────────────────────
-- security_invoker : la vue applique la RLS de l'appelant sur products et
-- stock_movements, au lieu de celle de son propriétaire. Sans cette option,
-- la vue serait une passerelle inter-tenants.

DROP VIEW IF EXISTS v_products_stock;
CREATE VIEW v_products_stock
WITH (security_invoker = true)
AS
  SELECT p.*,
         COALESCE(m.stock_actuel, 0)::NUMERIC AS stock_actuel
  FROM   products p
  LEFT JOIN (
    SELECT product_id,
           SUM(fn_stock_sign(type) * quantite) AS stock_actuel
    FROM   stock_movements
    GROUP  BY product_id
  ) m ON m.product_id = p.id;

COMMENT ON VIEW v_products_stock IS
  'products augmentée de stock_actuel, somme des mouvements. products.stock_actuel n''a jamais existé comme colonne.';

REVOKE ALL   ON v_products_stock FROM anon;
GRANT  SELECT ON v_products_stock TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_stock_move() — point d'écriture unique, avec verrou
-- ─────────────────────────────────────────────────────────────────────────────
-- Le contrôle « stock suffisant » lu puis écrit depuis le navigateur laisse
-- passer deux sorties simultanées. Le verrou consultatif sérialise les
-- mouvements d'un même produit sans bloquer la ligne products ni interférer
-- avec ses policies.

CREATE OR REPLACE FUNCTION fn_stock_move(
  p_tenant_id    UUID,
  p_product_id   UUID,
  p_type         TEXT,
  p_quantite     NUMERIC,
  p_warehouse_id UUID    DEFAULT NULL,
  p_unit_cost    NUMERIC DEFAULT 0,
  p_reference    TEXT    DEFAULT NULL,
  p_notes        TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_sign  INTEGER;
  v_stock NUMERIC;
  v_id    UUID;
BEGIN
  IF fn_stock_sign(p_type) = 0 AND p_type NOT IN ('transfert', 'TRANSFER') THEN
    RAISE EXCEPTION 'Type de mouvement inconnu : %', p_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_quantite IS NULL OR (p_quantite <= 0 AND p_type NOT IN ('ajustement', 'ADJUSTMENT')) THEN
    RAISE EXCEPTION 'Quantité invalide : %', p_quantite
      USING ERRCODE = 'check_violation';
  END IF;

  -- Sérialise les mouvements concurrents du même produit.
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

  INSERT INTO stock_movements (
    tenant_id, product_id, warehouse_id, type, quantite, unit_cost, reference, notes
  ) VALUES (
    p_tenant_id, p_product_id, p_warehouse_id, p_type, p_quantite, p_unit_cost, p_reference, p_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

COMMENT ON FUNCTION fn_stock_move IS
  'Seul point d''écriture de stock_movements. Verrou consultatif par produit et refus du stock négatif.';

GRANT EXECUTE ON FUNCTION fn_stock_move TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Le trigger de la 050 sur une colonne inexistante
-- ─────────────────────────────────────────────────────────────────────────────
-- 050:358 déclare trg_products_check_stock AFTER UPDATE OF stock_actuel ON
-- products. La colonne n'existe pas et le corps de fn_check_stock_alerte()
-- est vide. S'il a été créé quelque part, il ne sert à rien.

DROP TRIGGER IF EXISTS trg_products_check_stock ON public.products;

DO $$
BEGIN
  RAISE NOTICE 'Migration 173 OK — fn_stock_sign, get_product_stock realignee, v_products_stock, fn_stock_move';
END $$;
