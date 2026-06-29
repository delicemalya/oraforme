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
  -- Idempotence : on vérifie par client_nom + montant_ht + statut
  -- (invoice_number peut ne pas exister selon les migrations appliquées)
  -- TVA Congo : TVA = HT × 0.18 · CA = TVA × 0.05 · TTC = HT + TVA + CA

  -- Facture 1 — Audit comptable OHADA — PAYÉE — jan 2026
  -- HT 3 500 000 → TVA 630 000 → CA 31 500 → TTC 4 161 500
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'SUNU Assurances Congo' AND montant_ht = 3500000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'SUNU Assurances Congo', 3500000, 18, 4161500, 'payee', '2026-01-10', '2026-02-10')
    RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture 1 créée (payée — SUNU) : %', v_fac_id;
  END IF;

  -- Facture 2 — Conseil fiscal IS/TVA — PAYÉE — fév 2026
  -- HT 2 000 000 → TVA 360 000 → CA 18 000 → TTC 2 378 000
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'BGFI Bank Congo' AND montant_ht = 2000000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'BGFI Bank Congo', 2000000, 18, 2378000, 'payee', '2026-02-15', '2026-03-15')
    RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture 2 créée (payée — BGFI) : %', v_fac_id;
  END IF;

  -- Facture 3 — Expertise OHADA restructuration — PAYÉE — mar 2026
  -- HT 4 500 000 → TVA 810 000 → CA 40 500 → TTC 5 350 500
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'Ministere des Finances CG' AND montant_ht = 4500000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'Ministere des Finances CG', 4500000, 18, 5350500, 'payee', '2026-03-05', '2026-04-05')
    RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture 3 créée (payée — Min.Finances) : %', v_fac_id;
  END IF;

  -- Facture 4 — Formation comptabilité SYSCOHADA — PAYÉE — avr 2026
  -- HT 1 500 000 → TVA 270 000 → CA 13 500 → TTC 1 783 500
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'LCB Congo' AND montant_ht = 1500000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'LCB Congo', 1500000, 18, 1783500, 'payee', '2026-04-12', '2026-05-12')
    RETURNING id INTO v_fac_id;
    RAISE NOTICE 'Facture 4 créée (payée — LCB) : %', v_fac_id;
  END IF;

  -- Facture 5 — Assistance fiscale CNSS — ENVOYÉE (non payée) — mai 2026
  -- HT 2 500 000 → TVA 450 000 → CA 22 500 → TTC 2 972 500
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'CNSS Congo' AND montant_ht = 2500000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'CNSS Congo', 2500000, 18, 2972500, 'envoyee', '2026-05-20', '2026-06-20');
    RAISE NOTICE 'Facture 5 créée (envoyée — CNSS)';
  END IF;

  -- Facture 6 — Revue procédures RH — ENVOYÉE (non payée) — juin 2026
  -- HT 3 000 000 → TVA 540 000 → CA 27 000 → TTC 3 567 000
  IF NOT EXISTS (
    SELECT 1 FROM factures
    WHERE tenant_id = v_tid AND client_nom = 'Bollore Logistics Congo' AND montant_ht = 3000000
  ) THEN
    INSERT INTO factures (tenant_id, client_nom, montant_ht, tva, total, statut, date, due_date)
    VALUES (v_tid, 'Bollore Logistics Congo', 3000000, 18, 3567000, 'envoyee', '2026-06-10', '2026-07-10');
    RAISE NOTICE 'Facture 6 créée (envoyée — Bollore)';
  END IF;

  -- ── 5. Transactions entrees (règlements reçus) ────────────────────────────
  -- Correspond aux 4 factures payées + 2 autres encaissements divers

  IF NOT EXISTS (SELECT 1 FROM transactions WHERE tenant_id = v_tid AND type = 'entree') THEN

    -- Règlement Facture 001 — SUNU Assurances
    -- COLONNES RÉELLES transactions : date, mode_paiement, description/libelle, source
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Honoraires conseil', 4161500, '2026-01-25', 'virement', 'facture', 'Reglement SUNU Assurances Congo');

    -- Règlement Facture 002 — BGFI Bank
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Honoraires conseil', 2378000, '2026-03-01', 'virement', 'facture', 'Reglement BGFI Bank Congo');

    -- Règlement Facture 003 — Ministère des Finances
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Honoraires conseil', 5350500, '2026-03-28', 'virement', 'facture', 'Reglement Ministere des Finances CG');

    -- Règlement Facture 004 — LCB Congo
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Honoraires conseil', 1783500, '2026-05-03', 'virement', 'facture', 'Reglement LCB Congo');

    -- Acompte sur mission mai
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Acomptes clients', 1000000, '2026-05-15', 'virement', 'acompte', 'Acompte 50pct mission CNSS');

    -- Remboursement frais client
    INSERT INTO transactions (tenant_id, type, categorie, montant, date, mode_paiement, source, description)
    VALUES (v_tid, 'entree', 'Remboursements', 350000, '2026-06-05', 'especes', 'remboursement', 'Remboursement frais deplacement Bollore');

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
