-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 181 — BTP-001 : séparer TVA (4441) et Centime Additionnel (447)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission P0-FISCAL-CG-2026 — correction BTP-001 / TVA → comptabilité (2026-09-18)
--
-- CAUSE RACINE :
--   app/api/btp/chantiers/route.ts calculait montantTVA = montantHT × 0.189
--   (18% TVA + 5% Centime Additionnel de la TVA, fusionnés en UN SEUL montant)
--   et le passait tel quel à p_montant_tva. La règle BTP-001 séquence 2
--   (migration 148, INCHANGÉE ici) poste montant_tva intégralement sur 4441
--   (TVA facturée collectée). Résultat : chaque écriture BTP postait 18,9% de
--   TVA sur 4441 au lieu de 18% — le Centime Additionnel (5% de la TVA, une
--   taxe SYSCOHADA distincte) se retrouvait comptabilisé comme de la TVA.
--
--   Conséquence démontrée : lib/erp-core/compute/accounting.ts::
--   computeTVAFromJournal() (source canonique de la déclaration TVA depuis la
--   mission P0-FISCAL-CG-2026 précédente) lit TOUS les crédits sur 4441/4442
--   comme de la TVA collectée — elle surestimait donc la TVA de tout tenant
--   utilisant le module BTP, sans qu'aucun signal ne le révèle.
--
-- CORRECTION :
--   Le compte du Centime Additionnel N'EST PAS inventé ici : il est démontré
--   par un précédent déjà actif dans ce même moteur de règles — FAC-001
--   séquence 3 (migration 139), qui poste déjà metadata.ca sur 411/447
--   (Retenues à la source) pour la facturation générale, restreint au Congo
--   (country_codes = ARRAY['CG']). BTP-001 reçoit exactement la même
--   troisième séquence, au même compte, pour la même raison.
--
--   app/api/btp/chantiers/route.ts (modifié dans le même lot, hors SQL) calcule
--   désormais tva et ca séparément via lib/fiscalite/engine-adapter.ts::
--   calculerTVASurMontantUnifie() — aucun taux recopié dans le routeur — et
--   passe p_montant_tva = tva (pur, 18%) + p_metadata.ca = ca (Centime
--   Additionnel, 5% de la TVA), exactement comme FAC-001 le fait déjà.
--
--   BTP-001 séquence 1 (411/722, montant_ht) et séquence 2 (411/4441,
--   montant_tva) ne changent PAS de forme : seule la note de la séquence 2
--   est corrigée (elle décrivait par erreur un montant à 18,9%, alors que le
--   champ montant_tva a toujours été destiné à porter la TVA pure — c'est
--   l'appelant, pas la règle, qui envoyait le mauvais chiffre).
--
-- NE MODIFIE PAS : les taux 18%/5% eux-mêmes, la TVA déductible, l'exigibilité,
-- le module Cabinet, ni aucune règle de déclaration générale.
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Corriger la note de BTP-001 séquence 2 — montant_tva est la TVA PURE (18%)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE accounting_event_rules
SET notes = '4441=TVA facturée collectée (classe 4 — Etat). montant_tva est la TVA PURE a 18% (Congo-Brazzaville), PAS le montant combine 18,9%. Le Centime Additionnel (5% de cette TVA) est une taxe distincte, comptabilisee separement en sequence 3 (411/447) depuis la migration 181 - meme compte que FAC-001 sequence 3. Conditions : montant_tva > 0 -> si exonere (marches Etat exoneres selon CGI), mettre montant_tva=0 a l emit.'
WHERE event_type = 'BTP-001' AND sequence = 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ajouter BTP-001 séquence 3 — Centime Additionnel (CA) → 447
-- ─────────────────────────────────────────────────────────────────────────────
-- Précédent démontré : FAC-001 séquence 3 (migration 139), même compte (447),
-- même champ (metadata.ca), même restriction pays (CG uniquement).

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-001', 3, 1, 'active',
  '411', '447',
  'metadata.ca', NULL, NULL,
  'btp_ca',
  'Chantier BTP — {libelle} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],
  'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectee (= 0,9% du HT). 447 = Retenues a la source - meme compte et meme mecanisme que FAC-001 sequence 3 (migration 139). Sequence ajoutee migration 181 : avant cette date, le Centime Additionnel etait fusionne dans montant_tva et comptabilise a tort sur 4441.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Version moteur 1.10.1 (patch — pas de nouvelle règle event_type, correction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.10.1', 1, 10, 1,
  '181_fix_btp001_tva_ca_separation.sql',
  'Mission P0-FISCAL-CG-2026 — BTP-001 sequence 3 ajoutee (411/447, metadata.ca, CG uniquement), '
  'meme precedent que FAC-001 sequence 3. Note BTP-001 sequence 2 corrigee : montant_tva = TVA pure 18%, '
  'pas 18,9%. Corrige la contamination de computeTVAFromJournal() par le Centime Additionnel BTP.',
  FALSE,
  'Mission P0-FISCAL-CG-2026 — correction BTP-001/TVA'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VALIDATION POST-EXÉCUTION (à exécuter séparément dans Supabase)
-- ═════════════════════════════════════════════════════════════════════════════
/*
-- 1. BTP-001 a désormais 3 séquences actives
SELECT event_type, sequence, debit_account, credit_account, montant_field, status
FROM accounting_event_rules
WHERE event_type = 'BTP-001'
ORDER BY sequence;
-- Attendu : 3 lignes (1: 411/722 montant_ht, 2: 411/4441 montant_tva, 3: 411/447 metadata.ca)

-- 2. Test emit_accounting_event avec TVA et CA séparés
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'BTP-001',
  p_source_module := 'btp',
  p_source_table  := 'btp_chantiers',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 500000,
  p_montant_tva   := 90000,    -- 500000 x 18%
  p_montant_ttc   := 594500,   -- 500000 + 90000 + 4500
  p_libelle       := 'Test BTP-001 migration 181 — Chantier Route Nationale',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"ca": 4500, "country_code": "CG"}'::jsonb
);
-- Attendu : 3 écritures (411/722 500000, 411/4441 90000, 411/447 4500)

-- 3. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC, semver_patch DESC LIMIT 3;
-- Attendu : 1.10.1, 1.10.0, 1.9.0
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK (NE PAS EXÉCUTER — sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type = 'BTP-001' AND sequence = 3;
UPDATE accounting_event_rules
SET notes = '4441=TVA facturee collectee (classe 4 - Etat). BTP soumis TVA 18% + Centime Additionnel 5%/TVA = 18.9% effectif (Congo-Brazzaville). Conditions : montant_tva > 0 -> si exonere (marches Etat exoneres selon CGI), mettre montant_tva=0 a l emit.'
WHERE event_type = 'BTP-001' AND sequence = 2;
DELETE FROM accounting_schema_versions WHERE version = '1.10.1';
COMMIT;
*/
