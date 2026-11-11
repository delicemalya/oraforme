-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 183 — Réparation Core Achats + Stocks (BOI-004)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission P0-BOI-004 · docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md
-- Prérequis diagnostic : docs/BOI-003-AUDIT-ACHATS-STOCKS.md
--
-- CONTEXTE
--   BOI-003 a trouvé trois colonnes fantômes référencées par du code réel
--   mais absentes du schéma (warehouses.actif, suppliers.actif,
--   suppliers.conditions_paiement), une fonction trigger référençant une
--   colonne inexistante (fn_stock_alert → NEW.quantite_min, colonne réelle
--   seuil_alerte), et une incohérence RLS sur stock_articles (auth_tenant_id()
--   sans garde ORDER BY/LIMIT, à la différence de get_my_tenant_id() utilisé
--   partout ailleurs — même défaut documenté dans project_multitenant_fix).
--
--   Toutes les tables concernées ont 0 ligne de données réelles au moment de
--   cette préparation (vérifié en lecture seule, BOI-003 §8) — migration
--   strictement additive/corrective, aucune donnée modifiée ou supprimée.
--
-- ⚠️ PRÉPARÉE, NON EXÉCUTÉE. À appliquer seulement après revue humaine
--    explicite (voir docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md, Étape 10).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER (après revue)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fous : n'appliquer que si le schéma est bien dans l'état diagnostiqué
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'actif'
  ) THEN
    RAISE EXCEPTION 'warehouses.actif existe déjà — état différent du diagnostic BOI-003, ne pas appliquer aveuglément';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'actif'
  ) THEN
    RAISE EXCEPTION 'suppliers.actif existe déjà — état différent du diagnostic BOI-003, ne pas appliquer aveuglément';
  END IF;
END $$;

-- 1. Colonnes fantômes référencées par du code réel (app/dashboard/stocks/**)
ALTER TABLE warehouses ADD COLUMN actif boolean NOT NULL DEFAULT true;
ALTER TABLE suppliers  ADD COLUMN actif boolean NOT NULL DEFAULT true;
ALTER TABLE suppliers  ADD COLUMN conditions_paiement text;

-- 2. fn_stock_alert() référence NEW.quantite_min (colonne inexistante sur
--    stock_articles) — corrigé vers seuil_alerte, colonne réelle. 0 ligne en
--    production aujourd'hui donc ce défaut n'a jamais été exercé, mais
--    déclencherait une erreur PL/pgSQL certaine dès le premier UPDATE réel.
CREATE OR REPLACE FUNCTION fn_stock_alert()
RETURNS trigger AS $$
BEGIN
  IF NEW.quantite < COALESCE(NEW.seuil_alerte, 5)
     AND (OLD.quantite IS NULL OR OLD.quantite >= COALESCE(NEW.seuil_alerte, 5)) THEN
    PERFORM fn_notify_broadcast(
      NEW.tenant_id,
      'Stock faible',
      NEW.nom || ' : ' || NEW.quantite || ' restant(s)',
      'stock_alert',
      '/dashboard/stocks'
    );
    INSERT INTO scheduled_tasks (tenant_id, task_type, payload, run_at)
    VALUES (
      NEW.tenant_id, 'stock_reorder',
      jsonb_build_object('article_id', NEW.id, 'nom', NEW.nom),
      now() + interval '2 hours'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. stock_articles RLS : auth_tenant_id() (sans ORDER BY/LIMIT) → même
--    incohérence que le bug multi-tenant déjà documenté ailleurs (mémoire
--    projet) ; alignée sur get_my_tenant_id(), utilisée par toutes les autres
--    tables du périmètre achats/stocks.
DROP POLICY IF EXISTS "stock_articles: select" ON stock_articles;
DROP POLICY IF EXISTS "stock_articles: insert" ON stock_articles;
DROP POLICY IF EXISTS "stock_articles: update" ON stock_articles;
DROP POLICY IF EXISTS "stock_articles: delete" ON stock_articles;

CREATE POLICY "stock_articles: select" ON stock_articles
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "stock_articles: insert" ON stock_articles
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "stock_articles: update" ON stock_articles
  FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "stock_articles: delete" ON stock_articles
  FOR DELETE USING (tenant_id = get_my_tenant_id());

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (lecture seule, à exécuter après application)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name IN ('warehouses','suppliers')
--   AND column_name IN ('actif','conditions_paiement');
-- Attendu : warehouses.actif, suppliers.actif, suppliers.conditions_paiement présents.
--
-- SELECT polname, qual FROM pg_policies WHERE tablename = 'stock_articles';
-- Attendu : 4 policies, toutes référençant get_my_tenant_id(), aucune auth_tenant_id().
--
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_stock_alert';
-- Attendu : référence NEW.seuil_alerte, plus aucune référence à quantite_min.

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- ALTER TABLE warehouses DROP COLUMN actif;
-- ALTER TABLE suppliers  DROP COLUMN actif;
-- ALTER TABLE suppliers  DROP COLUMN conditions_paiement;
-- -- fn_stock_alert() et les policies stock_articles : restaurer depuis la
-- -- définition précédente (voir docs/BOI-003-AUDIT-ACHATS-STOCKS.md pour le
-- -- corps original de fn_stock_alert() et auth_tenant_id()).
-- COMMIT;
