-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 119 — Correction SYSCOHADA : codes comptables + contrainte type_compte
-- Corrige les codes 6 chiffres en codes SYSCOHADA 2-5 chiffres dans journal_entries
-- Corrige la mauvaise normalisation 073 (421000→422, doit être 421)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Normaliser les comptes SALAIRES (Bug 8 : 422 → 421) ──────────────────
-- La migration 073 avait mappé 421000 → '422' (avances et acomptes) au lieu de '421' (rémunérations dues)
-- Résultat : écritures paie avec débit '661' crédit '422' (faux) au lieu de '661'/'421'

UPDATE journal_entries
SET credit_account = '421'
WHERE credit_account = '422'
  AND source = 'paie';

UPDATE journal_entries
SET debit_account = '421'
WHERE debit_account = '422'
  AND source = 'paie';

-- Normaliser les codes 6-chiffres restants pour les écritures paie ──────────
UPDATE journal_entries SET debit_account  = '661' WHERE debit_account  IN ('641000','661000') AND source = 'paie';
UPDATE journal_entries SET credit_account = '661' WHERE credit_account IN ('641000','661000') AND source = 'paie';
UPDATE journal_entries SET debit_account  = '421' WHERE debit_account  IN ('421000','422000') AND source = 'paie';
UPDATE journal_entries SET credit_account = '421' WHERE credit_account IN ('421000','422000') AND source = 'paie';
UPDATE journal_entries SET debit_account  = '664' WHERE debit_account  IN ('644000','664000') AND source = 'paie';
UPDATE journal_entries SET credit_account = '664' WHERE credit_account IN ('644000','664000') AND source = 'paie';
UPDATE journal_entries SET debit_account  = '447' WHERE debit_account  IN ('447000') AND source = 'paie';
UPDATE journal_entries SET credit_account = '447' WHERE credit_account IN ('447000') AND source = 'paie';

-- ── 2. Normaliser les comptes TVA (Bug 2 : 443000/441000 → 4441) ─────────────
-- Les triggers anciens écrivaient '443000' ou '441000' pour TVA collectée
-- SYSCOHADA Congo : compte 4441 = TVA sur ventes / TVA collectée

UPDATE journal_entries SET credit_account = '4441' WHERE credit_account IN ('443000','441000','4410') AND source = 'facture';
UPDATE journal_entries SET debit_account  = '4441' WHERE debit_account  IN ('443000','441000','4410') AND source = 'facture';

-- ── 3. Normaliser les codes trésorerie universels ────────────────────────────
-- Banque, Caisse, CNSS, Clients, Fournisseurs

UPDATE journal_entries SET debit_account  = '521' WHERE debit_account  = '521000';
UPDATE journal_entries SET credit_account = '521' WHERE credit_account = '521000';
UPDATE journal_entries SET debit_account  = '571' WHERE debit_account  = '571000';
UPDATE journal_entries SET credit_account = '571' WHERE credit_account = '571000';
UPDATE journal_entries SET debit_account  = '431' WHERE debit_account  = '431000';
UPDATE journal_entries SET credit_account = '431' WHERE credit_account = '431000';
UPDATE journal_entries SET debit_account  = '411' WHERE debit_account  = '411000';
UPDATE journal_entries SET credit_account = '411' WHERE credit_account = '411000';
UPDATE journal_entries SET debit_account  = '401' WHERE debit_account  = '401000';
UPDATE journal_entries SET credit_account = '401' WHERE credit_account = '401000';
UPDATE journal_entries SET debit_account  = '701' WHERE debit_account  = '701000';
UPDATE journal_entries SET credit_account = '701' WHERE credit_account = '701000';
UPDATE journal_entries SET debit_account  = '601' WHERE debit_account  = '601000';
UPDATE journal_entries SET credit_account = '601' WHERE credit_account = '601000';

-- ── 4. Trigger de normalisation automatique (prévenir les futures régressions) ─
CREATE OR REPLACE FUNCTION fn_normalize_journal_account_codes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  debit_norm  TEXT := NEW.debit_account;
  credit_norm TEXT := NEW.credit_account;
BEGIN
  -- Supprimer les suffixes '000' pour les codes 6 chiffres standards
  IF LENGTH(debit_norm) = 6 AND RIGHT(debit_norm, 3) = '000' THEN
    debit_norm := LEFT(debit_norm, 3);
  END IF;
  IF LENGTH(credit_norm) = 6 AND RIGHT(credit_norm, 3) = '000' THEN
    credit_norm := LEFT(credit_norm, 3);
  END IF;

  -- Corrections spécifiques connues (SYSCOHADA Congo)
  IF debit_norm IN ('441','443') AND NEW.source = 'facture' THEN debit_norm := '4441'; END IF;
  IF credit_norm IN ('441','443') AND NEW.source = 'facture' THEN credit_norm := '4441'; END IF;

  -- Paie : rémunérations dues = 421 (pas 422 qui est avances/acomptes)
  IF debit_norm = '422' AND NEW.source = 'paie' THEN debit_norm := '421'; END IF;
  IF credit_norm = '422' AND NEW.source = 'paie' THEN credit_norm := '421'; END IF;

  NEW.debit_account  := debit_norm;
  NEW.credit_account := credit_norm;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_account_codes ON journal_entries;
CREATE TRIGGER trg_normalize_account_codes
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION fn_normalize_journal_account_codes();

-- Note : ce trigger s'exécute AVANT fn_validate_journal_entry (103), les comptes
-- seront normalisés avant la validation. L'ordre des triggers est alphabétique :
-- trg_normalize_account_codes < trg_normalize_journal_accounts < trg_validate_journal_entry ✓

-- ── 5. Corriger la contrainte type_compte dans plan_comptable (Bug 14) ────────
-- La contrainte actuelle rejette 'fiscal', 'impot', 'bilan' comme types valides.
-- On étend la liste pour accepter les types SYSCOHADA complets.

ALTER TABLE plan_comptable
  DROP CONSTRAINT IF EXISTS plan_comptable_type_compte_check;

ALTER TABLE plan_comptable
  ADD CONSTRAINT plan_comptable_type_compte_check
    CHECK (type_compte IN (
      'actif', 'passif', 'capitaux', 'immobilisation', 'stock',
      'tresorerie', 'charge', 'produit',
      'fiscal', 'impot', 'bilan', 'resultat', 'tva', 'tiers'
    ));

-- ── 6. Recréer les index si migration 103 ne les a pas encore créés ──────────
CREATE INDEX IF NOT EXISTS idx_journal_entries_debit_year   ON journal_entries(tenant_id, fiscal_year, debit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_credit_year  ON journal_entries(tenant_id, fiscal_year, credit_account);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source       ON journal_entries(tenant_id, source);

-- ── 7. Vérification ──────────────────────────────────────────────────────────
-- Exécutez ces requêtes après la migration pour contrôler :
--
-- SELECT credit_account, COUNT(*) FROM journal_entries WHERE source = 'paie'
--   GROUP BY credit_account ORDER BY COUNT(*) DESC;
-- → Doit montrer 421, 431, 447, 521 (pas 422)
--
-- SELECT credit_account, COUNT(*) FROM journal_entries WHERE source = 'facture'
--   GROUP BY credit_account ORDER BY COUNT(*) DESC;
-- → Doit montrer 701, 4441, 447 (pas 443)
--
-- SELECT COUNT(*) FROM journal_entries WHERE LENGTH(debit_account) = 6;
-- → Doit retourner 0 après la migration

-- ── 8. Mise à jour fn_create_depense (Bug 13) ────────────────────────────────
-- La version initiale (migration 033) ne créait pas d'écriture dans journal_entries.
-- Les dépenses n'apparaissaient donc pas dans les KPIs comptables.
-- Le trigger trg_normalize_account_codes normalisera automatiquement les codes.

CREATE OR REPLACE FUNCTION fn_create_depense(
  p_categorie      TEXT,
  p_description    TEXT,
  p_montant        NUMERIC(12,0),
  p_date           DATE,
  p_mode_paiement  TEXT,
  p_reference      TEXT  DEFAULT NULL,
  p_cost_center_id UUID  DEFAULT NULL,
  p_debit_account  TEXT  DEFAULT '651',
  p_credit_account TEXT  DEFAULT '571'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id   UUID;
  v_dep_id    UUID;
BEGIN
  v_tenant_id := get_my_tenant_id();
  v_user_id   := auth.uid();

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'non authentifié ou aucun tenant';
  END IF;

  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'le montant doit être positif';
  END IF;

  INSERT INTO depenses (
    tenant_id,        categorie,       description,
    montant,          date,            mode_paiement,
    reference_piece,  cost_center_id,  debit_account,
    credit_account,   created_by
  ) VALUES (
    v_tenant_id,      p_categorie,     p_description,
    p_montant,        p_date,          p_mode_paiement,
    p_reference,      p_cost_center_id, p_debit_account,
    p_credit_account, v_user_id
  )
  RETURNING id INTO v_dep_id;

  INSERT INTO transactions (
    tenant_id,       type,       categorie,
    description,     montant,    date,
    mode_paiement,   source,     source_id,
    debit_account,   credit_account, cost_center_id,
    created_by
  ) VALUES (
    v_tenant_id,    'sortie',   'Dépenses & Charges',
    p_description,  p_montant,  p_date,
    p_mode_paiement,'depense',  v_dep_id,
    p_debit_account, p_credit_account, p_cost_center_id,
    v_user_id
  );

  -- Écriture OHADA dans journal_entries — manquante dans migration 033
  -- Le trigger trg_normalize_account_codes normalise automatiquement les codes
  INSERT INTO journal_entries (
    tenant_id,     date_operation,  libelle,
    debit_account, credit_account,  montant,
    source,        source_id,       fiscal_year
  ) VALUES (
    v_tenant_id,   p_date,          p_description,
    p_debit_account, p_credit_account, p_montant,
    'depense',     v_dep_id,        EXTRACT(YEAR FROM p_date)::INT
  );

  RETURN v_dep_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_depense TO authenticated;

-- ── 9. Backfill journal_entries pour les dépenses historiques ─────────────────
-- Insère les entrées manquantes pour les dépenses déjà enregistrées
-- qui n'ont pas d'écriture journal_entries correspondante.

INSERT INTO journal_entries (
  tenant_id, date_operation, libelle,
  debit_account, credit_account, montant,
  source, source_id, fiscal_year
)
SELECT
  d.tenant_id,
  d.date,
  d.description,
  COALESCE(d.debit_account, '658'),
  COALESCE(d.credit_account, '571'),
  d.montant,
  'depense',
  d.id,
  EXTRACT(YEAR FROM d.date)::INT
FROM depenses d
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.source = 'depense'
    AND je.source_id = d.id
);

COMMIT;
