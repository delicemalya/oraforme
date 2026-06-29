-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA TEST — AMD FINANCE
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ⚡ À EXÉCUTER dans Supabase SQL Editor (onglet SQL)
-- ⚠️  PAS une migration de schéma — données de test uniquement
--
-- Produit pour AMD FINANCE :
--   2 comptes bancaires  (BGFI + LCB)
--   1 caisse principale
--   6 factures (4 payées + 2 envoyées) — consulting financier OHADA/Congo
--   6 transactions entrees (règlements reçus)
--
-- TVA Congo : HT × 18% = TVA · TVA × 5% = CA · TTC = HT + TVA + CA
-- Idempotent : relancer sans risque — vérifie avant d'insérer.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tid UUID;
  v_fac_id UUID;
BEGIN

  -- ── 1. Trouver le tenant AMD FINANCE ──────────────────────────────────────
  SELECT id INTO v_tid
  FROM tenants
  WHERE nom_entreprise ILIKE '%amd%' OR nom_entreprise ILIKE '%finance%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'Tenant AMD FINANCE introuvable (cherche nom_entreprise ILIKE %%amd%% ou %%finance%%)';
  END IF;
  RAISE NOTICE 'Tenant AMD FINANCE trouvé : %', v_tid;

  -- ── 2. Comptes bancaires ──────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM comptes_bancaires WHERE tenant_id = v_tid) THEN
    INSERT INTO comptes_bancaires (tenant_id, banque, intitule, numero_compte, solde) VALUES
      (v_tid, 'BGFI Bank Congo',  'Compte exploitation BGFI — AMD Finance', '521001', 12500000),
      (v_tid, 'LCB Congo',        'Compte courant LCB — AMD Finance',        '521002',  5750000);
    RAISE NOTICE '2 comptes bancaires créés';
  ELSE
    RAISE NOTICE 'Comptes bancaires déjà présents — skip';
  END IF;

  -- ── 3. Caisse ─────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM caisses WHERE tenant_id = v_tid) THEN
    INSERT INTO caisses (tenant_id, nom, numero_compte, solde)
    VALUES (v_tid, 'Caisse principale AMD Finance', '571000', 850000);
    RAISE NOTICE '1 caisse créée';
  ELSE
    RAISE NOTICE 'Caisse déjà présente — skip';
  END IF;

  -- ── 4. Factures ───────────────────────────────────────────────────────────
  -- TVA Congo : TVA = HT × 0.18 · CA = TVA × 0.05 · TTC = HT + TVA + CA

  -- Facture 1 — Audit comptable OHADA — PAYÉE — jan 2026
  -- HT 3 500 000 → TVA 630 000 → CA 31 500 → TTC 4 161 500
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-001') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-001', 'SUNU Assurances Congo', 'SUNU Assurances Congo',
      3500000, 3500000, 630000, 31500, 4161500,
      'payee', '2026-01-10', '2026-02-10', 'facture'
    ) RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture AMD-2026-001 créée (payée) : %', v_fac_id;
  END IF;

  -- Facture 2 — Conseil fiscal IS/TVA — PAYÉE — fév 2026
  -- HT 2 000 000 → TVA 360 000 → CA 18 000 → TTC 2 378 000
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-002') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-002', 'BGFI Bank Congo', 'BGFI Bank Congo',
      2000000, 2000000, 360000, 18000, 2378000,
      'payee', '2026-02-15', '2026-03-15', 'facture'
    ) RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture AMD-2026-002 créée (payée) : %', v_fac_id;
  END IF;

  -- Facture 3 — Expertise OHADA restructuration — PAYÉE — mar 2026
  -- HT 4 500 000 → TVA 810 000 → CA 40 500 → TTC 5 350 500
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-003') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-003', 'Ministère des Finances CG', 'Ministère des Finances CG',
      4500000, 4500000, 810000, 40500, 5350500,
      'payee', '2026-03-05', '2026-04-05', 'facture'
    ) RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture AMD-2026-003 créée (payée) : %', v_fac_id;
  END IF;

  -- Facture 4 — Formation comptabilité SYSCOHADA — PAYÉE — avr 2026
  -- HT 1 500 000 → TVA 270 000 → CA 13 500 → TTC 1 783 500
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-004') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-004', 'LCB Congo', 'LCB Congo',
      1500000, 1500000, 270000, 13500, 1783500,
      'payee', '2026-04-12', '2026-05-12', 'facture'
    ) RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture AMD-2026-004 créée (payée) : %', v_fac_id;
  END IF;

  -- Facture 5 — Assistance fiscale CNSS — ENVOYÉE (non payée) — mai 2026
  -- HT 2 500 000 → TVA 450 000 → CA 22 500 → TTC 2 972 500
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-005') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-005', 'CNSS Congo', 'CNSS Congo',
      2500000, 2500000, 450000, 22500, 2972500,
      'envoyee', '2026-05-20', '2026-06-20', 'facture'
    );
    RAISE NOTICE 'Facture AMD-2026-005 créée (envoyée)';
  END IF;

  -- Facture 6 — Revue procédures RH — ENVOYÉE (non payée) — juin 2026
  -- HT 3 000 000 → TVA 540 000 → CA 27 000 → TTC 3 567 000
  IF NOT EXISTS (SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = 'AMD-2026-006') THEN
    INSERT INTO factures (
      tenant_id, invoice_number, client_name, client_nom,
      subtotal, montant_ht, tva_montant, ca, total,
      statut, date, due_date, type
    ) VALUES (
      v_tid, 'AMD-2026-006', 'Bolloré Logistics Congo', 'Bolloré Logistics Congo',
      3000000, 3000000, 540000, 27000, 3567000,
      'envoyee', '2026-06-10', '2026-07-10', 'facture'
    );
    RAISE NOTICE 'Facture AMD-2026-006 créée (envoyée)';
  END IF;

  -- ── 5. Transactions entrees (règlements reçus) ────────────────────────────
  -- Correspond aux 4 factures payées + 2 autres encaissements divers

  IF NOT EXISTS (SELECT 1 FROM transactions WHERE tenant_id = v_tid AND type = 'entree') THEN

    -- Règlement Facture 001 — SUNU Assurances
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Honoraires conseil', 4161500,
      '2026-01-25', 'virement', 'facture',
      'Règlement AMD-2026-001 — SUNU Assurances Congo'
    );

    -- Règlement Facture 002 — BGFI Bank
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Honoraires conseil', 2378000,
      '2026-03-01', 'virement', 'facture',
      'Règlement AMD-2026-002 — BGFI Bank Congo'
    );

    -- Règlement Facture 003 — Ministère des Finances
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Honoraires conseil', 5350500,
      '2026-03-28', 'virement', 'facture',
      'Règlement AMD-2026-003 — Ministère des Finances CG'
    );

    -- Règlement Facture 004 — LCB Congo
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Honoraires conseil', 1783500,
      '2026-05-03', 'virement', 'facture',
      'Règlement AMD-2026-004 — LCB Congo'
    );

    -- Encaissement divers — acompte sur mission mai
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Acomptes clients', 1000000,
      '2026-05-15', 'virement', 'acompte',
      'Acompte 50% — Mission assistance fiscale CNSS'
    );

    -- Remboursement de frais client
    INSERT INTO transactions (
      tenant_id, type, categorie, montant,
      date_operation, moyen_paiement, source, libelle
    ) VALUES (
      v_tid, 'entree', 'Remboursements', 350000,
      '2026-06-05', 'especes', 'remboursement',
      'Remboursement frais déplacement — mission Bolloré'
    );

    RAISE NOTICE '6 transactions entrees créées';
  ELSE
    RAISE NOTICE 'Transactions entrees déjà présentes — skip';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'SEED AMD FINANCE terminé avec succès';
  RAISE NOTICE 'Trésorerie attendue : 18 250 000 FCFA (banque) + 850 000 FCFA (caisse)';
  RAISE NOTICE 'CA attendu (factures payées TTC) : 13 673 500 FCFA';
  RAISE NOTICE 'Créances clients (non payées) : 6 539 500 FCFA';
  RAISE NOTICE '═══════════════════════════════════════════════';

END;
$$;
