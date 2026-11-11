-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 182 — RES-001/SAN-001/HOT-001/BOI-001 : séparer TVA (4441) et
-- Centime Additionnel (447), même architecture que FAC-001 (139) et BTP-001 (181)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission P0-FISCAL-CG-2026 — correction transversale TVA + Centime Additionnel
-- (2026-09-18), suite de l'audit ayant identifié le même défaut structurel que
-- BTP-001 dans 4 autres modules.
--
-- CAUSE RACINE (identique à BTP-001, confirmée séparément pour chacun des 4
-- modules avant cette migration) :
--   Chaque route calculait localement TVA+Centime Additionnel fusionnés
--   (RES-001 : calculerTVACongo().tva + .ca ; SAN-001/HOT-001/BOI-001 :
--   montant / 1.189) et postait le tout dans p_montant_tva. Les règles
--   séquence 2 (RES-001 migration 142, SAN-001 migration 140, HOT-001
--   migration 144, BOI-001 migration 146 — TOUTES INCHANGÉES ici) postent
--   montant_tva intégralement sur 4441 : le Centime Additionnel (5% de la
--   TVA, une taxe SYSCOHADA distincte) se retrouvait comptabilisé comme de
--   la TVA. Le code applicatif des 4 modules est déjà corrigé séparément
--   (app/api/resto/commandes, app/api/sante/{facturation,consultations},
--   app/api/hotel/payments, app/api/boisson/tournees) — cette migration
--   n'active que le côté comptable, sur le modèle déjà en production pour
--   FAC-001 et BTP-001.
--
-- DIFFÉRENCES MÉTIER PAR MODULE — PAS DE MODÈLE UNIQUE COPIÉ MÉCANIQUEMENT :
--   RES-001/HOT-001/BOI-001 sont des ventes immédiates encaissées (compte
--   client 411 jamais ouvert, débit = trésorerie via account_resolver
--   'treasury_debit' comme leurs séquences 1/2 existantes) — leur séquence 3
--   CA doit donc débiter la trésorerie, pas 411.
--   SAN-001 fonctionne comme FAC-001/BTP-001 : facture émise avant règlement
--   (débit = 411 Clients, statique, pas de treasury_debit) — sa séquence 3
--   CA débite donc 411, exactement comme FAC-001/BTP-001.
--
-- NON DÉTERMINÉ, NON TRAITÉ ICI : l'exonération TVA éventuelle de certains
-- actes médicaux (note déjà présente sur SAN-001 séquence 2 depuis la
-- migration 140, jamais résolue, non modifiée ici) ; l'existence d'un droit
-- d'accise Congo distinct sur la vente de boissons (aucune preuve trouvée
-- dans ce dépôt) ; une éventuelle taxe de séjour hôtelière (aucune preuve
-- trouvée). Cette migration ne fait que corriger la séparation TVA/CA sur le
-- régime déjà assumé par le code existant — elle ne tranche aucune de ces
-- questions fiscales.
--
-- CORRECTION :
--   Le compte du Centime Additionnel N'EST PAS inventé : précédent déjà
--   actif — FAC-001 séquence 3 (migration 139) et BTP-001 séquence 3
--   (migration 181), toutes deux 411/447 metadata.ca CG uniquement. Les 4
--   séquences ajoutées ici suivent exactement la même règle de compte (447)
--   et de restriction pays (country_codes=['CG']), en respectant pour
--   chaque module le schéma débit/résolveur de ses propres séquences 1/2
--   existantes (pas copié de BTP-001 sans vérification).
--
-- IDEMPOTENCE : chaque INSERT est gardé par WHERE NOT EXISTS — une
-- ré-exécution de cette migration ne crée aucun doublon et ne modifie rien
-- de plus. Aucune donnée métier, aucune écriture historique n'est touchée.
--
-- NE MODIFIE PAS : les taux 18%/5% eux-mêmes, la TVA déductible,
-- l'exigibilité, le module Cabinet, aucune règle de déclaration générale,
-- FAC-001, BTP-001 (déjà corrigées), PAI-001, BTP-002.
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER — NE PAS EXÉCUTER EN PRODUCTION DANS CETTE MISSION
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Corriger les notes des séquences 2 — montant_tva est la TVA PURE (18%)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE accounting_event_rules
SET notes = '4441=TVA collectee (Etat). montant_tva est la TVA PURE a 18% (Congo-Brazzaville), PAS TVA+CA fusionnes. Le Centime Additionnel (5% de cette TVA) est comptabilise separement en sequence 3 (521 treasury_debit/447) depuis la migration 182 - meme compte que FAC-001/BTP-001 sequence 3.'
WHERE event_type = 'RES-001' AND sequence = 2;

UPDATE accounting_event_rules
SET notes = '521=meme compte tresorerie que seq 1 (treasury_debit). 4441=Etat, TVA collectee PURE a 18%, PAS TVA+CA fusionnes (18,9%). Le Centime Additionnel est comptabilise separement en sequence 3 (521 treasury_debit/447) depuis la migration 182.'
WHERE event_type = 'HOT-001' AND sequence = 2;

UPDATE accounting_event_rules
SET notes = '521=meme compte tresorerie que seq 1 (treasury_debit). 4441=Etat, TVA collectee PURE a 18%, PAS TVA+CA fusionnes. Le Centime Additionnel est comptabilise separement en sequence 3 (521 treasury_debit/447) depuis la migration 182.'
WHERE event_type = 'BOI-001' AND sequence = 2;

UPDATE accounting_event_rules
SET notes = 'TVA collectee PURE a 18% sur soins medicaux (Congo-Brazzaville LF 2026), PAS TVA+CA fusionnes. Le Centime Additionnel est comptabilise separement en sequence 3 (411/447) depuis la migration 182 - meme compte que FAC-001/BTP-001 sequence 3. Attention (inchange depuis migration 140, NON DETERMINE) : certains actes medicaux peuvent etre exoneres de TVA selon la legislation nationale. Verifier avec la DGID Congo avant application sur soins preventifs/maternite/handicap.'
WHERE event_type = 'SAN-001' AND sequence = 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ajouter la séquence 3 — Centime Additionnel (CA) → 447, par module
-- ─────────────────────────────────────────────────────────────────────────────
-- RES-001/HOT-001/BOI-001 : ventes immédiates encaissées, débit = trésorerie
-- (account_resolver='treasury_debit'), comme leurs séquences 1/2 existantes.
-- SAN-001 : facture émise avant règlement, débit = 411 Clients (statique),
-- comme FAC-001/BTP-001.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
)
SELECT 'RES-001', 3, 1, 'active',
  '521', '447',
  'metadata.ca', NULL, 'treasury_debit',
  'res_ca',
  'Vente POS {libelle} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],
  'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectee. 447 = Retenues a la source - meme compte et meme mecanisme que FAC-001/BTP-001 sequence 3. Debit resolu par treasury_debit, comme RES-001 sequences 1/2 (vente immediate encaissee, pas de compte client 411).'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_event_rules WHERE event_type = 'RES-001' AND sequence = 3
);

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
)
SELECT 'HOT-001', 3, 1, 'active',
  '521', '447',
  'metadata.ca', NULL, 'treasury_debit',
  'hot_ca',
  'Encaissement {libelle} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],
  'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectee. 447 = Retenues a la source - meme compte et meme mecanisme que FAC-001/BTP-001 sequence 3. Debit resolu par treasury_debit, comme HOT-001 sequences 1/2 (encaissement direct, pas de compte client 411).'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_event_rules WHERE event_type = 'HOT-001' AND sequence = 3
);

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
)
SELECT 'BOI-001', 3, 1, 'active',
  '521', '447',
  'metadata.ca', NULL, 'treasury_debit',
  'boi_ca',
  'Tournée {libelle} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],
  'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectee. 447 = Retenues a la source - meme compte et meme mecanisme que FAC-001/BTP-001 sequence 3. Debit resolu par treasury_debit, comme BOI-001 sequences 1/2 (vente immediate encaissee, pas de compte client 411).'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_event_rules WHERE event_type = 'BOI-001' AND sequence = 3
);

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
)
SELECT 'SAN-001', 3, 1, 'active',
  '411', '447',
  'metadata.ca', NULL, NULL,
  'san_ca',
  'Facture médicale {libelle} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],
  'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectee. 447 = Retenues a la source - meme compte et meme mecanisme que FAC-001/BTP-001 sequence 3. Debit statique 411 (Clients), comme SAN-001 sequences 1/2 (facture emise avant reglement, meme schema que FAC-001/BTP-001, pas de treasury_debit).'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_event_rules WHERE event_type = 'SAN-001' AND sequence = 3
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Version moteur 1.10.2 (patch — pas de nouvelle règle event_type, correction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
SELECT
  '1.10.2', 1, 10, 2,
  '182_fix_res_san_hot_boi_tva_ca_separation.sql',
  'Mission P0-FISCAL-CG-2026 — RES-001/HOT-001/BOI-001/SAN-001 sequence 3 ajoutee '
  '(447, metadata.ca, CG uniquement) - meme precedent que FAC-001/BTP-001 sequence 3. '
  'Notes sequence 2 corrigees : montant_tva = TVA pure 18%, pas TVA+CA fusionnes. '
  'Corrige la contamination de computeTVAFromJournal() par le Centime Additionnel '
  'de ces 4 modules.',
  FALSE,
  'Mission P0-FISCAL-CG-2026 — correction transversale TVA+CA'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_schema_versions WHERE version = '1.10.2'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VALIDATION POST-EXÉCUTION (à exécuter séparément dans Supabase)
-- ═════════════════════════════════════════════════════════════════════════════
/*
-- 1. Les 4 event_types ont désormais 3 séquences actives chacun
SELECT event_type, sequence, debit_account, credit_account, montant_field, account_resolver, country_codes, status
FROM accounting_event_rules
WHERE event_type IN ('RES-001','SAN-001','HOT-001','BOI-001')
ORDER BY event_type, sequence;
-- Attendu : 3 lignes par event_type
--   RES-001/HOT-001/BOI-001 séq3 : 521(treasury_debit)/447/metadata.ca/[CG]
--   SAN-001 séq3               : 411/447/metadata.ca/[CG] (pas de resolver)

-- 2. Aucun doublon de séquence 3
SELECT event_type, COUNT(*) FROM accounting_event_rules
WHERE event_type IN ('RES-001','SAN-001','HOT-001','BOI-001') AND sequence = 3
GROUP BY event_type HAVING COUNT(*) != 1;
-- Attendu : 0 ligne (aucune anomalie)

-- 3. Test emit_accounting_event non destructif — voir rapport de mission pour le
--    scénario complet par module (tous ne partagent pas forcément HT=500000).

-- 4. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC, semver_patch DESC LIMIT 4;
-- Attendu : 1.10.2, 1.10.1, 1.10.0, 1.9.0
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK (NE PAS EXÉCUTER — sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type IN ('RES-001','SAN-001','HOT-001','BOI-001') AND sequence = 3;

UPDATE accounting_event_rules SET notes = '4441=TVA collectée. montant_tva=TVA(18%)+CA(5%/TVA) via calculerTVACongo().'
WHERE event_type = 'RES-001' AND sequence = 2;

UPDATE accounting_event_rules SET notes = '521=même compte trésorerie que séq 1. 4441=État, TVA collectée (18% + CA 5%/TVA). Congo: TTC = HT × 1.189. api calcule ht=round(ttc/1.189), tva=ttc-ht avant emit.'
WHERE event_type = 'HOT-001' AND sequence = 2;

UPDATE accounting_event_rules SET notes = '521=même compte trésorerie que séq 1. 4441=État, TVA collectée. Congo: TTC=HT×1.189 (TVA18%+CA0.9%). API calcule: ht=round(ttc/1.189), tva=ttc-ht avant emit.'
WHERE event_type = 'BOI-001' AND sequence = 2;

UPDATE accounting_event_rules SET notes = 'TVA collectée 18% sur soins médicaux (Congo-Brazzaville LF 2026). Attention : certains actes médicaux peuvent être exonérés de TVA selon la législation nationale. Vérifier avec la DGID Congo avant application sur soins préventifs/maternité/handicap.'
WHERE event_type = 'SAN-001' AND sequence = 2;

DELETE FROM accounting_schema_versions WHERE version = '1.10.2';
COMMIT;
*/
