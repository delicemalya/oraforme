-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 073 — Correction comptes SYSCOHADA dans les triggers
-- Anciens comptes OHADA 6 chiffres → Nouveaux comptes SYSCOHADA 2-5 chiffres
-- SYSCOHADA révisé 2017 (applicable depuis 01/01/2018)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fonction helper — compte de charge SYSCOHADA ─────────────────────────

CREATE OR REPLACE FUNCTION fn_syscohada_charge_account(p_categorie TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $syscohada_charge$
  SELECT CASE
    WHEN p_categorie ILIKE '%loyer%'        OR p_categorie ILIKE '%location%'   THEN '622'   -- Locations et charges locatives
    WHEN p_categorie ILIKE '%transport%'    OR p_categorie ILIKE '%carburant%'  THEN '61'    -- Transports
    WHEN p_categorie ILIKE '%salaire%'      OR p_categorie ILIKE '%personnel%'  THEN '661'   -- Rémunérations directes
    WHEN p_categorie ILIKE '%achat%'        OR p_categorie ILIKE '%fourniture%'
      OR p_categorie ILIKE '%stock%'                                             THEN '601'   -- Achats de marchandises
    WHEN p_categorie ILIKE '%matiere%'      OR p_categorie ILIKE '%matière%'    THEN '602'   -- Matières premières
    WHEN p_categorie ILIKE '%telecom%'      OR p_categorie ILIKE '%télécom%'
      OR p_categorie ILIKE '%internet%'     OR p_categorie ILIKE '%mobile%'     THEN '628'   -- Frais de télécommunications
    WHEN p_categorie ILIKE '%electricite%'  OR p_categorie ILIKE '%électricité%'
      OR p_categorie ILIKE '%eau%'                                               THEN '622'   -- Services (eau/élec)
    WHEN p_categorie ILIKE '%assurance%'                                         THEN '625'   -- Primes d'assurance
    WHEN p_categorie ILIKE '%entretien%'    OR p_categorie ILIKE '%réparation%' THEN '624'   -- Entretien & maintenance
    WHEN p_categorie ILIKE '%publicite%'    OR p_categorie ILIKE '%publicité%'  THEN '627'   -- Publicité
    WHEN p_categorie ILIKE '%banque%'       OR p_categorie ILIKE '%commission%' THEN '631'   -- Frais bancaires
    WHEN p_categorie ILIKE '%formation%'                                         THEN '633'   -- Formation personnel
    WHEN p_categorie ILIKE '%impot%'        OR p_categorie ILIKE '%taxe%'       THEN '64'    -- Impôts et taxes
    ELSE '658'   -- Charges diverses
  END;
$syscohada_charge$;

-- ── 2. Fonction helper — compte de trésorerie SYSCOHADA ─────────────────────

CREATE OR REPLACE FUNCTION fn_syscohada_cash_account(p_mode TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $syscohada_cash$
  SELECT CASE
    WHEN p_mode ILIKE '%virement%'                                     THEN '521'  -- Banques locales
    WHEN p_mode ILIKE '%cheque%'    OR p_mode ILIKE '%chèque%'         THEN '512'  -- Chèques à encaisser
    WHEN p_mode ILIKE '%espece%'    OR p_mode ILIKE '%espèce%'
      OR p_mode ILIKE '%cash%'                                         THEN '571'  -- Caisse
    WHEN p_mode ILIKE '%airtel%'                                       THEN '541'  -- Airtel Money
    WHEN p_mode ILIKE '%mtn%'                                          THEN '542'  -- MTN MoMo
    WHEN p_mode ILIKE '%orange%'                                       THEN '543'  -- Orange Money
    WHEN p_mode ILIKE '%mobile%'    OR p_mode ILIKE '%wallet%'        THEN '548'  -- Autres monnaies élec
    ELSE '521'
  END;
$syscohada_cash$;

-- ── 3. Remplacement de fn_ohada_charge_account par alias SYSCOHADA ──────────
-- Garde l'ancienne fonction pour compatibilité, mais la fait pointer vers SYSCOHADA

CREATE OR REPLACE FUNCTION fn_ohada_charge_account(p_categorie TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $compat$
  SELECT fn_syscohada_charge_account(p_categorie);
$compat$;

CREATE OR REPLACE FUNCTION fn_ohada_cash_account(p_mode TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
AS $compat2$
  SELECT fn_syscohada_cash_account(p_mode);
$compat2$;

-- ── 4. Mise à jour table journal_entries — index et contraintes ──────────────

-- Ajoute un index sur debit_account et credit_account si pas encore présent
CREATE INDEX IF NOT EXISTS idx_journal_entries_debit  ON journal_entries(tenant_id, debit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_credit ON journal_entries(tenant_id, credit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_year   ON journal_entries(tenant_id, fiscal_year);

-- ── 5. Vue agrégée soldes SYSCOHADA par compte ───────────────────────────────

CREATE OR REPLACE VIEW v_soldes_syscohada AS
SELECT
  tenant_id,
  fiscal_year,
  debit_account   AS compte,
  'debit'         AS sens,
  SUM(montant)    AS total
FROM journal_entries
WHERE debit_account IS NOT NULL
GROUP BY tenant_id, fiscal_year, debit_account
UNION ALL
SELECT
  tenant_id,
  fiscal_year,
  credit_account  AS compte,
  'credit'        AS sens,
  SUM(montant)    AS total
FROM journal_entries
WHERE credit_account IS NOT NULL
GROUP BY tenant_id, fiscal_year, credit_account;

COMMENT ON VIEW v_soldes_syscohada IS 'Mouvements bruts débit/crédit par compte SYSCOHADA, par exercice et tenant';

-- ── 6. Vue soldes nets SYSCOHADA (débit - crédit) ────────────────────────────

CREATE OR REPLACE VIEW v_soldes_nets_syscohada AS
SELECT
  tenant_id,
  fiscal_year,
  compte,
  SUM(CASE WHEN sens = 'debit'  THEN total ELSE 0 END) AS total_debit,
  SUM(CASE WHEN sens = 'credit' THEN total ELSE 0 END) AS total_credit,
  SUM(CASE WHEN sens = 'debit'  THEN total ELSE 0 END)
  - SUM(CASE WHEN sens = 'credit' THEN total ELSE 0 END) AS solde_net
FROM v_soldes_syscohada
GROUP BY tenant_id, fiscal_year, compte
ORDER BY tenant_id, fiscal_year, compte;

COMMENT ON VIEW v_soldes_nets_syscohada IS 'Soldes nets SYSCOHADA (débit−crédit) par compte, exercice et tenant — base pour bilan/résultat/flux';

-- ── 7. (OPTIONNEL) Normalisation des anciens comptes 6 chiffres ─────────────
-- Exécuter uniquement si vous souhaitez migrer les anciennes écritures
-- Décommentez les lignes ci-dessous APRÈS avoir vérifié les données

/*
UPDATE journal_entries SET debit_account  = '661' WHERE debit_account  = '641000' AND source = 'paie';
UPDATE journal_entries SET credit_account = '661' WHERE credit_account = '641000' AND source = 'paie';
UPDATE journal_entries SET debit_account  = '422' WHERE debit_account  = '421000' AND source = 'paie';
UPDATE journal_entries SET credit_account = '422' WHERE credit_account = '421000' AND source = 'paie';
UPDATE journal_entries SET debit_account  = '664' WHERE debit_account  = '644000' AND source = 'paie';
UPDATE journal_entries SET credit_account = '664' WHERE credit_account = '644000' AND source = 'paie';
UPDATE journal_entries SET debit_account  = '431' WHERE debit_account  = '431000';
UPDATE journal_entries SET credit_account = '431' WHERE credit_account = '431000';
UPDATE journal_entries SET debit_account  = '521' WHERE debit_account  = '521000';
UPDATE journal_entries SET credit_account = '521' WHERE credit_account = '521000';
UPDATE journal_entries SET debit_account  = '571' WHERE debit_account  = '571000';
UPDATE journal_entries SET credit_account = '571' WHERE credit_account = '571000';
UPDATE journal_entries SET debit_account  = '601' WHERE debit_account  = '601000';
UPDATE journal_entries SET credit_account = '601' WHERE credit_account = '601000';
UPDATE journal_entries SET debit_account  = '401' WHERE debit_account  = '401000';
UPDATE journal_entries SET credit_account = '401' WHERE credit_account = '401000';
UPDATE journal_entries SET debit_account  = '411' WHERE debit_account  = '411000';
UPDATE journal_entries SET credit_account = '411' WHERE credit_account = '411000';
UPDATE journal_entries SET debit_account  = '447' WHERE debit_account  = '447000';
UPDATE journal_entries SET credit_account = '447' WHERE credit_account = '447000';
*/

-- ── 8. Grant accès aux vues ──────────────────────────────────────────────────

GRANT SELECT ON v_soldes_syscohada     TO authenticated, service_role;
GRANT SELECT ON v_soldes_nets_syscohada TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_syscohada_charge_account(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_syscohada_cash_account(TEXT)   TO authenticated, service_role;
