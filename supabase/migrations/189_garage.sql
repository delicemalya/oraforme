-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 189 — Secteur Garage (refonte 2026-11)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Périmètre MVP : véhicules, ordres de réparation (OR), lignes pièces +
-- main-d'œuvre, facturation atomique.
--
-- Réutilise l'existant, ne réimplémente rien :
--   • clients            — fiche client CRM (lien optionnel)
--   • products / fn_stock_move — pièces détachées et sortie de stock
--   • factures / facture_lignes — la facture d'un OR est une facture standard,
--                          payée ensuite via le flux facturation (FAC-002)
--   • emit_accounting_event — FAC-001 (vente) + STK-002 (coût des pièces,
--                          601/311, mêmes comptes que VTE-001 séquence 7)
--
-- fn_garage_facturer_ordre est le point transactionnel unique : facture +
-- lignes + sorties de stock + écritures, ou rien. Même patron que
-- fn_create_vente_atomique (186) : statut 'processed' vérifié explicitement.
-- Exécutable uniquement par service_role (appelée par l'API serveur avec le
-- tenant de la session) — jamais par anon/authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Prérequis — échoue proprement (rien n'est créé) s'il en manque un ───
DO $$
DECLARE
  v_manquants TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regprocedure('public.get_my_tenant_id()') IS NULL THEN
    v_manquants := v_manquants || 'get_my_tenant_id() (118)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'fn_stock_move' AND p.pronargs >= 10) THEN
    v_manquants := v_manquants || 'fn_stock_move à 10+ paramètres (184/186)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'emit_accounting_event') THEN
    v_manquants := v_manquants || 'emit_accounting_event (138)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounting_event_rules WHERE event_type = 'FAC-001' AND status = 'active') THEN
    v_manquants := v_manquants || 'règle FAC-001 active (139)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounting_event_rules WHERE event_type = 'STK-002' AND status = 'active') THEN
    v_manquants := v_manquants || 'règle STK-002 active (147)';
  END IF;
  IF to_regclass('public.facture_lignes') IS NULL THEN
    v_manquants := v_manquants || 'table facture_lignes (172)';
  END IF;
  IF to_regclass('public.employes') IS NULL OR to_regclass('public.clients') IS NULL THEN
    v_manquants := v_manquants || 'tables clients / employes';
  END IF;

  IF array_length(v_manquants, 1) > 0 THEN
    RAISE EXCEPTION 'Migration 189 annulée — prérequis manquants : %', array_to_string(v_manquants, ', ');
  END IF;
END $$;

-- ── 1. Véhicules ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.garage_vehicules (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id              UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  proprietaire_nom       TEXT NOT NULL,
  proprietaire_telephone TEXT,
  immatriculation        TEXT NOT NULL,
  marque                 TEXT,
  modele                 TEXT,
  annee                  INT CHECK (annee IS NULL OR annee BETWEEN 1950 AND 2100),
  vin                    TEXT,
  couleur                TEXT,
  carburant              TEXT CHECK (carburant IS NULL OR carburant IN ('essence','diesel','hybride','electrique','gpl','autre')),
  kilometrage            INT CHECK (kilometrage IS NULL OR kilometrage >= 0),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, immatriculation)
);

CREATE INDEX IF NOT EXISTS idx_garage_vehicules_tenant ON public.garage_vehicules (tenant_id);

-- ── 2. Ordres de réparation ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.garage_ordres (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero             TEXT NOT NULL,
  vehicule_id        UUID NOT NULL REFERENCES public.garage_vehicules(id) ON DELETE RESTRICT,
  statut             TEXT NOT NULL DEFAULT 'ouvert'
                     CHECK (statut IN ('ouvert','en_cours','termine','facture','livre','annule')),
  date_entree        DATE NOT NULL DEFAULT CURRENT_DATE,
  date_sortie_prevue DATE,
  date_sortie        DATE,
  kilometrage_entree INT CHECK (kilometrage_entree IS NULL OR kilometrage_entree >= 0),
  symptomes          TEXT,
  diagnostic         TEXT,
  mecanicien_id      UUID REFERENCES public.employes(id) ON DELETE SET NULL,
  facture_id         UUID UNIQUE REFERENCES public.factures(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_garage_ordres_tenant_statut ON public.garage_ordres (tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_garage_ordres_vehicule ON public.garage_ordres (vehicule_id);

-- ── 3. Lignes d'OR (pièces / main-d'œuvre), prix HT ─────────────────────────
CREATE TABLE IF NOT EXISTS public.garage_ordre_lignes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ordre_id      UUID NOT NULL REFERENCES public.garage_ordres(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('piece','main_oeuvre')),
  product_id    UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  description   TEXT NOT NULL,
  quantite      NUMERIC(12,3) NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC(14,2) NOT NULL CHECK (prix_unitaire >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT garage_ligne_piece_produit CHECK (type <> 'piece' OR product_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_garage_lignes_ordre ON public.garage_ordre_lignes (ordre_id);

-- ── 4. RLS — isolation par tenant (même helper que 180) ─────────────────────
ALTER TABLE public.garage_vehicules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_ordres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_ordre_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garage_vehicules: tenant" ON public.garage_vehicules;
CREATE POLICY "garage_vehicules: tenant" ON public.garage_vehicules
  FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "garage_ordres: tenant" ON public.garage_ordres;
CREATE POLICY "garage_ordres: tenant" ON public.garage_ordres
  FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "garage_ordre_lignes: tenant" ON public.garage_ordre_lignes;
CREATE POLICY "garage_ordre_lignes: tenant" ON public.garage_ordre_lignes
  FOR ALL USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 5. Numéro d'OR : OR-AAAA-00001, séquentiel par tenant et par année ──────
CREATE OR REPLACE FUNCTION public.fn_garage_numero_ordre(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_annee TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_n     INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('garage_numero_' || p_tenant_id::TEXT));
  SELECT COALESCE(MAX(NULLIF(split_part(numero, '-', 3), '')::INT), 0) + 1
  INTO v_n
  FROM public.garage_ordres
  WHERE tenant_id = p_tenant_id AND numero LIKE 'OR-' || v_annee || '-%';
  RETURN 'OR-' || v_annee || '-' || lpad(v_n::TEXT, 5, '0');
END;
$$;

-- ── 6. Facturation atomique d'un OR ─────────────────────────────────────────
-- Montants HT/TVA/CA/TTC calculés côté serveur par le moteur fiscal central
-- (lib/fiscalite/engine-adapter) et revérifiés ici contre les lignes.
CREATE OR REPLACE FUNCTION public.fn_garage_facturer_ordre(
  p_tenant_id   UUID,
  p_ordre_id    UUID,
  p_montant_ht  NUMERIC,
  p_montant_tva NUMERIC,
  p_montant_ca  NUMERIC,
  p_montant_ttc NUMERIC,
  p_event_date  DATE,
  p_fiscal_year INT,
  p_country_code TEXT DEFAULT 'CG'
) RETURNS TABLE(facture_id UUID, replay BOOLEAN) LANGUAGE plpgsql AS $$
DECLARE
  v_ordre      public.garage_ordres%ROWTYPE;
  v_vehicule   public.garage_vehicules%ROWTYPE;
  v_ligne      public.garage_ordre_lignes%ROWTYPE;
  v_ht_calc    NUMERIC := 0;
  v_facture_id UUID;
  v_piece_num  TEXT;
  v_move_id    UUID;
  v_cout       NUMERIC;
  v_event_id   UUID;
  v_ae_status  TEXT;
  v_entier     BOOLEAN;
BEGIN
  -- Verrou de l'OR : deux facturations concurrentes se sérialisent ici.
  SELECT * INTO v_ordre FROM public.garage_ordres
  WHERE id = p_ordre_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordre de réparation introuvable pour ce tenant' USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotence : un OR déjà facturé renvoie sa facture, sans aucun effet.
  IF v_ordre.facture_id IS NOT NULL THEN
    RETURN QUERY SELECT v_ordre.facture_id, TRUE;
    RETURN;
  END IF;

  IF v_ordre.statut <> 'termine' THEN
    RAISE EXCEPTION 'Seul un OR terminé peut être facturé (statut actuel : %)', v_ordre.statut
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(round(quantite * prix_unitaire, 2)), 0) INTO v_ht_calc
  FROM public.garage_ordre_lignes WHERE ordre_id = p_ordre_id AND tenant_id = p_tenant_id;

  IF v_ht_calc <= 0 THEN
    RAISE EXCEPTION 'OR sans ligne facturable' USING ERRCODE = 'check_violation';
  END IF;
  IF abs(v_ht_calc - p_montant_ht) > 1 THEN
    RAISE EXCEPTION 'Montant HT incohérent : lignes % / reçu %', v_ht_calc, p_montant_ht
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_vehicule FROM public.garage_vehicules WHERE id = v_ordre.vehicule_id;
  v_piece_num := 'GAR-' || v_ordre.numero;

  -- Facture standard (mêmes colonnes que POST /api/factures).
  INSERT INTO public.factures (
    tenant_id, invoice_number, client_nom, client_phone, date,
    montant_ht, tva, ca, total, notes, statut, type
  ) VALUES (
    p_tenant_id, v_piece_num, v_vehicule.proprietaire_nom, v_vehicule.proprietaire_telephone, p_event_date,
    p_montant_ht, p_montant_tva, p_montant_ca, p_montant_ttc,
    'Ordre de réparation ' || v_ordre.numero || ' — ' || v_vehicule.immatriculation,
    'envoyee', 'facture'
  )
  RETURNING id INTO v_facture_id;

  FOR v_ligne IN
    SELECT * FROM public.garage_ordre_lignes
    WHERE ordre_id = p_ordre_id AND tenant_id = p_tenant_id
    ORDER BY type DESC, created_at
  LOOP
    -- facture_lignes.quantity est entière : une quantité fractionnaire
    -- (heures, litres) est portée sur une ligne unique au montant exact.
    v_entier := v_ligne.quantite = trunc(v_ligne.quantite);
    INSERT INTO public.facture_lignes (invoice_id, description, price, quantity, total)
    VALUES (
      v_facture_id,
      CASE WHEN v_entier THEN v_ligne.description
           ELSE v_ligne.description || ' (' || trim(to_char(v_ligne.quantite, 'FM999999990.###')) || ' × ' || v_ligne.prix_unitaire || ')' END,
      CASE WHEN v_entier THEN v_ligne.prix_unitaire ELSE round(v_ligne.quantite * v_ligne.prix_unitaire, 2) END,
      CASE WHEN v_entier THEN v_ligne.quantite::INT ELSE 1 END,
      round(v_ligne.quantite * v_ligne.prix_unitaire, 2)
    );

    IF v_ligne.type = 'piece' THEN
      -- Sortie de stock (lève une exception si stock insuffisant → tout annulé).
      v_move_id := fn_stock_move(
        p_tenant_id, v_ligne.product_id, 'sortie', v_ligne.quantite,
        NULL, NULL, v_ordre.numero, 'Garage ' || v_ordre.numero, NULL, NULL
      );

      SELECT round(v_ligne.quantite * COALESCE(prix_achat, 0), 2) INTO v_cout
      FROM public.products WHERE id = v_ligne.product_id AND tenant_id = p_tenant_id;

      IF COALESCE(v_cout, 0) > 0 THEN
        v_event_id := emit_accounting_event(
          p_tenant_id     => p_tenant_id,
          p_event_type    => 'STK-002',
          p_source_module => 'garage',
          p_source_table  => 'stock_movements',
          p_source_id     => v_move_id,
          p_montant_ht    => v_cout,
          p_montant_tva   => 0,
          p_montant_ttc   => v_cout,
          p_libelle       => 'Pièces ' || v_ordre.numero || ' — ' || v_ligne.description,
          p_date_event    => p_event_date,
          p_fiscal_year   => p_fiscal_year,
          p_metadata      => jsonb_build_object('reference', v_ordre.numero, 'ordre_id', p_ordre_id)
        );
        SELECT status INTO v_ae_status FROM accounting_events WHERE id = v_event_id;
        IF v_event_id IS NULL OR v_ae_status IS DISTINCT FROM 'processed' THEN
          RAISE EXCEPTION 'OR % : coût des pièces (STK-002) non comptabilisé (statut=%)',
            v_ordre.numero, COALESCE(v_ae_status, 'introuvable');
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Vente : FAC-001 (même metadata que POST /api/factures).
  v_event_id := emit_accounting_event(
    p_tenant_id     => p_tenant_id,
    p_event_type    => 'FAC-001',
    p_source_module => 'garage',
    p_source_table  => 'factures',
    p_source_id     => v_facture_id,
    p_montant_ht    => p_montant_ht,
    p_montant_tva   => p_montant_tva,
    p_montant_ttc   => p_montant_ttc,
    p_libelle       => 'Facture ' || v_piece_num || ' — ' || v_vehicule.proprietaire_nom,
    p_date_event    => p_event_date,
    p_fiscal_year   => p_fiscal_year,
    p_metadata      => jsonb_build_object(
      'piece_number', v_piece_num,
      'client_name',  v_vehicule.proprietaire_nom,
      'ca',           p_montant_ca,
      'country_code', COALESCE(NULLIF(p_country_code, ''), 'CG'),
      'ordre_id',     p_ordre_id
    )
  );
  SELECT status INTO v_ae_status FROM accounting_events WHERE id = v_event_id;
  IF v_event_id IS NULL OR v_ae_status IS DISTINCT FROM 'processed' THEN
    RAISE EXCEPTION 'OR % : facture (FAC-001) non comptabilisée (statut=%)',
      v_ordre.numero, COALESCE(v_ae_status, 'introuvable');
  END IF;

  UPDATE public.garage_ordres
  SET statut = 'facture', facture_id = v_facture_id, updated_at = now()
  WHERE id = p_ordre_id;

  RETURN QUERY SELECT v_facture_id, FALSE;
END;
$$;

COMMENT ON FUNCTION public.fn_garage_facturer_ordre IS
  'Facturation atomique d''un ordre de réparation garage : facture + lignes + sorties de stock (STK-002) + FAC-001, ou rien. Idempotente via garage_ordres.facture_id.';

-- Ces fonctions reçoivent p_tenant_id en paramètre : seul le serveur
-- (service_role, tenant lu depuis la session) peut les appeler.
REVOKE ALL ON FUNCTION public.fn_garage_numero_ordre(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_garage_facturer_ordre(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, DATE, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_garage_numero_ordre(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_garage_facturer_ordre(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, DATE, INT, TEXT) TO service_role;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VÉRIFICATION APRÈS APPLICATION (lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('garage_vehicules','garage_ordres','garage_ordre_lignes');
-- Attendu : 3 lignes, relrowsecurity = true.
--
-- SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'garage_%';
-- Attendu : 3 policies « … : tenant ».
--
-- SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS srv
--   FROM pg_proc p WHERE p.proname IN ('fn_garage_numero_ordre','fn_garage_facturer_ordre');
-- Attendu : auth = false, srv = true pour les deux.
--
-- -- Test fonctionnel (tenant de recette uniquement) : OR terminé avec une
-- -- pièce dont la quantité dépasse le stock → exception, et aucune ligne
-- -- créée dans factures / facture_lignes / stock_movements / accounting_events.

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- Les factures déjà émises depuis un OR restent (ce sont des factures
-- standard, comptabilisées) : seul le lien garage_ordres.facture_id disparaît.
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.fn_garage_facturer_ordre(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, DATE, INT, TEXT);
-- DROP FUNCTION IF EXISTS public.fn_garage_numero_ordre(UUID);
-- DROP TABLE IF EXISTS public.garage_ordre_lignes;
-- DROP TABLE IF EXISTS public.garage_ordres;
-- DROP TABLE IF EXISTS public.garage_vehicules;
-- COMMIT;
