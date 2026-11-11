-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 186 — C6-POST-REVIEW-FIX : vente atomique (A1) + reverse stock
-- idempotent (C1)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission C6-POST-REVIEW-FIX · docs/C6-PRE-PRODUCTION-REVIEW.md (anomalies A1,
-- C1 — A2/B1 n'ont besoin d'aucun objet SQL nouveau, voir docs/C6-POST-REVIEW-FIX.md)
--
-- DÉPENDANCES : nécessite 184 (fn_stock_move à 10 paramètres + colonnes
-- origine/purchase_item_id) et 185 (ventes.montant_ht/tva/ca/idempotency_key,
-- VTE-001/VTE-002) déjà appliquées. Les trois migrations (184, 185, 186)
-- restent PRÉPARÉES, NON EXÉCUTÉES — cette mission n'exécute rien.
--
-- A1 — ATOMICITÉ (docs/C6-PRE-PRODUCTION-REVIEW.md §5, anomalie A1/A2 de
-- cette mission) : PostgREST n'expose pas de transaction multi-étapes depuis
-- TypeScript. La correction N'EST PAS une fausse transaction côté frontend
-- (try/catch + compensation) — c'est une fonction PL/pgSQL UNIQUE
-- (fn_create_vente_atomique) qui exécute vente + lignes + fn_stock_move×N +
-- emit_accounting_event comme un seul appel RPC. Un appel RPC PostgREST
-- s'exécute comme une seule transaction Postgres implicite : toute exception
-- non interceptée à l'intérieur de la fonction annule TOUT ce que la fonction
-- a fait (ROLLBACK réel, pas une compensation applicative). fn_stock_move est
-- réutilisée telle quelle (pas de second moteur de stock) ; emit_accounting_
-- event est réutilisée telle quelle (pas de second moteur comptable) — cette
-- migration ajoute uniquement l'ORCHESTRATION manquante, pas une nouvelle
-- logique métier.
--
-- Point découvert en écrivant cette migration, pas supposé : fn_ae_execute_
-- event (migration 138) intercepte SES PROPRES exceptions
-- (`EXCEPTION WHEN OTHERS THEN UPDATE ... status='error' ... RAISE WARNING`,
-- pas de RAISE) — un échec interne au moteur comptable ne remonte donc
-- JAMAIS comme une exception Postgres à l'appelant d'emit_accounting_event,
-- ni au trigger qui l'invoque. Appeler emit_accounting_event depuis
-- fn_create_vente_atomique ne suffit donc PAS à garantir qu'un échec
-- comptable fasse échouer la transaction : il faut relire explicitement
-- accounting_events.status après l'appel et lever une exception soi-même si
-- le statut n'est pas 'processed'. C'est exactement le mécanisme manquant
-- qui permettait l'anomalie A2 (règlement sans vente comptable aboutie) —
-- corrigé ici au niveau DB, et côté règlement dans
-- app/api/sales/[id]/paiement/route.ts (pas d'objet SQL requis pour A2).
--
-- C1 — REVERSE STOCK IDEMPOTENT (docs/C6-PRE-PRODUCTION-REVIEW.md §11,
-- anomalie C1) : fn_reverse_accounting_event est déjà idempotente côté
-- comptable (accounting_event_extournes.UNIQUE(original_event_id), migration
-- 138 — vérifié, pas réaffirmé) mais AUCUN mécanisme équivalent n'existe côté
-- stock. Plutôt que créer un second système de reverse, on applique le MÊME
-- patron déjà prouvé : une colonne de lien + une contrainte UNIQUE partielle,
-- et le code applicatif retente l'INSERT et traite la violation 23505 comme
-- un no-op (identique au patron idempotency_key de la migration 185 — jamais
-- un SELECT préalable non protégé).
--
-- ⚠️ PRÉPARÉE, NON EXÉCUTÉE.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER (après revue et validation métier explicite)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Garde-fou
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'reversed_movement_id'
  ) THEN
    RAISE EXCEPTION 'stock_movements.reversed_movement_id existe déjà — état différent du diagnostic C6-POST-REVIEW-FIX, ne pas appliquer aveuglément';
  END IF;
END $$;

-- 1. C1 — Colonne de lien retour→mouvement d'origine, additive (BOI-010 reste
--    inchangée, aucune colonne de 184 modifiée ici).
ALTER TABLE stock_movements
  ADD COLUMN reversed_movement_id UUID NULL REFERENCES stock_movements(id);

COMMENT ON COLUMN stock_movements.reversed_movement_id IS
  'Renseigné UNIQUEMENT sur un mouvement type=retour émis par /api/sales/:id/reverse — pointe vers le mouvement sortie original qu''il annule. La contrainte UNIQUE ci-dessous garantit qu''un même mouvement original ne peut être retourné qu''une seule fois (C6-POST-REVIEW-FIX, anomalie C1).';

-- Idempotence côté stock, même patron que idx_ventes_tenant_idempotency
-- (migration 185) : contrainte UNIQUE partielle comme autorité, pas un
-- SELECT préalable non protégé.
CREATE UNIQUE INDEX idx_stock_movements_reversed_movement
  ON stock_movements (reversed_movement_id)
  WHERE reversed_movement_id IS NOT NULL;

-- 2. fn_stock_move — extension rétrocompatible (10 → 11 paramètres, tous les
--    appelants existants qui ne passent pas p_reversed_movement_id continuent
--    de fonctionner à l'identique, DEFAULT NULL). Même précaution de
--    signature que la migration 184 (BOI-010B) : DROP explicite de la
--    signature exacte à 10 paramètres avant CREATE OR REPLACE à 11, pour ne
--    pas créer une surcharge ambiguë.
--
-- NOTE : le corps complet est repris de la migration 184 (origine/
-- purchase_item_id, correctif B1 inclus) — AUCUNE logique de 184 n'est
-- modifiée ici au-delà de l'ajout du 11e paramètre et de son usage. Si 184
-- est amendée de nouveau avant exécution, reporter le changement ici aussi.
DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION fn_stock_move(
  p_tenant_id            UUID,
  p_product_id           UUID,
  p_type                 TEXT,
  p_quantite             NUMERIC,
  p_warehouse_id         UUID DEFAULT NULL,
  p_unit_cost            NUMERIC DEFAULT NULL,
  p_reference            TEXT DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_origine              TEXT DEFAULT NULL,
  p_purchase_item_id     UUID DEFAULT NULL,
  p_reversed_movement_id UUID DEFAULT NULL
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

  -- B1 (reportée de 184) — purchase_item_id doit appartenir au tenant appelant.
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

  -- C1 : l'INSERT ci-dessous est l'autorité d'idempotence pour un retour —
  -- idx_stock_movements_reversed_movement lève 23505 si p_reversed_movement_id
  -- a déjà été retourné. L'appelant (app/api/sales/[id]/reverse/route.ts)
  -- traite ce code comme un no-op, jamais une erreur bloquante.
  INSERT INTO stock_movements (
    tenant_id, product_id, warehouse_id, type, quantite, unit_cost, reference, notes,
    origine, purchase_item_id, reversed_movement_id
  ) VALUES (
    p_tenant_id, p_product_id, p_warehouse_id, p_type, p_quantite, p_unit_cost, p_reference, p_notes,
    p_origine, p_purchase_item_id, p_reversed_movement_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 3. A1 — fn_create_vente_atomique : point transactionnel unique pour la
--    création d'une vente (vente + lignes + stock×N + comptabilité). Remplace
--    les 4 appels PostgREST séquentiels de app/api/sales/route.ts par UN
--    appel RPC. Toute exception non interceptée annule la totalité (vente,
--    lignes, et tous les mouvements de stock déjà insérés pour les lignes
--    précédentes de CETTE vente) — c'est la propriété que ni le try/catch ni
--    la compensation applicative précédente ne pouvaient garantir.
CREATE OR REPLACE FUNCTION fn_create_vente_atomique(
  p_tenant_id         UUID,
  p_lignes            JSONB,   -- [{produit_id, produit_nom, qte, prix, sous_total, origine, purchase_item_id}]
  p_mode_paiement     TEXT,
  p_statut_paiement   TEXT,
  p_destinataire      TEXT,
  p_warehouse_id      UUID,
  p_idempotency_key   UUID,
  p_total_ttc         NUMERIC,
  p_montant_ht        NUMERIC,
  p_montant_tva       NUMERIC,
  p_montant_ca        NUMERIC,
  p_cout_marchandises NUMERIC,
  p_country_code      TEXT,
  p_event_date        DATE,
  p_fiscal_year       INT
) RETURNS TABLE(vente_id UUID, replay BOOLEAN) LANGUAGE plpgsql AS $$
DECLARE
  v_vente_id  UUID;
  v_existing  UUID;
  v_ligne     JSONB;
  v_event_id  UUID;
  v_ae_status TEXT;
BEGIN
  -- Idempotence — même patron que 185 (INSERT d'abord, ON CONFLICT tranche,
  -- jamais un SELECT préalable non protégé). Si conflit : AUCUN autre effet
  -- (ni lignes, ni stock, ni comptabilité) — la vente existante est relue
  -- telle quelle, exactement le comportement attendu d'un replay.
  INSERT INTO ventes (
    tenant_id, total, montant_ht, montant_tva, montant_ca,
    mode_paiement, statut_paiement, destinataire, nb_articles, statut, idempotency_key
  ) VALUES (
    p_tenant_id, p_total_ttc, p_montant_ht, p_montant_tva, p_montant_ca,
    p_mode_paiement, p_statut_paiement, p_destinataire,
    jsonb_array_length(p_lignes), 'validee', p_idempotency_key
  )
  ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_vente_id;

  IF v_vente_id IS NULL THEN
    SELECT id INTO v_existing FROM ventes
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_existing, TRUE;
    RETURN;
  END IF;

  -- Lignes + stock — toute exception ici (stock insuffisant, origine
  -- invalide, purchase_item_id hors tenant) annule l'INSERT ventes ci-dessus
  -- ET tous les mouvements de stock déjà insérés pour les lignes précédentes
  -- de cette boucle : c'est la correction de l'anomalie A1 (plus de stock
  -- orphelin, plus de vente partielle).
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO vente_lignes (vente_id, produit_id, produit_nom, qte, prix, sous_total)
    VALUES (
      v_vente_id,
      (v_ligne->>'produit_id')::UUID,
      v_ligne->>'produit_nom',
      (v_ligne->>'qte')::NUMERIC,
      (v_ligne->>'prix')::NUMERIC,
      (v_ligne->>'sous_total')::NUMERIC
    );

    PERFORM fn_stock_move(
      p_tenant_id,
      (v_ligne->>'produit_id')::UUID,
      'sortie',
      (v_ligne->>'qte')::NUMERIC,
      p_warehouse_id,
      NULL,
      v_vente_id::TEXT,
      'Vente ' || v_vente_id::TEXT,
      v_ligne->>'origine',
      CASE WHEN v_ligne->>'purchase_item_id' IS NULL THEN NULL ELSE (v_ligne->>'purchase_item_id')::UUID END
    );
  END LOOP;

  -- Comptabilité — emit_accounting_event() + trigger synchrone (migration
  -- 138). Voir note d'en-tête : un échec INTERNE à fn_ae_execute_event ne
  -- lève PAS d'exception (elle les intercepte elle-même) — on vérifie donc
  -- explicitement accounting_events.status plutôt que de faire confiance à
  -- l'absence d'erreur de l'appel. Un statut différent de 'processed' lève
  -- une exception ICI, ce qui annule TOUT (vente, lignes, stock) — cohérent
  -- avec le principe « vente + lignes + stock + comptabilité » comme un seul
  -- tout atomique, demandé par cette mission.
  v_event_id := emit_accounting_event(
    p_tenant_id     => p_tenant_id,
    p_event_type    => 'VTE-001',
    p_source_module => 'commerce',
    p_source_table  => 'ventes',
    p_source_id     => v_vente_id,
    p_montant_ht    => p_montant_ht,
    p_montant_tva   => p_montant_tva,
    p_montant_ttc   => p_total_ttc,
    p_libelle       => 'Vente ' || v_vente_id::TEXT ||
                        CASE WHEN p_destinataire IS NOT NULL THEN ' — ' || p_destinataire ELSE '' END,
    p_date_event    => p_event_date,
    p_fiscal_year   => p_fiscal_year,
    p_metadata      => jsonb_build_object(
      'mode_paiement', p_mode_paiement,
      'cout_marchandises', p_cout_marchandises,
      'ca', p_montant_ca,
      'destinataire', p_destinataire,
      'lignes', p_lignes,
      'country_code', p_country_code,
      'reference', v_vente_id
    )
  );
  -- C6-185-CA-FIX (docs/C6-185-CA-FIX-VALIDATION.md) : 'ca' ajouté à la
  -- metadata — sans cette clé, les séquences 3/6 de VTE-001 (corrigées pour
  -- lire 'metadata.ca', même patron que FAC-001/139) ne résoudraient jamais
  -- aucun montant, quelle que soit la correction apportée côté règles. Seul
  -- ajout touchant cette fonction : aucun paramètre, aucune colonne,
  -- aucune étape de l'orchestration atomique/idempotente n'est modifiée —
  -- p_montant_ca existait déjà comme paramètre (utilisé pour
  -- ventes.montant_ca), il manquait seulement sa propagation vers la
  -- metadata lue par le moteur comptable.

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Vente % : émission VTE-001 refusée (événement déjà en vol ou traité pour cette source_id)', v_vente_id;
  END IF;

  SELECT status INTO v_ae_status FROM accounting_events WHERE id = v_event_id;
  IF v_ae_status IS DISTINCT FROM 'processed' THEN
    RAISE EXCEPTION 'Vente % : comptabilisation VTE-001 non aboutie (statut=%)', v_vente_id, COALESCE(v_ae_status, 'introuvable');
  END IF;

  RETURN QUERY SELECT v_vente_id, FALSE;
END;
$$;

COMMENT ON FUNCTION fn_create_vente_atomique IS
  'Point transactionnel unique pour la création d''une vente (C6-POST-REVIEW-FIX, anomalie A1). Remplace les appels séquentiels vente/lignes/stock/comptabilité par UNE transaction Postgres réelle — toute exception interne annule la totalité.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 186 OK — reverse stock idempotent (reversed_movement_id) ; fn_stock_move à 11 paramètres ; fn_create_vente_atomique créée';
END $$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (lecture seule, à exécuter après application)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public'
--   AND table_name='stock_movements' AND column_name='reversed_movement_id';
-- Attendu : 1 ligne.
--
-- SELECT pg_get_functiondef('fn_stock_move'::regproc);
-- Attendu : signature à 11 paramètres, p_reversed_movement_id en dernier,
-- DEFAULT NULL, et le bloc de vérification purchase_item_id/tenant présent.
--
-- SELECT pg_get_functiondef('fn_create_vente_atomique'::regproc);
-- Attendu : fonction présente, RETURNS TABLE(vente_id UUID, replay BOOLEAN).
--
-- -- Test fonctionnel réel (non exécuté ici, voir plan de validation) :
-- -- 1) appeler fn_create_vente_atomique avec 3 lignes dont la 3e demande une
-- --    quantité supérieure au stock disponible → doit lever une exception,
-- --    et SELECT COUNT(*) FROM ventes/vente_lignes/stock_movements pour
-- --    cette tentative doit retourner 0 partout.
-- -- 2) appeler fn_stock_move(type='retour', p_reversed_movement_id=X) deux
-- --    fois avec le même X → la 2e doit échouer avec 23505.

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP FUNCTION IF EXISTS fn_create_vente_atomique(UUID, JSONB, TEXT, TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, INT);
-- DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID);
-- -- Recréer fn_stock_move à sa définition de la migration 184 (10 paramètres,
-- -- avec le correctif B1 mais sans p_reversed_movement_id).
-- DROP INDEX IF EXISTS idx_stock_movements_reversed_movement;
-- ALTER TABLE stock_movements DROP COLUMN IF EXISTS reversed_movement_id;
-- COMMIT;
