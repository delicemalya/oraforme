-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 185 — Vente canonique (C6) : ventes/vente_lignes, VTE-001, VTE-002
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission P0-C6 · docs/C6-IMPLEMENTATION-DESIGN.md, C6-PRODUCT-DECISIONS.md,
-- C6-PREIMPLEMENTATION-GATE.md, C6-IMPLEMENTATION-REPORT.md
--
-- CONTEXTE
--   ventes/vente_lignes existent déjà en production (0 ligne), compatibles
--   avec app/dashboard/commerce/page.tsx (POS). Elles ne portent aucune
--   colonne fiscale et ne permettent pas de distinguer une vente déjà traitée
--   d'un doublon (double-clic/retry). Le POS et stocks/sorties n'émettent
--   aujourd'hui aucune écriture comptable (confirmé par recherche exhaustive,
--   docs/C6-VENTE-CANONICAL-DESIGN.md §1).
--
--   D1 (C6-PRODUCT-DECISIONS) : fiscalité au niveau `ventes` uniquement —
--   précédent direct factures/facture_lignes (facture_lignes ne porte aucune
--   colonne fiscale), confirmé par introspection PostgREST.
--
--   Idempotence (C6-PREIMPLEMENTATION-GATE §6) : aucune clé métier naturelle
--   n'existe pour une vente (contrairement à bulletins_paie). Choix retenu :
--   étendre à `ventes` le même patron technique déjà prouvé sur
--   accounting_events (index UNIQUE partiel scopé tenant) — idempotency_key
--   générée côté client, UNIQUE par (tenant_id, idempotency_key).
--
--   VTE-001 (C6-IMPLEMENTATION-REPORT) : conçu à l'origine à 4 séquences,
--   PORTÉ À 7 au moment d'écrire cette migration — découverte faite en
--   écrivant ce fichier, pas supposée : uidx_aer_version (migration 138) est
--   UNIQUE sur (event_type, sequence, rule_version), donc une même séquence
--   ne peut pas avoir deux variantes de compte (521 résolu vs 411 statique)
--   sous le même numéro de séquence. Les variantes comptant/crédit du
--   revenu/TVA/CA deviennent donc 2×3 séquences distinctes (conditions
--   mutuellement exclusives sur metadata.mode_paiement), + 1 séquence coût —
--   7 au total. Aucun compte inventé : 701/4441/447/411/601/311 sont tous
--   des précédents déjà prouvés (BOI-001, FAC-001/002, STK-002).
--
--   fn_ae_is_income/fn_ae_has_treasury_impact (classification legacy,
--   vestigiale pour le solde réel depuis la migration 175 qui synchronise
--   fn_sync_tresorerie_soldes sur les comptes 5xx réellement touchés, pas sur
--   cette liste — confirmé par la requête de contrôle de la migration 175
--   elle-même) : VOLONTAIREMENT NON MODIFIÉES. VTE-001 mélange comptant et
--   crédit sous un même event_type — y ajouter 'VTE' classerait aussi les
--   ventes à crédit (sans impact de caisse) comme un encaissement, ce que
--   fn_ae_is_income ne peut pas distinguer à ce niveau de granularité. Risque
--   documenté : un éventuel rapport encore basé sur cette liste (pas le solde
--   réel) n'afficherait pas les ventes comptant VTE-001 dans sa catégorie —
--   voir docs/C6-IMPLEMENTATION-REPORT.md §15.
--
--   STK-002 n'est pas modifiée et son identité n'est pas réutilisée pour la
--   vente (consigne explicite de toutes les missions C6 précédentes).
--
-- DÉPENDANCE RUNTIME (pas seulement SQL) : le code applicatif de cette
-- mission (app/api/sales/*) appelle fn_stock_move avec p_origine/
-- p_purchase_item_id — CETTE MIGRATION NE DÉPEND PAS DE 184 AU NIVEAU SQL
-- (aucun objet d'ici ne référence stock_movements.origine), mais le FLUX
-- COMPLET (vente avec choix de provenance) ne fonctionnera qu'après que 184
-- soit appliquée. Sans 184, fn_stock_move reste à 8 paramètres : les appels
-- applicatifs qui lui passent p_origine échoueraient (paramètre inconnu).
-- Voir docs/C6-PREIMPLEMENTATION-GATE.md §3.
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
    WHERE table_schema = 'public' AND table_name = 'ventes' AND column_name = 'montant_ht'
  ) THEN
    RAISE EXCEPTION 'ventes.montant_ht existe déjà — état différent du diagnostic C6, ne pas appliquer aveuglément';
  END IF;
END $$;

-- 1. Colonnes additives sur ventes (D1 : fiscalité au niveau vente uniquement —
--    vente_lignes reste inchangée, aucune colonne fiscale par ligne)
ALTER TABLE ventes
  ADD COLUMN montant_ht       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN montant_tva      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN montant_ca       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN statut_paiement  TEXT    NOT NULL DEFAULT 'paye',
  ADD COLUMN destinataire     TEXT    NULL,
  ADD COLUMN idempotency_key  UUID    NULL;

ALTER TABLE ventes
  ADD CONSTRAINT ventes_statut_paiement_check
  CHECK (statut_paiement IN ('paye', 'du', 'solde'));

COMMENT ON COLUMN ventes.montant_ht IS
  'HT de la vente, décomposé depuis le TTC (total) via decomposerTTCUnifie — jamais un taux recopié localement.';
COMMENT ON COLUMN ventes.statut_paiement IS
  'paye = comptant ou crédit déjà réglé. du = crédit non réglé. solde = crédit réglé après coup (VTE-002).';
COMMENT ON COLUMN ventes.destinataire IS
  'Client nommé — alimenté par la branche vente de stocks/sorties (D2) ; NULL pour une vente comptoir POS.';
COMMENT ON COLUMN ventes.idempotency_key IS
  'Générée côté client (UUID), transmise une fois par tentative de validation. UNIQUE par tenant (idx ci-dessous) — jamais une clé métier dérivée du contenu de la vente.';

-- 2. Idempotence — même patron que uidx_ae_processed (migration 138) : index
--    UNIQUE partiel, scopé tenant. tenant A + clé X et tenant B + clé X restent
--    tous deux possibles (clé composite incluant tenant_id).
CREATE UNIQUE INDEX idx_ventes_tenant_idempotency
  ON ventes (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. RÈGLES VTE-001 — Vente de marchandises, comptant et crédit (7 séquences,
--    voir note d'en-tête sur la contrainte uidx_aer_version découverte en
--    écrivant cette migration)
-- ─────────────────────────────────────────────────────────────────────────────

-- Séquence 1 — Revenu, comptant (resolver treasury_debit, identique à BOI-001)
--
-- C6-185-FIX (post-exécution réelle, docs/DB-LOCAL-C6-HARNESS.md §11) :
-- debit_account était NULL ici à l'origine — violation de
-- accounting_event_rules.debit_account NOT NULL (migration 138), détectée
-- SEULEMENT par exécution réelle contre PostgreSQL (jamais par une revue
-- statique). Corrigé au même placeholder que le précédent déjà prouvé
-- FAC-002 (migration 139, séq.1) : '521', explicitement "remplacé par
-- account_resolver" — confirmé par lecture de fn_ae_execute_event
-- (migrations 142.5/175) : `CASE v_rule.account_resolver WHEN
-- 'treasury_debit' THEN v_debit := fn_ae_resolve_treasury(...)` écrase
-- v_debit sans condition, donc la valeur stockée ici n'est jamais lue à
-- l'exécution — seul son caractère NOT NULL compte.
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 1, 1, 'active',
  '521', '701',
  'montant_ht', NULL, 'treasury_debit',
  'ventes_comptant', 'Vente {reference} — {libelle}',
  '[{"field":"metadata.mode_paiement","op":"!=","value":"credit"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Revenu marchandises, vente comptant. 701=Ventes de marchandises (précédent BOI-001, pas 706 — vente de marchandise physique, pas un service). Compte débité résolu par mode_paiement (treasury_debit), identique au mécanisme déjà utilisé par BOI-001/RES-001/SAN-001/HOT-001. debit_account=521 est un placeholder (remplacé par account_resolver), même patron que FAC-002 — corrigé par C6-185-FIX, voir en-tête de bloc.'
);

-- Séquence 2 — TVA, comptant
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 2, 1, 'active',
  '521', '4441',
  'montant_tva', NULL, 'treasury_debit',
  'ventes_comptant', 'Vente {reference} — TVA',
  '[{"field":"metadata.mode_paiement","op":"!=","value":"credit"},{"field":"montant_tva","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'TVA collectée, vente comptant. Condition montant_tva>0 : même mécanisme que SAN-001 (lib/fiscalite/sante-exonerations.ts) pour une vente exonérée — aucune ligne si le HT transmis est hors taxe (montant_tva=0 décidé par l''appelant, jamais recalculé ici). debit_account=521 : placeholder treasury_debit, voir note C6-185-FIX séq.1.'
);

-- Séquence 3 — Centime Additionnel, comptant
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 3, 1, 'active',
  '521', '447',
  'metadata.ca', NULL, 'treasury_debit',
  'ventes_comptant', 'Vente {reference} — Centime Additionnel',
  '[{"field":"metadata.mode_paiement","op":"!=","value":"credit"},{"field":"metadata.ca","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel (5% de la TVA), vente comptant. 447 = même compte que FAC-001 séq.3 / BTP-001 / RES-001/SAN-001/HOT-001/BOI-001 (migrations 139/181/182). debit_account=521 : placeholder treasury_debit, voir note C6-185-FIX séq.1. montant_field/conditions=metadata.ca (C6-185-CA-FIX, docs/C6-185-CA-FIX-VALIDATION.md) : "montant_ca" N''EST PAS un champ reconnu par fn_ae_resolve_montant (accounting_events n''a pas de colonne montant_ca) — corrigé au même patron que FAC-001/139 ("CA est passé dans metadata.ca par l''appelant"), confirmé par exécution PostgreSQL réelle.'
);

-- Séquence 4 — Revenu, crédit (411 statique — pas de resolver, 411 ne dépend
-- pas du moyen de paiement)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 4, 1, 'active',
  '411', '701',
  'montant_ht', NULL, NULL,
  'ventes_credit', 'Vente à crédit {reference} — {destinataire}',
  '[{"field":"metadata.mode_paiement","op":"=","value":"credit"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Revenu marchandises, vente à crédit (D3). 411=Clients (précédent FAC-001 séq.1), 701 identique à la variante comptant. Réglée plus tard par VTE-002 (structure FAC-002, 521/411).'
);

-- Séquence 5 — TVA, crédit
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 5, 1, 'active',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'ventes_credit', 'Vente à crédit {reference} — TVA',
  '[{"field":"metadata.mode_paiement","op":"=","value":"credit"},{"field":"montant_tva","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'TVA collectée, vente à crédit. Même condition d''exonération que la variante comptant.'
);

-- Séquence 6 — Centime Additionnel, crédit
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 6, 1, 'active',
  '411', '447',
  'metadata.ca', NULL, NULL,
  'ventes_credit', 'Vente à crédit {reference} — Centime Additionnel',
  '[{"field":"metadata.mode_paiement","op":"=","value":"credit"},{"field":"metadata.ca","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Centime Additionnel, vente à crédit. montant_field/conditions=metadata.ca, même correctif que séq.3 (C6-185-CA-FIX).'
);

-- Séquence 7 — Coût des marchandises vendues (comptant ET crédit — le bien
-- quitte physiquement le stock dans les deux cas, précédent STK-002 pour les
-- comptes, MAIS IDENTITÉ DISTINCTE : STK-002 reste réservé à la sortie non
-- facturée, cf. sa propre documentation, migration 147 ligne 177)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-001', 7, 1, 'active',
  '601', '311',
  'metadata.cout_marchandises', NULL, NULL,
  'ventes_cout', 'Vente {reference} — coût des marchandises vendues',
  '[{"field":"metadata.cout_marchandises","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Coût de revient (quantité × products.prix_achat, même source que STK-002 — pas de PMP/FIFO, aucun des deux n''existe dans ce dépôt, BOI-009). 601=Achats de marchandises, 311=Marchandises (stock diminue). Comptabilisé que le paiement soit comptant ou crédit : le bien sort du stock à la vente, pas au règlement.'
);

-- 4. RÈGLE VTE-002 — Règlement d'une vente à crédit (structure FAC-002,
--    source_table='ventes' au lieu de 'factures')
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'VTE-002', 1, 1, 'active',
  '521', '411',
  'montant_ttc', NULL, 'treasury_debit',
  'ventes_reglement', 'Règlement vente à crédit {reference}',
  '[]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'Règlement d''une vente VTE-001 émise en crédit. Structure strictement identique à FAC-002 (migration 139, séq.1 : 521(resolver)/411, montant_ttc) — aucun nouveau mécanisme de paiement, source_table=''ventes'' au lieu de ''factures''. debit_account=521 : placeholder treasury_debit, voir note C6-185-FIX séq.1 de VTE-001.'
);

DO $$
BEGIN
  RAISE NOTICE 'Migration 185 OK — ventes/vente_lignes : colonnes fiscales + idempotency_key ; VTE-001 (7 séquences) ; VTE-002 (règlement crédit)';
END $$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (lecture seule, à exécuter après application)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public'
--   AND table_name='ventes' AND column_name IN
--   ('montant_ht','montant_tva','montant_ca','statut_paiement','destinataire','idempotency_key');
-- Attendu : les 6 colonnes présentes.
--
-- SELECT event_type, sequence, debit_account, credit_account, montant_field, conditions, status
--   FROM accounting_event_rules WHERE event_type IN ('VTE-001','VTE-002') ORDER BY event_type, sequence;
-- Attendu : 7 lignes VTE-001 (séq.1-7) + 1 ligne VTE-002, toutes 'active'.
--
-- -- Idempotence : deux INSERT ventes avec la même (tenant_id, idempotency_key)
-- -- doivent produire une violation 23505 sur la seconde, jamais deux lignes.
-- -- (contrôle fonctionnel réel, pas exécuté ici — voir plan de test)

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DELETE FROM accounting_event_rules WHERE event_type IN ('VTE-001','VTE-002');
-- DROP INDEX IF EXISTS idx_ventes_tenant_idempotency;
-- ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_statut_paiement_check;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS idempotency_key;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS destinataire;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS statut_paiement;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS montant_ca;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS montant_tva;
-- ALTER TABLE ventes DROP COLUMN IF EXISTS montant_ht;
-- COMMIT;
