BEGIN;

-- ── 0. Garde-fous : prérequis des migrations 133 et 155 ─────────────────────
DO $$
DECLARE n INT;
BEGIN
  IF to_regclass('public.chart_of_accounts') IS NULL THEN
    RAISE EXCEPTION '133 : table chart_of_accounts absente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses' AND column_name='numero_compte') THEN
    RAISE EXCEPTION '133 : colonne caisses.numero_compte absente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mobile_money_wallets' AND column_name='compte_ohada') THEN
    RAISE EXCEPTION '133 : colonne mobile_money_wallets.compte_ohada absente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comptes_bancaires' AND column_name='solde') THEN
    RAISE EXCEPTION '133 : colonne comptes_bancaires.solde absente';
  END IF;
  SELECT count(*) INTO n FROM tenants
  WHERE taille_entreprise IS NOT NULL AND taille_entreprise NOT IN ('tpe','pme','grande');
  IF n > 0 THEN
    RAISE EXCEPTION '155 : % tenant(s) avec une taille hors (tpe, pme, grande) — corriger avant', n;
  END IF;
  IF EXISTS (SELECT 1 FROM accounting_schema_versions WHERE version = '1.10.0') THEN
    RAISE EXCEPTION '148 : version 1.10.0 déjà enregistrée';
  END IF;
END $$;

-- ── 1. Migration 133 — soldes de trésorerie et vue unifiée ──────────────────
CREATE OR REPLACE VIEW vue_tresorerie_unifiee AS
WITH mouvements AS (
  SELECT tenant_id, debit_account AS compte,
         SUM(montant) AS debits, 0::NUMERIC AS credits
  FROM journal_entries
  WHERE debit_account IN ('521','571','571100','571200','512','5711','5712')
  GROUP BY tenant_id, debit_account
  UNION ALL
  SELECT tenant_id, credit_account AS compte,
         0::NUMERIC AS debits, SUM(montant) AS credits
  FROM journal_entries
  WHERE credit_account IN ('521','571','571100','571200','512','5711','5712')
  GROUP BY tenant_id, credit_account
)
SELECT
  m.tenant_id,
  m.compte,
  COALESCE(coa.account_name, m.compte) AS libelle,
  SUM(m.debits)                         AS total_entrees,
  SUM(m.credits)                        AS total_sorties,
  SUM(m.debits) - SUM(m.credits)        AS solde_journal
FROM mouvements m
LEFT JOIN chart_of_accounts coa
  ON coa.account_number = m.compte
 AND (coa.tenant_id = m.tenant_id OR coa.tenant_id IS NULL)
GROUP BY m.tenant_id, m.compte, coa.account_name
ORDER BY m.tenant_id, m.compte;
CREATE OR REPLACE FUNCTION fn_sync_tresorerie_soldes(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE comptes_bancaires cb
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  = '521' THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account = '521' THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE cb.tenant_id = p_tenant_id;
  UPDATE caisses ca
  SET solde = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account  IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account IN ('571', ca.numero_compte) THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE ca.tenant_id = p_tenant_id;
  UPDATE mobile_money_wallets mm
  SET solde_actuel = COALESCE((
    SELECT SUM(CASE WHEN je.debit_account IN (
                mm.compte_ohada,
                CASE mm.compte_ohada WHEN '571100' THEN '5711'
                                     WHEN '571200' THEN '5712'
                                     WHEN '5711'   THEN '571100'
                                     WHEN '5712'   THEN '571200'
                                     ELSE mm.compte_ohada END
              ) THEN je.montant ELSE 0 END)
         - SUM(CASE WHEN je.credit_account IN (
                mm.compte_ohada,
                CASE mm.compte_ohada WHEN '571100' THEN '5711'
                                     WHEN '571200' THEN '5712'
                                     WHEN '5711'   THEN '571100'
                                     WHEN '5712'   THEN '571200'
                                     ELSE mm.compte_ohada END
              ) THEN je.montant ELSE 0 END)
    FROM journal_entries je WHERE je.tenant_id = p_tenant_id
  ), 0)
  WHERE mm.tenant_id = p_tenant_id;
END;
$$;

-- ── 2. Migration 148 — règles BTP et agriculture ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.9.0'
  ) THEN
    RAISE EXCEPTION 'Migration 147 non appliquée — version 1.9.0 manquante.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB','BOI','ACH','BTP','AGR');
$$;
CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-001', 'FAC-002', 'RES-001', 'SAN-001', 'ECO-001',
    'HOT-001', 'ONG-001', 'BOI-001', 'BTP-001', 'AGR-001'
  );
$$;
CREATE OR REPLACE FUNCTION fn_ae_category(p_event_type TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE split_part(p_event_type, '-', 1)
    WHEN 'FAC' THEN 'Facturation'  WHEN 'PAI' THEN 'Paie'
    WHEN 'SAN' THEN 'Santé'        WHEN 'RES' THEN 'Restaurant'
    WHEN 'ECO' THEN 'Scolarité'    WHEN 'COM' THEN 'Commerce'
    WHEN 'TRP' THEN 'Transport'    WHEN 'HOT' THEN 'Hôtel'
    WHEN 'FIS' THEN 'Fiscalité'    WHEN 'TRE' THEN 'Trésorerie'
    WHEN 'MOB' THEN 'Mobile Money' WHEN 'ONG' THEN 'ONG'
    WHEN 'CAB' THEN 'Cabinet'      WHEN 'BOI' THEN 'Boisson'
    WHEN 'STK' THEN 'Stocks'       WHEN 'ACH' THEN 'Achats'
    WHEN 'BTP' THEN 'BTP'          WHEN 'AGR' THEN 'Agriculture'
    ELSE 'Autre'
  END;
$$;
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-001', 1, 1, 'active',
  '411', '722',
  'montant_ht', NULL, NULL,
  'travaux_ht',
  'Travaux BTP facturés — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '411=Clients (débiteur). 722=Travaux exécutés (revenu BTP — classe 7). Montant HT. TVA collectée en séq 2 (4441). Méthode à l avancement SYSCOHADA révisé 2018. Compte 704 (Travaux) si méthode achèvement — modifier selon segment client.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-001', 2, 1, 'active',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'tva_btp',
  'TVA BTP — {libelle}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '4441=TVA facturée collectée (classe 4 — État). BTP soumis TVA 18% + Centime Additionnel 5%/TVA = 18.9% effectif (Congo-Brazzaville). Conditions : montant_tva > 0 → si exonéré (marchés État exonérés selon CGI), mettre montant_tva=0 à l emit.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-002', 1, 1, 'active',
  '521', '411',
  'montant_ttc', NULL, 'treasury_debit',
  'reglement_client_btp',
  'Règlement client BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '521=placeholder treasury_debit → fn_ohada_cash_account(mode_paiement). 411=Client soldé (crédit). Montant TTC (HT + TVA). Espèces → 571, Virement → 521. fn_ae_is_income=true, fn_ae_has_treasury_impact=true → entrée trésorerie.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-003', 1, 1, 'draft',
  '521', '481',
  'montant_ttc', NULL, 'treasury_debit',
  'avance_client_btp',
  'Avance client BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 521=Trésorerie (treasury_debit). 481=Produits reçus d avance (passif courant). Avances = produit reporté jusqu à l avancement du chantier. Régulariser via BTP-004 à chaque décompte intermédiaire. Activer quand module BTP intègre suivi acomptes.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-004', 1, 1, 'draft',
  '481', '411',
  'montant_ttc', NULL, NULL,
  'regularisation_avance_btp',
  'Régularisation avance BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 481=Produit d avance soldé (débit). 411=Client débiteur net réduit. Utilisé lors de chaque décompte intermédiaire pour déduire l acompte versé. Activer avec BTP-003.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-001', 1, 1, 'active',
  '411', '714',
  'montant_ht', NULL, NULL,
  'vente_agricole_ht',
  'Vente agricole — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '411=Clients (débiteur). 714=Ventes de produits agricoles (classe 7 — produits standard). Pas de séquence TVA (exonération Art.140 CGI Congo pour produits alimentaires). Si le tenant vend produits transformés (non exonérés) : ajouter séq 2 avec montant_tva + 4441.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-002', 1, 1, 'active',
  '521', '411',
  'montant_ht', NULL, 'treasury_debit',
  'encaissement_agricole',
  'Règlement vente agricole — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '521=Treasury_debit → fn_ohada_cash_account. 411=Client soldé. Montant HT (pas de TVA). Espèces → 571, Virement → 521. fn_ae_has_treasury_impact=true, fn_ae_is_income=true → entrée trésorerie.'
);
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-003', 1, 1, 'draft',
  '602', '401',
  'montant_ht', NULL, NULL,
  'achat_intrants_agricoles',
  'Achat intrants AGR — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 602=Achats matières premières et fournitures liées (intrants agricoles : semences, engrais, pesticides). 401=Fournisseurs. Différent de 601 (marchandises génériques). Activer quand module Agriculture intègre suivi achats intrants.'
);
INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.10.0', 1, 10, 0,
  '148_accounting_rules_btp_agriculture.sql',
  'Sprint 148 — BTP & Agriculture → moteur comptable central v1.10.0. '
  'BTP-001 active (travaux facturés 411/722 HT + 411/4441 TVA 18.9%). '
  'BTP-002 active (règlement client 521/411 treasury_debit). '
  'BTP-003 draft (avance reçue 521/481). BTP-004 draft (régularisation avance 481/411). '
  'AGR-001 active (vente agricole 411/714 HT — exonération TVA Art.140 CGI Congo). '
  'AGR-002 active (encaissement agricole 521/411 treasury_debit). '
  'AGR-003 draft (achat intrants 602/401). '
  'fn_ae_has_treasury_impact: BTP+AGR ajoutés. fn_ae_is_income: BTP-001+AGR-001. '
  'fn_ae_category: BTP→BTP, AGR→Agriculture. '
  'BCI Sprint 148: couverture moteur 71% → 79% (12/14 modules actifs).',
  FALSE,
  'Sprint 148 — ERP Sprints gouvernance'
);

-- 148 est appliquée après 175 : on replace sa version dans l'ordre réel du
-- moteur, juste après 1.9.0, pour que « dernière version » reste 1.11.0.
UPDATE accounting_schema_versions
SET    applied_at  = (SELECT applied_at + INTERVAL '1 second' FROM accounting_schema_versions WHERE version = '1.9.0'),
       description = description || ' — Appliquée en production le 2026-09-02 (P0-05), après 175.'
WHERE  version = '1.10.0';

-- ── 3. Migration 155 — taille d'entreprise obligatoire et contrainte ─────────
UPDATE tenants
SET taille_entreprise = CASE
  WHEN plan IN ('grande', 'enterprise', 'compagnie') THEN 'grande'
  WHEN plan IN ('pme', 'pro', 'business')            THEN 'pme'
  ELSE                                                    'tpe'
END
WHERE taille_entreprise IS NULL;
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_taille_entreprise_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_taille_entreprise_check
  CHECK (taille_entreprise IN ('tpe', 'pme', 'grande'));
ALTER TABLE tenants
  ALTER COLUMN taille_entreprise SET DEFAULT 'tpe';
ALTER TABLE tenants
  ALTER COLUMN taille_entreprise SET NOT NULL;

-- ── 4. Migration 165 — search_path fixé sur toutes les fonctions public ──────
DO $$
DECLARE
  fn RECORD;
  n  INTEGER := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Migration 165 OK — search_path fixé sur % fonctions', n;
END $$;

-- ── 5. Soldes d'AMD FINANCE recalculés maintenant que la fonction existe ─────
SELECT fn_sync_tresorerie_soldes('b93b7c3d-815b-4336-bbb2-ac24cda0edb2'::uuid);

COMMIT;

-- ── Contrôle ─────────────────────────────────────────────────────────────────
SELECT * FROM (
  SELECT '133 fn_sync_tresorerie_soldes(uuid)' AS migration, (to_regprocedure('fn_sync_tresorerie_soldes(uuid)') IS NOT NULL)::text AS presente
  UNION ALL SELECT '133 vue_tresorerie_unifiee', (to_regclass('public.vue_tresorerie_unifiee') IS NOT NULL)::text
  UNION ALL SELECT '148 règles BTP+AGR actives', (SELECT count(*)::text FROM accounting_event_rules WHERE (event_type LIKE 'BTP-%' OR event_type LIKE 'AGR-%') AND status='active')
  UNION ALL SELECT '148 versions (ordre)', (SELECT string_agg(version, ' → ' ORDER BY applied_at) FROM accounting_schema_versions WHERE version IN ('1.9.0','1.10.0','1.11.0'))
  UNION ALL SELECT '155 taille_entreprise NOT NULL + CHECK',
         (SELECT (is_nullable='NO')::text || ' · check=' || (EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenants_taille_entreprise_check'))::text
          FROM information_schema.columns WHERE table_name='tenants' AND column_name='taille_entreprise')
  UNION ALL SELECT '155 répartition', (SELECT string_agg(taille_entreprise || '=' || n, ', ') FROM (SELECT taille_entreprise, count(*) n FROM tenants GROUP BY 1) r)
  UNION ALL SELECT '165 fonctions sans search_path (0 attendu)',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%'))
  UNION ALL SELECT 'AMD soldes banques · caisses · wallets',
         (SELECT coalesce(sum(solde),0) FROM comptes_bancaires WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2')::text || ' · ' ||
         (SELECT coalesce(sum(solde),0) FROM caisses WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2')::text || ' · ' ||
         (SELECT coalesce(sum(solde_actuel),0) FROM mobile_money_wallets WHERE tenant_id='b93b7c3d-815b-4336-bbb2-ac24cda0edb2')::text
) d ORDER BY migration;
