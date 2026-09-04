-- ═════════════════════════════════════════════════════════════════════════════
-- SPRINT S-02 PHASE 3 — Données de démonstration Oraforme
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ⚡ BLOC À EXÉCUTER dans Supabase SQL Editor (onglet SQL)
--
-- Produit :
--   8 employés · 30 fournisseurs · 3 comptes bancaires
--   10 produits · 1 entrepôt · 96 mouvements de stock
--   192 factures (8/mois × 24 mois, 50 clients, statut envoyée/payée)
--   192 bulletins de paie (8 emp × 24 mois, CNSS 5,04 % + 20,285 %, IRPP Congo)
--    48 achats fournisseurs (2/mois × 24 mois)
--   192 transactions trésorerie (4 entrées + 4 sorties / mois)
--  1 400+ écritures journal (via moteur accounting_engine + trigger)
--
-- Idempotent : relancer sans risque — vérifie avant d'insérer.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tid          UUID;
  v_emp_ids      UUID[];
  v_fourn_ids    UUID[];
  v_prod_ids     UUID[];
  v_wh_id        UUID;
  v_fac_id       UUID;
  v_ach_id       UUID;
  v_bull_id      UUID;

  -- Calculs TVA Congo (HT → TVA 18 % → CA 5 %×TVA → TTC)
  v_ht           NUMERIC(14,2);
  v_tva          NUMERIC(14,2);
  v_ca           NUMERIC(14,2);
  v_ttc          NUMERIC(14,2);

  -- Calculs paie
  v_sal_base     NUMERIC(14,2);
  v_brut         NUMERIC(14,2);
  v_cnss_sal     NUMERIC(14,2);
  v_cnss_patro   NUMERIC(14,2);
  v_irpp         NUMERIC(14,2);
  v_net          NUMERIC(14,2);
  v_imposable    NUMERIC(14,2);
  v_emp_nom      TEXT;

  -- Itérateurs
  i    INT;
  j    INT;
  v_y  INT;
  v_m  INT;
  v_num  TEXT;
  v_nom  TEXT;
  v_date DATE;
  v_cnt  INT;

BEGIN

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Tenant (premier tenant créé)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT id INTO v_tid FROM tenants ORDER BY created_at LIMIT 1;
  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'Aucun tenant trouvé — créez un compte sur l''application d''abord.';
  END IF;
  RAISE NOTICE 'Tenant : %', v_tid;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Comptes bancaires & caisse
  -- ─────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM comptes_bancaires WHERE tenant_id = v_tid) THEN
    INSERT INTO comptes_bancaires (tenant_id, banque, intitule, numero_compte, solde) VALUES
      (v_tid, 'BGFI Bank Congo', 'Compte exploitation BGFI',  '521001', 45000000),
      (v_tid, 'LCB Congo',       'Compte courant LCB',         '521002', 28500000),
      (v_tid, 'BOCEC Congo',     'Compte épargne BOCEC',       '521003', 12000000);
    RAISE NOTICE '3 comptes bancaires créés';
  ELSE
    RAISE NOTICE 'Comptes bancaires déjà présents — skip';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM caisses WHERE tenant_id = v_tid) THEN
    INSERT INTO caisses (tenant_id, nom, numero_compte, solde)
    VALUES (v_tid, 'Caisse principale', '571000', 2500000);
    RAISE NOTICE '1 caisse créée';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. Employés (8)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM employes WHERE tenant_id = v_tid;
  IF v_cnt < 8 THEN
    INSERT INTO employes (
      tenant_id, nom, prenom, poste, departement,
      statut, salaire_base, date_recrutement, type_employe
    )
    SELECT v_tid, emp.nom, emp.prenom, emp.poste, emp.dept,
           'actif', emp.sal, emp.recrut, 'permanent'
    FROM (VALUES
      ('Mabiala',   'Jean',    'Directeur Général',         'Direction',  800000, '2020-01-15'::DATE),
      ('Nzouzi',    'Marie',   'Responsable Comptabilité',  'Finance',    500000, '2020-03-01'::DATE),
      ('Bouanga',   'Pierre',  'Chargé de Paie',            'RH',         400000, '2021-01-10'::DATE),
      ('Moukassa',  'Sophie',  'Commerciale Senior',         'Commercial', 450000, '2021-06-01'::DATE),
      ('Loemba',    'David',   'Gestionnaire Stocks',        'Logistique', 350000, '2022-02-01'::DATE),
      ('Kintsioni', 'Rachel',  'Comptable',                  'Finance',    420000, '2021-09-01'::DATE),
      ('Mbemba',    'Henri',   'Technicien Senior',          'Production', 380000, '2022-04-01'::DATE),
      ('Yoka',      'Carine',  'Assistante RH',              'RH',         320000, '2023-01-01'::DATE)
    ) AS emp(nom, prenom, poste, dept, sal, recrut)
    WHERE NOT EXISTS (
      SELECT 1 FROM employes e
      WHERE e.tenant_id = v_tid AND e.nom = emp.nom AND e.prenom = emp.prenom
    );
    RAISE NOTICE '8 employés insérés';
  ELSE
    RAISE NOTICE 'Employés déjà présents (%) — skip', v_cnt;
  END IF;

  SELECT ARRAY(
    SELECT id FROM employes
    WHERE tenant_id = v_tid AND statut = 'actif'
    ORDER BY created_at LIMIT 8
  ) INTO v_emp_ids;
  RAISE NOTICE 'Employés actifs chargés : %', array_length(v_emp_ids, 1);

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Fournisseurs (30)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM fournisseurs WHERE tenant_id = v_tid;
  IF v_cnt < 30 THEN
    INSERT INTO fournisseurs (tenant_id, nom, contact, telephone, email, adresse, solde_du)
    SELECT
      v_tid, f.nom, 'M. Contact Commercial',
      '+242 06 ' || LPAD((f.i * 77777 % 9000000 + 1000000)::TEXT, 7, '0'),
      lower(regexp_replace(f.nom, '[^a-zA-Z0-9]', '', 'g')) || '@four.cg',
      'BP ' || (100 + f.i * 17)::TEXT || ', Brazzaville',
      0
    FROM (VALUES
      ( 1, 'Imprimerie Centrale CG'),   ( 2, 'Bureau Direct Congo'),
      ( 3, 'Fournitures Pro SARL'),      ( 4, 'Matériaux Brazza'),
      ( 5, 'EcoServices Congo'),          ( 6, 'TechSupply CG'),
      ( 7, 'Congo Print SARL'),           ( 8, 'Papeterie du Fleuve'),
      ( 9, 'DataServices Africa'),        (10, 'Cloud Congo SARL'),
      (11, 'Net Congo Telecom'),          (12, 'Maintenance Pro CG'),
      (13, 'Sécurité Plus Congo'),        (14, 'Gardiennage Congo'),
      (15, 'Nettoyage Express CG'),       (16, 'Traiteur Brazzaville'),
      (17, 'Transports Rapides CG'),      (18, 'Livraisons Express Congo'),
      (19, 'Assurances Générales CG'),    (20, 'Assurances Pro SARL'),
      (21, 'Banque Habitat Congo'),       (22, 'Crédit Foncier Congo'),
      (23, 'Energie Congo SARL'),         (24, 'Eau et Gaz Congo'),
      (25, 'SNDE Services'),              (26, 'Carburants du Congo'),
      (27, 'Air Liquide Congo'),           (28, 'Pharma Équipements CG'),
      (29, 'Info Conseil CG'),             (30, 'Télécoms Services Congo')
    ) AS f(i, nom)
    WHERE NOT EXISTS (
      SELECT 1 FROM fournisseurs WHERE tenant_id = v_tid AND nom = f.nom
    );
    RAISE NOTICE '30 fournisseurs insérés';
  ELSE
    RAISE NOTICE 'Fournisseurs déjà présents (%) — skip', v_cnt;
  END IF;

  SELECT ARRAY(
    SELECT id FROM fournisseurs WHERE tenant_id = v_tid ORDER BY created_at LIMIT 30
  ) INTO v_fourn_ids;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Entrepôt + 10 Produits (pour mouvements de stock)
  -- ─────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE tenant_id = v_tid) THEN
    INSERT INTO warehouses (tenant_id, nom, localisation)
    VALUES (v_tid, 'Dépôt Principal', 'Brazzaville — Zone industrielle')
    RETURNING id INTO v_wh_id;
    RAISE NOTICE 'Entrepôt créé : %', v_wh_id;
  ELSE
    SELECT id INTO v_wh_id FROM warehouses WHERE tenant_id = v_tid LIMIT 1;
    RAISE NOTICE 'Entrepôt existant : %', v_wh_id;
  END IF;

  INSERT INTO products (tenant_id, nom, categorie, sku, unite, prix_achat, prix_vente)
  SELECT v_tid, p.nom, p.cat, 'SKU-DEMO-' || LPAD(p.i::TEXT, 3, '0'), 'pièce', p.pa, p.pv
  FROM (VALUES
    ( 1, 'Fournitures bureau',     'Bureau',       25000,  40000),
    ( 2, 'Matériel informatique',  'Informatique', 125000, 200000),
    ( 3, 'Mobilier de bureau',     'Mobilier',     180000, 290000),
    ( 4, 'Consommables impression','Impression',    15000,  25000),
    ( 5, 'Équipements réseau',     'Réseau',        85000, 140000),
    ( 6, 'Pièces détachées',       'Pièces',        35000,  60000),
    ( 7, 'Câblage électrique',     'Câblage',       12000,  20000),
    ( 8, 'Écrans moniteurs',       'Informatique',  95000, 160000),
    ( 9, 'Claviers souris',        'Informatique',   8000,  15000),
    (10, 'Onduleurs UPS',          'Électronique',  45000,  80000)
  ) AS p(i, nom, cat, pa, pv)
  ON CONFLICT (tenant_id, sku) DO NOTHING;

  SELECT ARRAY(
    SELECT id FROM products WHERE tenant_id = v_tid ORDER BY created_at LIMIT 10
  ) INTO v_prod_ids;
  RAISE NOTICE 'Produits chargés : %', array_length(v_prod_ids, 1);

  -- ─────────────────────────────────────────────────────────────────────────
  -- 6. Factures — 192 sur 24 mois (8/mois, 50 clients distincts)
  --    Règle TVA Congo : TVA = ROUND(HT × 0,18) · CA = ROUND(TVA × 0,05)
  --    TTC = HT + TVA + CA (taux effectif 18,9 %)
  --    50 % payées (i pair) → FAC-001 + FAC-002 émis
  --    50 % envoyées non payées (i impair) → FAC-001 seulement
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM factures WHERE tenant_id = v_tid;
  RAISE NOTICE 'Factures existantes : %', v_cnt;

  IF v_cnt < 180 THEN
    j := 0;
    FOR v_y IN 2024..2025 LOOP
      FOR v_m IN 1..12 LOOP
        FOR i IN 1..8 LOOP
          j := j + 1;

          -- Nom client (50 noms en rotation)
          v_nom := (ARRAY[
            'Cabinet Mukendi & Associés', 'Société Générale du Congo', 'BIC Congo',
            'CFAO Congo',                 'Total Energies Congo',       'Perenco Congo',
            'ENI Congo',                  'Bolloré Logistics',           'DHL Express Congo',
            'Orange Congo',               'MTN Congo',                   'Airtel Congo',
            'Panafrican Group',           'Alima Group',                 'BGFI Bank Congo',
            'LCB Congo',                  'Immobilière du Congo',        'Sogea Satom',
            'Razel Congo',                'Fayat Congo',                 'Halliburton Congo',
            'SLB Congo',                  'Congo Aviation',              'Hôtel Maya Maya',
            'Restaurant Le Lézard',       'SCUD Congo',                  'SARIS Congo',
            'Groupe Nzadi',               'Pharmacie Centrale',          'Clinique Loandjili',
            'Cabinet Expertise CG',       'Transport Lokolia',           'Matériaux du Congo',
            'Tech Solutions CG',          'Médias Tropicaux',            'Constructions BZV',
            'Agroalimentaire Congo',      'Logistique Afrique',          'Électricité du Congo',
            'Import-Export Brazza',       'STPU Congo',                  'Sucraf Congo',
            'Saipem Congo',               'Résidence Flamboyants',       'Traiteur Pointe-Noire',
            'Brasserie du Congo',         'SNDE Congo',                  'Soc. Pétrolière Congo',
            'Oraforme Demo SA',           'Tecnimont Congo'
          ])[((j - 1) % 50) + 1];

          -- Montant HT déterministe (varie par j, mois, année)
          v_ht  := ROUND(((500000 + (j * 97531 + v_m * 314159 + v_y * 271) % 4500000)::NUMERIC), -3);
          v_tva := ROUND(v_ht * 0.18);
          v_ca  := ROUND(v_tva * 0.05);
          v_ttc := v_ht + v_tva + v_ca;
          v_num := 'FAC-' || v_y || '-' || LPAD(v_m::TEXT, 2, '0') || '-' || LPAD(i::TEXT, 3, '0');
          v_date := make_date(v_y, v_m, LEAST(28, i * 3 + 1));

          -- Idempotence : skip si numéro déjà présent
          IF EXISTS (
            SELECT 1 FROM factures WHERE tenant_id = v_tid AND invoice_number = v_num
          ) THEN CONTINUE; END IF;

          INSERT INTO factures (
            tenant_id, invoice_number, client_name, client_nom,
            subtotal, montant_ht, tva_montant, ca, total,
            statut, date, due_date, type
          ) VALUES (
            v_tid, v_num, v_nom, v_nom,
            v_ht, v_ht, v_tva, v_ca, v_ttc,
            'envoyee', v_date, v_date + 30, 'facture'
          ) RETURNING id INTO v_fac_id;

          -- FAC-001 : Facture émise → 411/706 (HT) + 411/4441 (TVA 18%) + 411/447 (CA 5%)
          PERFORM emit_accounting_event(
            v_tid, 'FAC-001', 'facturation', 'factures', v_fac_id,
            v_ht, v_tva, v_ttc, NULL,
            'Facture ' || v_num || ' — ' || v_nom,
            v_date, v_y,
            jsonb_build_object(
              'piece_number', v_num,
              'client_name',  v_nom,
              'ca',           v_ca,
              'country_code', 'CG'
            )
          );

          -- FAC-002 : 50 % des factures payées (i pair) → 521/411 (TTC)
          IF i % 2 = 0 THEN
            UPDATE factures SET statut = 'payee' WHERE id = v_fac_id;
            PERFORM emit_accounting_event(
              v_tid, 'FAC-002', 'facturation', 'factures', v_fac_id,
              0, 0, v_ttc, NULL,
              'Règlement ' || v_num || ' — ' || v_nom,
              v_date + 15, v_y,
              jsonb_build_object(
                'piece_number',    v_num,
                'client_name',     v_nom,
                'mode_paiement',   'virement',
                'country_code',    'CG'
              )
            );
          END IF;

        END LOOP;  -- i (factures/mois)
      END LOOP;  -- v_m
    END LOOP;  -- v_y
    RAISE NOTICE 'Factures insérées : %', j;
  ELSE
    RAISE NOTICE 'Factures déjà suffisantes (%) — skip', v_cnt;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 7. Bulletins de paie — 192 (8 emp × 24 mois)
  --    CNSS salarié  : 5,04 % du brut (migration 077 default)
  --    CNSS patronal : 20,285 % (VID 8 % + AF 10,035 % + AT 2,25 %)
  --    IRPP Congo    : tranches sur brut mensuel
  --    PAI-001 → 661/421 (brut) + 664/431 (cnss_patro) + 421/431 (cnss_sal) + 421/447 (irpp)
  -- ─────────────────────────────────────────────────────────────────────────
  FOR v_y IN 2024..2025 LOOP
    FOR v_m IN 1..12 LOOP
      FOR i IN 1..LEAST(8, COALESCE(array_length(v_emp_ids, 1), 0)) LOOP

        IF NOT EXISTS (
          SELECT 1 FROM bulletins_paie
          WHERE employe_id = v_emp_ids[i] AND mois = v_m AND annee = v_y
        ) THEN
          SELECT salaire_base::NUMERIC INTO v_sal_base
          FROM employes WHERE id = v_emp_ids[i];

          v_brut       := v_sal_base;
          v_cnss_sal   := ROUND(v_brut * 0.0504);
          v_cnss_patro := ROUND(v_brut * 0.20285);

          -- IRPP Congo — tranches mensuelles (cf. LF 2026, lib/fiscalite-congo.ts)
          v_imposable := v_brut;
          IF    v_imposable <= 464000  THEN v_irpp := 0;
          ELSIF v_imposable <= 1000000 THEN v_irpp := ROUND((v_imposable - 464000)   * 0.01);
          ELSIF v_imposable <= 3000000 THEN v_irpp := ROUND(5360 + (v_imposable - 1000000) * 0.10);
          ELSIF v_imposable <= 8000000 THEN v_irpp := ROUND(205360 + (v_imposable - 3000000) * 0.25);
          ELSE                              v_irpp := ROUND(1455360 + (v_imposable - 8000000) * 0.40);
          END IF;

          v_net := v_brut - v_cnss_sal - v_irpp;

          INSERT INTO bulletins_paie (
            tenant_id, employe_id, mois, annee,
            salaire_base, brut,
            cnss_salarie, cnss_taux, cnss_patronal,
            irpp, total_retenues, net,
            cout_total_employeur, statut
          ) VALUES (
            v_tid, v_emp_ids[i], v_m, v_y,
            v_sal_base, v_brut,
            v_cnss_sal, 0.0504, v_cnss_patro,
            v_irpp, v_cnss_sal + v_irpp, v_net,
            v_brut + v_cnss_patro, 'validee'
          ) RETURNING id INTO v_bull_id;

          SELECT nom || ' ' || prenom INTO v_emp_nom
          FROM employes WHERE id = v_emp_ids[i];

          -- PAI-001 : constatation salaire (montant_ht = brut, montant_net = net)
          PERFORM emit_accounting_event(
            v_tid, 'PAI-001', 'paie', 'bulletins_paie', v_bull_id,
            v_brut, 0, 0, v_net,
            'Paie ' || LPAD(v_m::TEXT, 2, '0') || '/' || v_y || ' — ' || v_emp_nom,
            make_date(v_y, v_m, 25), v_y,
            jsonb_build_object(
              'cnss_patronal', v_cnss_patro,
              'cnss_salarie',  v_cnss_sal,
              'irpp',          v_irpp,
              'employe_nom',   v_emp_nom,
              'mois',          v_m,
              'annee',         v_y,
              'country_code',  'CG'
            )
          );
        END IF;

      END LOOP;  -- i (employés)
    END LOOP;  -- v_m
  END LOOP;  -- v_y

  SELECT COUNT(*) INTO v_cnt FROM bulletins_paie WHERE tenant_id = v_tid;
  RAISE NOTICE 'Bulletins paie total : %', v_cnt;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 8. Achats fournisseurs — 48 (2/mois × 24 mois)
  --    ACH-001 → 601/401 (HT, TVA non décomposée — table achats sans montant_tva)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM achats WHERE tenant_id = v_tid;
  IF v_cnt < 48 THEN
    j := 0;
    FOR v_y IN 2024..2025 LOOP
      FOR v_m IN 1..12 LOOP
        FOR i IN 1..2 LOOP
          j := j + 1;
          v_ht   := ROUND(((100000 + (j * 83333 + v_m * 71111) % 900000)::NUMERIC), -3);
          v_date := make_date(v_y, v_m, LEAST(28, i * 10));

          INSERT INTO achats (tenant_id, fournisseur_id, description, montant, statut, date)
          VALUES (
            v_tid,
            v_fourn_ids[((j - 1) % array_length(v_fourn_ids, 1)) + 1],
            (ARRAY[
              'Fournitures et consommables bureau',
              'Services informatiques et maintenance',
              'Maintenance et réparations équipements',
              'Carburant et déplacements professionnels',
              'Prestations services externes'
            ])[(j % 5) + 1],
            v_ht, 'impaye', v_date
          ) RETURNING id INTO v_ach_id;

          -- ACH-001 : enregistrement facture fournisseur → 601 Débit / 401 Crédit
          PERFORM emit_accounting_event(
            v_tid, 'ACH-001', 'achats', 'achats', v_ach_id,
            v_ht, 0, v_ht, NULL,
            'Achat fournisseur ' || LPAD(v_m::TEXT, 2, '0') || '/' || v_y || ' #' || j,
            v_date, v_y,
            jsonb_build_object('country_code', 'CG')
          );

        END LOOP;  -- i (achats/mois)
      END LOOP;  -- v_m
    END LOOP;  -- v_y
    RAISE NOTICE 'Achats insérés : %', j;
  ELSE
    RAISE NOTICE 'Achats déjà présents (%) — skip', v_cnt;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 9. Transactions trésorerie — 192 (4 entrées + 4 sorties / mois × 24 mois)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM transactions WHERE tenant_id = v_tid;
  IF v_cnt < 180 THEN
    FOR v_y IN 2024..2025 LOOP
      FOR v_m IN 1..12 LOOP
        FOR i IN 1..4 LOOP
          v_date := make_date(v_y, v_m, LEAST(25, i * 6 + 1));

          -- Entrée (encaissement client)
          INSERT INTO transactions (
            tenant_id, type, categorie, description, montant,
            date, mode_paiement, reference
          )
          SELECT
            v_tid, 'entree', 'Facturation',
            'Encaissement client ' || to_char(v_date, 'MM/YYYY'),
            ROUND(((500000 + ((v_y * 12 + v_m + i) * 314159 % 3000000))::NUMERIC), -3),
            v_date,
            (ARRAY['virement', 'especes', 'mobile_money'])[(i % 3) + 1],
            'ENT-' || v_y || LPAD(v_m::TEXT, 2, '0') || '-' || i
          WHERE NOT EXISTS (
            SELECT 1 FROM transactions WHERE tenant_id = v_tid
              AND reference = 'ENT-' || v_y || LPAD(v_m::TEXT, 2, '0') || '-' || i
          );

          -- Sortie (décaissement)
          INSERT INTO transactions (
            tenant_id, type, categorie, description, montant,
            date, mode_paiement, reference
          )
          SELECT
            v_tid, 'sortie',
            (ARRAY['Paie', 'Loyer', 'Fournisseurs', 'Services'])[(i % 4) + 1],
            'Décaissement '
              || (ARRAY['paie', 'loyer', 'fournisseur', 'services'])[(i % 4) + 1]
              || ' ' || to_char(v_date, 'MM/YYYY'),
            ROUND(((100000 + ((v_y * 12 + v_m + i) * 271828 % 1500000))::NUMERIC), -3),
            v_date + 3,
            (ARRAY['virement', 'cheque', 'especes'])[(i % 3) + 1],
            'SOR-' || v_y || LPAD(v_m::TEXT, 2, '0') || '-' || i
          WHERE NOT EXISTS (
            SELECT 1 FROM transactions WHERE tenant_id = v_tid
              AND reference = 'SOR-' || v_y || LPAD(v_m::TEXT, 2, '0') || '-' || i
          );

        END LOOP;  -- i
      END LOOP;  -- v_m
    END LOOP;  -- v_y
    SELECT COUNT(*) INTO v_cnt FROM transactions WHERE tenant_id = v_tid;
    RAISE NOTICE 'Transactions total : %', v_cnt;
  ELSE
    RAISE NOTICE 'Transactions déjà présentes (%) — skip', v_cnt;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 10. Mouvements de stock — 96 (2 IN + 2 OUT / mois × 24 mois)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_cnt FROM stock_movements WHERE tenant_id = v_tid;
  IF v_cnt < 96
     AND array_length(v_prod_ids, 1) > 0
     AND v_wh_id IS NOT NULL
  THEN
    j := 0;
    FOR v_y IN 2024..2025 LOOP
      FOR v_m IN 1..12 LOOP
        FOR i IN 1..4 LOOP  -- i=1,2 → IN ; i=3,4 → OUT
          j := j + 1;
          INSERT INTO stock_movements (
            tenant_id, product_id, warehouse_id, type, quantite, reference, note
          )
          SELECT
            v_tid,
            v_prod_ids[((j - 1) % array_length(v_prod_ids, 1)) + 1],
            v_wh_id,
            CASE WHEN i <= 2 THEN 'IN' ELSE 'OUT' END,
            CASE WHEN i <= 2
              THEN (10 + (j * 7 % 40))::NUMERIC
              ELSE  (3 + (j * 3 % 12))::NUMERIC
            END,
            CASE WHEN i <= 2 THEN 'MVT-IN-'  ELSE 'MVT-OUT-' END
              || v_y || '-' || LPAD(v_m::TEXT, 2, '0') || '-' || i,
            CASE WHEN i <= 2
              THEN 'Réception ' || to_char(make_date(v_y, v_m, 1), 'MM/YYYY')
              ELSE 'Consommation ' || to_char(make_date(v_y, v_m, 1), 'MM/YYYY')
            END
          WHERE NOT EXISTS (
            SELECT 1 FROM stock_movements WHERE tenant_id = v_tid
              AND reference =
                CASE WHEN i <= 2 THEN 'MVT-IN-' ELSE 'MVT-OUT-' END
                  || v_y || '-' || LPAD(v_m::TEXT, 2, '0') || '-' || i
          );
        END LOOP;
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Mouvements stock insérés : ~%', j;
  ELSE
    RAISE NOTICE 'Mouvements stock déjà présents (%) — skip', v_cnt;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- RÉSUMÉ FINAL
  -- ─────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE 'SPRINT S-02 PHASE 3 — RÉSUMÉ DONNÉES DÉMO';
  RAISE NOTICE 'Tenant                 : %', v_tid;
  RAISE NOTICE '──────────────────────────────────────────────────────────';
  RAISE NOTICE 'Employés               : %', (SELECT COUNT(*) FROM employes          WHERE tenant_id = v_tid);
  RAISE NOTICE 'Fournisseurs           : %', (SELECT COUNT(*) FROM fournisseurs       WHERE tenant_id = v_tid);
  RAISE NOTICE 'Comptes bancaires      : %', (SELECT COUNT(*) FROM comptes_bancaires  WHERE tenant_id = v_tid);
  RAISE NOTICE 'Produits               : %', (SELECT COUNT(*) FROM products            WHERE tenant_id = v_tid);
  RAISE NOTICE 'Entrepôts              : %', (SELECT COUNT(*) FROM warehouses          WHERE tenant_id = v_tid);
  RAISE NOTICE '──────────────────────────────────────────────────────────';
  RAISE NOTICE 'Factures total         : %', (SELECT COUNT(*) FROM factures            WHERE tenant_id = v_tid);
  RAISE NOTICE '  ↳ envoyée (impayée)  : %', (SELECT COUNT(*) FROM factures            WHERE tenant_id = v_tid AND statut = 'envoyee');
  RAISE NOTICE '  ↳ payée              : %', (SELECT COUNT(*) FROM factures            WHERE tenant_id = v_tid AND statut = 'payee');
  RAISE NOTICE 'Bulletins de paie      : %', (SELECT COUNT(*) FROM bulletins_paie      WHERE tenant_id = v_tid);
  RAISE NOTICE 'Achats fournisseurs    : %', (SELECT COUNT(*) FROM achats              WHERE tenant_id = v_tid);
  RAISE NOTICE 'Transactions           : %', (SELECT COUNT(*) FROM transactions        WHERE tenant_id = v_tid);
  RAISE NOTICE 'Mouvements stock       : %', (SELECT COUNT(*) FROM stock_movements     WHERE tenant_id = v_tid);
  RAISE NOTICE '──────────────────────────────────────────────────────────';
  RAISE NOTICE 'Accounting events      : %', (SELECT COUNT(*) FROM accounting_events   WHERE tenant_id = v_tid);
  RAISE NOTICE '  ↳ processed          : %', (SELECT COUNT(*) FROM accounting_events   WHERE tenant_id = v_tid AND status = 'processed');
  RAISE NOTICE '  ↳ error              : %', (SELECT COUNT(*) FROM accounting_events   WHERE tenant_id = v_tid AND status = 'error');
  RAISE NOTICE '  ↳ pending            : %', (SELECT COUNT(*) FROM accounting_events   WHERE tenant_id = v_tid AND status = 'pending');
  RAISE NOTICE 'Journal entries        : %', (SELECT COUNT(*) FROM journal_entries      WHERE tenant_id = v_tid);
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Si accounting_events.error > 0, exécuter le bloc DIAGNOSTIC ci-dessous.';

END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- REQUÊTE DE VÉRIFICATION — À EXÉCUTER APRÈS LE BLOC PRINCIPAL
-- (Copier-coller séparément dans SQL Editor)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Répartition des écritures journal par module
SELECT
  split_part(ae.event_type, '-', 1) AS module,
  ae.event_type,
  COUNT(ae.id)                       AS nb_events,
  COUNT(ae.id) FILTER (WHERE ae.status = 'processed') AS ok,
  COUNT(ae.id) FILTER (WHERE ae.status = 'error')     AS erreurs,
  COUNT(je.id)                       AS ecritures_journal
FROM accounting_events ae
LEFT JOIN journal_entries je ON je.source_id = ae.source_id AND je.tenant_id = ae.tenant_id
WHERE ae.tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2. CA HT facturé par mois (doit être non-nul sur 24 mois)
SELECT
  EXTRACT(YEAR FROM date)::INT  AS annee,
  EXTRACT(MONTH FROM date)::INT AS mois,
  COUNT(*)                       AS nb_factures,
  SUM(montant_ht)                AS ca_ht,
  SUM(tva_montant)               AS tva,
  SUM(total)                     AS ttc
FROM factures
WHERE tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
GROUP BY 1, 2
ORDER BY 1, 2;

-- 3. Masse salariale et charges par mois
SELECT
  annee, mois,
  COUNT(*)           AS nb_bulletins,
  SUM(brut)          AS masse_salariale,
  SUM(cnss_salarie)  AS cnss_sal_total,
  SUM(cnss_patronal) AS cnss_patro_total,
  SUM(irpp)          AS irpp_total,
  SUM(net)           AS net_total
FROM bulletins_paie
WHERE tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
GROUP BY 1, 2
ORDER BY 1, 2;

-- 4. Erreurs accounting_engine (si error > 0)
SELECT
  event_type, status, error_message, source_table, source_id, date_event
FROM accounting_events
WHERE tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
  AND status = 'error'
ORDER BY created_at DESC
LIMIT 20;
