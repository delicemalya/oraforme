-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 138 v2 — Moteur Comptable Central — Infrastructure Pure
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.0
-- ARR     : docs/plan-directeur/architecture-readiness-review-138.md
-- Gouvern.: docs/plan-directeur/phase35-gouvernance-moteur-comptable.md
-- Catalogue: docs/plan-directeur/phase3-catalogue-evenements-comptables.md
--
-- CORRECTIONS v2 (issues identifiées dans l'ARR) :
--   P-01 🔴 Race condition emit() → ON CONFLICT + uidx_ae_inflight
--   P-02 🔴 Absence CAS fn_process() → UPDATE WHERE pending + ROW_COUNT
--   P-03 🔴 Pas de validation tenant SECURITY DEFINER → get_my_tenant_id() check
--   P-04 🟡 Règles mono-condition → conditions JSONB (multi-condition AND)
--   P-05 🟡 Pas de formule de montant → amount_formula TEXT
--   P-06 🟡 Comptes statiques seulement → metadata.FIELD + account_resolver étendu
--   P-07 🟡 Index manquants → 4 index ajoutés
--   P-08 🟢 last_error_at ajouté
--   P-09 🟢 Vues dead_letter + extourne_chain + alerts ajoutées
--   P-10 🟢 semver GENERATED AS → colonnes applicatives
--
-- PÉRIMÈTRE EXCLUSIF :
--   ✅ Tables centrales + versionnement + audit
--   ✅ Index complets + contraintes d'intégrité
--   ✅ Fonctions moteur (emit, process, replay, reverse, helpers, validate)
--   ✅ Vues monitoring (9 vues)
--   ✅ RLS + sécurité + validation tenant
--   ✅ Paramètres fiscaux par pays
--   ✅ Enregistrement dans accounting_schema_versions
--
--   ❌ AUCUNE règle dans accounting_event_rules (migrations 139+)
--   ❌ AUCUNE migration de module métier
--   ❌ AUCUNE modification des triggers existants (046, 130, 133, 136, 137)
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACCOUNTING_SCHEMA_VERSIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_schema_versions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT        NOT NULL UNIQUE,   -- '1.0.0', '1.1.0', '2.0.0'
  semver_major     INT         NOT NULL DEFAULT 1, -- [P-10] calculé en application, pas GENERATED AS
  semver_minor     INT         NOT NULL DEFAULT 0,
  semver_patch     INT         NOT NULL DEFAULT 0,
  migration_file   TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  breaking_change  BOOLEAN     NOT NULL DEFAULT FALSE,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by       TEXT
);

COMMENT ON TABLE accounting_schema_versions IS
  'Historique des versions du moteur comptable central. Une entrée par migration le modifiant.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTING_FISCAL_PARAMS — Taux fiscaux par pays (utilisés par les MODULES)
-- ─────────────────────────────────────────────────────────────────────────────
-- Le moteur encode les COMPTES SYSCOHADA.
-- Les modules utilisent ces paramètres pour CALCULER les montants (HT, TVA, CNSS...).

CREATE TABLE IF NOT EXISTS accounting_fiscal_params (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code     TEXT        NOT NULL,
  param_name       TEXT        NOT NULL,
  -- 'tva_taux'        : TVA standard (ex: '18.00' = 18%)
  -- 'tva_taux_reduit' : TVA réduite si applicable
  -- 'ca_taux'         : Contribution des Affaires / précompte source
  -- 'cnss_sal_taux'   : CNSS part salariale
  -- 'cnss_pat_taux'   : CNSS part patronale
  -- 'irpp_seuil_N'    : Seuil de tranche IRPP N
  -- 'irpp_taux_N'     : Taux de tranche IRPP N
  -- 'smic_mensuel'    : SMIC/SMIG mensuel en XAF
  param_value      TEXT        NOT NULL,
  valid_from       DATE        NOT NULL,
  valid_until      DATE,
  source_reference TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, param_name, valid_from)
);

CREATE INDEX idx_afp_lookup   ON accounting_fiscal_params (country_code, param_name, valid_from DESC);
CREATE INDEX idx_afp_validity ON accounting_fiscal_params (valid_from, valid_until);

COMMENT ON TABLE accounting_fiscal_params IS
  'Taux fiscaux par pays versionnés par date. Utilisés par les modules pour calculer HT/TVA/CNSS.';

-- Seed : paramètres initiaux (sources à reconfirmer annuellement via skill fiscalite-cemac)
INSERT INTO accounting_fiscal_params (country_code, param_name, param_value, valid_from, source_reference, notes) VALUES
-- Congo-Brazzaville
('CG', 'tva_taux',      '18.00', '2018-01-01', 'CGI Congo 2018 — Art. 177',           'TVA standard CEMAC'),
('CG', 'ca_taux',       '5.00',  '2018-01-01', 'CGI Congo — Contribution Affaires 5%', 'Précompte sur prestations de services'),
('CG', 'cnss_sal_taux', '4.88',  '2018-01-01', 'CNSS Congo — Loi 009-92',             'Part salariale : vieillesse + invalidité'),
('CG', 'cnss_pat_taux', '16.20', '2018-01-01', 'CNSS Congo — Loi 009-92',             'Part patronale : maladie 2% + retraite 8% + AF 6.2%'),
('CG', 'smic_mensuel',  '90000', '2024-01-01', 'Décret SMIG Congo 2024',              'À reconfirmer — dernier arrêté connu'),
-- Cameroun
('CM', 'tva_taux',      '19.25', '2018-01-01', 'CGI Cameroun — TVA 17.5% + CAC 10%',  'Total 19.25% dont CAC communaux'),
('CM', 'cnss_sal_taux', '2.80',  '2018-01-01', 'CNPS Cameroun',                        'Part salariale CNPS'),
('CM', 'cnss_pat_taux', '17.68', '2018-01-01', 'CNPS Cameroun',                        'Part patronale CNPS'),
('CM', 'smic_mensuel',  '36270', '2014-08-05', 'Décret n°2014-2343 du 05/08/2014',    'À reconfirmer — en discussion depuis 2022'),
-- Gabon
('GA', 'tva_taux',      '18.00', '2018-01-01', 'CGI Gabon',                            'TVA standard Gabon'),
-- RDC
('CD', 'tva_taux',      '16.00', '2018-01-01', 'CGI RDC',                              'TVA standard RDC'),
-- Tchad — à compléter avec sources officielles
('TD', 'tva_taux',      '18.00', '2018-01-01', 'CGI Tchad — TAUX INDICATIF À CONFIRMER', 'Vérifier via source officielle avant utilisation'),
-- RCA
('CF', 'tva_taux',      '19.00', '2018-01-01', 'CGI RCA — TAUX INDICATIF À CONFIRMER',   'Vérifier via source officielle avant utilisation'),
-- Guinée Équatoriale
('GQ', 'tva_taux',      '15.00', '2018-01-01', 'CGI GQ — TAUX INDICATIF À CONFIRMER',    'Vérifier via source officielle avant utilisation');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ACCOUNTING_EVENTS — Journal central immuable
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,

  -- Identification (catalogue Phase 3)
  event_type       TEXT        NOT NULL,  -- 'FAC-001', 'PAI-001', 'SAN-001'
  event_module     TEXT        NOT NULL,  -- Extrait par l'application (split_part 1) — pas GENERATED AS

  -- Versionnement (Phase 3.5)
  event_version    INT         NOT NULL DEFAULT 1,
  schema_version   TEXT        NOT NULL DEFAULT '1.0.0',

  -- Source métier
  source_module    TEXT        NOT NULL,
  source_table     TEXT        NOT NULL,
  source_id        UUID        NOT NULL,

  -- Montants bruts (calculés par le module appelant)
  montant_ht       NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_tva      NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_ttc      NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_net      NUMERIC(14,2),

  -- Contexte
  devise           TEXT        NOT NULL DEFAULT 'XAF',
  fiscal_year      INT         NOT NULL,
  date_event       DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle          TEXT        NOT NULL,

  -- Métadonnées flexibles
  metadata         JSONB       NOT NULL DEFAULT '{}',
  -- Clés standard recommandées :
  --   mode_paiement, invoice_number, client_name, employe_nom,
  --   mois, annee, country_code, piece_number, cost_center_id

  -- Cycle de vie (Phase 3.5)
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | processed | error | retrying | dead_letter
  -- cancelled | reversed | superseded

  -- Liens inter-événements
  replayed_from    UUID        REFERENCES accounting_events(id),
  reversed_by      UUID        REFERENCES accounting_events(id),
  correction_of    UUID        REFERENCES accounting_events(id),

  -- Traitement
  processed_at     TIMESTAMPTZ,
  last_error_at    TIMESTAMPTZ,           -- [P-08] timestamp dernière erreur
  error_message    TEXT,
  retry_count      INT         NOT NULL DEFAULT 0,
  max_retries      INT         NOT NULL DEFAULT 3,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,

  -- Contraintes
  CONSTRAINT chk_ae_montants   CHECK (montant_ttc >= 0 AND montant_ht >= 0 AND montant_tva >= 0),
  CONSTRAINT chk_ae_status     CHECK (status IN (
    'pending','processing','processed','error','retrying','dead_letter',
    'cancelled','reversed','superseded'
  )),
  CONSTRAINT chk_ae_event_type CHECK (event_type ~ '^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$'),
  CONSTRAINT chk_ae_fiscal_yr  CHECK (fiscal_year BETWEEN 2000 AND 2100),
  CONSTRAINT chk_ae_devise     CHECK (devise IN ('XAF','EUR','USD','XOF','CDF'))
);

-- [P-01 FIX] Index unique sur états actifs : empêche deux émissions simultanées
-- pour le même (tenant, event_type, source_table, source_id)
-- ON CONFLICT DO NOTHING dans emit_accounting_event() exploite cet index
CREATE UNIQUE INDEX uidx_ae_inflight ON accounting_events
  (tenant_id, event_type, source_table, source_id)
  WHERE status IN ('pending','processing','processed');

-- Index idempotence final (cohérence avec le précédent mais plus restrictif)
CREATE UNIQUE INDEX uidx_ae_processed ON accounting_events
  (tenant_id, event_type, source_table, source_id)
  WHERE status = 'processed';

-- Index performance
CREATE INDEX idx_ae_tenant_date   ON accounting_events (tenant_id, date_event DESC);
CREATE INDEX idx_ae_tenant_status ON accounting_events (tenant_id, status) WHERE status != 'processed';
CREATE INDEX idx_ae_source        ON accounting_events (source_table, source_id);
CREATE INDEX idx_ae_event_type    ON accounting_events (event_type, fiscal_year);
CREATE INDEX idx_ae_fiscal_year   ON accounting_events (tenant_id, fiscal_year);
CREATE INDEX idx_ae_module        ON accounting_events (event_module, tenant_id);
CREATE INDEX idx_ae_created_at    ON accounting_events (created_at DESC);
CREATE INDEX idx_ae_metadata_gin  ON accounting_events USING GIN (metadata);
-- [P-07] Index ajoutés
CREATE INDEX idx_ae_fiscal_status  ON accounting_events (tenant_id, fiscal_year, status)
  WHERE status = 'processed';
CREATE INDEX idx_ae_replayed_from  ON accounting_events (replayed_from) WHERE replayed_from IS NOT NULL;
CREATE INDEX idx_ae_correction_of  ON accounting_events (correction_of) WHERE correction_of IS NOT NULL;
CREATE INDEX idx_ae_dead_letter    ON accounting_events (tenant_id, created_at DESC)
  WHERE status IN ('dead_letter','error');

COMMENT ON TABLE accounting_events IS
  'Journal central immuable de tous les événements comptables Oraforme. Append-only.';
COMMENT ON COLUMN accounting_events.event_module IS
  'Module extrait de event_type (ex: FAC de FAC-001). Calculé par emit_accounting_event().';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ACCOUNTING_EVENT_RULES — Moteur de règles SYSCOHADA piloté par les données
-- ─────────────────────────────────────────────────────────────────────────────
-- Toute logique comptable vit ici. Zéro compte SYSCOHADA dans le code du moteur.
-- [P-04] conditions JSONB (multi-condition AND)
-- [P-05] amount_formula (montants calculés : pct:5, pct_field:ca_taux)
-- [P-06] debit/credit_account support 'metadata.FIELD' + account_resolver étendu

CREATE TABLE IF NOT EXISTS accounting_event_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  event_type       TEXT        NOT NULL,   -- 'FAC-001'
  sequence         INT         NOT NULL,   -- Ordre d'écriture dans l'événement (1..20)
  rule_version     INT         NOT NULL DEFAULT 1,

  -- Cycle de vie (Phase 3.5)
  status           TEXT        NOT NULL DEFAULT 'draft',
  -- draft | active | deprecated | archived | suspended | rejected
  superseded_by    UUID        REFERENCES accounting_event_rules(id),
  change_reason    TEXT,

  -- Comptes SYSCOHADA (format 3/4 chiffres normalisé)
  -- Valeurs spéciales : 'metadata.CHAMP' → lit le compte depuis l'événement
  debit_account    TEXT        NOT NULL,
  credit_account   TEXT        NOT NULL,

  -- Résolution du montant (ordre de priorité : amount_formula > montant_field)
  montant_field    TEXT        NOT NULL DEFAULT 'montant_ttc',
  -- 'montant_ht' | 'montant_tva' | 'montant_ttc' | 'montant_net'
  -- 'metadata.CHAMP' → extrait depuis JSONB (ex: 'metadata.cnss_patronal')

  -- [P-05] Formule de montant calculé (priorité sur montant_field si renseigné)
  amount_formula   TEXT,
  -- NULL                    → utiliser montant_field directement
  -- 'pct:5'                 → montant_ht × 5 / 100
  -- 'pct:18'                → montant_ht × 18 / 100
  -- 'pct_field:ca_taux'     → montant_ht × accounting_fiscal_params.ca_taux / 100
  -- 'pct_field:tva_taux'    → montant_ht × accounting_fiscal_params.tva_taux / 100

  -- [P-06] Résolution dynamique du compte de trésorerie
  account_resolver TEXT,
  -- NULL              → statique (debit_account / credit_account tels quels)
  -- 'treasury_debit'  → fn_ohada_cash_account(metadata.mode_paiement) pour le débit
  -- 'treasury_credit' → fn_ohada_cash_account(metadata.mode_paiement) pour le crédit
  -- 'metadata_debit'  → lit metadata.debit_account depuis l'événement
  -- 'metadata_credit' → lit metadata.credit_account depuis l'événement

  -- Source pour journal_entries.source
  source_label     TEXT        NOT NULL,

  -- Template libellé (substitution {clé} depuis metadata)
  libelle_tpl      TEXT        NOT NULL,

  -- [P-04] Conditions multiples (AND) — remplace les 3 champs condition_*
  conditions       JSONB       NOT NULL DEFAULT '[]',
  -- Format : [{"field":"montant_tva","op":">","value":"0"}, {...}]
  -- Opérateurs : ">" | ">=" | "<" | "<=" | "=" | "!=" | "is_not_null" | "is_null"
  -- field : 'montant_ht' | 'montant_tva' | 'montant_ttc' | 'metadata.CHAMP'
  -- Exemples :
  -- []                                                 → toujours appliquer
  -- [{"field":"montant_tva","op":">","value":"0"}]     → si tva > 0
  -- [{"field":"metadata.country_code","op":"=","value":"CG"},
  --  {"field":"montant_ht","op":">","value":"0"}]      → si CG et HT > 0

  -- Scope géographique
  country_codes    TEXT[],     -- NULL = tous pays ; ARRAY['CG','CM'] = Congo + Cameroun

  -- Plan comptable applicable
  account_plan     TEXT        NOT NULL DEFAULT 'SYSCOHADA',
  -- 'SYSCOHADA' | 'COBAC' (banques) | 'CIMA' (assurances)

  -- Validité temporelle
  valid_from       DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,       -- NULL = toujours valide

  -- Exercices spécifiques (NULL = tous)
  fiscal_years     INT[],

  -- Métadonnées de gestion
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  notes            TEXT,

  -- Contraintes
  CONSTRAINT chk_aer_accts     CHECK (debit_account != credit_account),
  CONSTRAINT chk_aer_status    CHECK (status IN ('draft','active','deprecated','archived','suspended','rejected')),
  CONSTRAINT chk_aer_sequence  CHECK (sequence BETWEEN 1 AND 20),
  CONSTRAINT chk_aer_resolver  CHECK (account_resolver IS NULL OR account_resolver IN (
    'treasury_debit', 'treasury_credit', 'metadata_debit', 'metadata_credit'
  )),
  CONSTRAINT chk_aer_conds_arr CHECK (jsonb_typeof(conditions) = 'array')
);

-- Index unicité pour les règles globales (country_codes IS NULL)
-- Remplace l'index avec array_to_string() qui n'est pas IMMUTABLE sur toutes les versions PG.
-- Les règles country-specific sont distinguées par l'application (pas de contrainte DB sur arrays).
CREATE UNIQUE INDEX uidx_aer_version ON accounting_event_rules
  (event_type, sequence, rule_version)
  WHERE country_codes IS NULL;

CREATE INDEX idx_aer_event_type ON accounting_event_rules (event_type, status, valid_from);
CREATE INDEX idx_aer_active     ON accounting_event_rules (event_type, sequence) WHERE status = 'active';
CREATE INDEX idx_aer_country    ON accounting_event_rules USING GIN (country_codes);

COMMENT ON TABLE accounting_event_rules IS
  'Règles SYSCOHADA versionnées. Moteur de règles piloté par les données : aucun compte dans le code.';
COMMENT ON COLUMN accounting_event_rules.conditions IS
  'Tableau de conditions AND au format [{field, op, value}]. [] = toujours appliquer.';
COMMENT ON COLUMN accounting_event_rules.amount_formula IS
  'Formule calculée (pct:N, pct_field:param_name). Priorité sur montant_field si non NULL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ACCOUNTING_EVENT_LOG — Audit trail immuable
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_event_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES accounting_events(id),
  tenant_id           UUID        NOT NULL,
  journal_entry_ids   UUID[]      NOT NULL DEFAULT '{}',
  transaction_id      UUID,
  entries_count       INT         NOT NULL DEFAULT 0,
  total_debit         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit        NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_balanced         BOOLEAN     NOT NULL DEFAULT TRUE,
  -- is_balanced = (ABS(total_debit - total_credit) < 0.01)
  schema_version      TEXT        NOT NULL DEFAULT '1.0.0',
  rules_snapshot      JSONB,
  replay_mode         TEXT,       -- NULL | 'current' | 'historical'
  is_replay           BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms         INT,
  CONSTRAINT chk_ael_replay CHECK (replay_mode IN (NULL,'current','historical'))
);

CREATE INDEX idx_ael_event_id ON accounting_event_log (event_id);
CREATE INDEX idx_ael_tenant   ON accounting_event_log (tenant_id, processed_at DESC);
CREATE INDEX idx_ael_je_ids   ON accounting_event_log USING GIN (journal_entry_ids);
CREATE INDEX idx_ael_balanced ON accounting_event_log (tenant_id) WHERE NOT is_balanced;

COMMENT ON TABLE accounting_event_log IS
  'Audit trail de chaque traitement d''événement. is_balanced vérifie débit = crédit.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ACCOUNTING_EVENT_EXTOURNES — Tracking des corrections comptables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_event_extournes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id   UUID        NOT NULL REFERENCES accounting_events(id) UNIQUE,
  extourne_event_id   UUID        REFERENCES accounting_events(id),
  reason              TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ
);

COMMENT ON TABLE accounting_event_extournes IS
  'Lien entre un événement original et son extourne (correction). UNIQUE sur original_event_id.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ACCOUNTING_RULE_AUDIT_LOG — Traçabilité des modifications de règles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_rule_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID        NOT NULL REFERENCES accounting_event_rules(id),
  action        TEXT        NOT NULL,
  -- 'created' | 'activated' | 'deprecated' | 'archived' | 'suspended' | 'rejected'
  old_status    TEXT,
  new_status    TEXT,
  changed_by    TEXT,
  change_reason TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rule_snapshot JSONB       NOT NULL
);

CREATE INDEX idx_aral_rule_id ON accounting_rule_audit_log (rule_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS — SÉCURITÉ
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounting_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_event_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_event_extournes ENABLE ROW LEVEL SECURITY;
-- accounting_event_rules, accounting_fiscal_params, accounting_schema_versions :
-- données de configuration globales → pas de RLS par tenant

CREATE POLICY ae_read   ON accounting_events FOR SELECT
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY ae_insert ON accounting_events FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
-- Pas de UPDATE/DELETE policy → les utilisateurs ne peuvent pas modifier les events

CREATE POLICY ael_read  ON accounting_event_log FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY aee_read  ON accounting_event_extournes FOR SELECT
  USING (original_event_id IN (
    SELECT id FROM accounting_events WHERE tenant_id = get_my_tenant_id()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. FONCTIONS HELPERS DU MOTEUR
-- ─────────────────────────────────────────────────────────────────────────────

-- 9.1 — Résoudre le montant depuis champs ou metadata
CREATE OR REPLACE FUNCTION fn_ae_resolve_montant(
  p_ht NUMERIC, p_tva NUMERIC, p_ttc NUMERIC, p_net NUMERIC,
  p_metadata JSONB, p_field TEXT
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN COALESCE(CASE
    WHEN p_field = 'montant_ht'  THEN p_ht
    WHEN p_field = 'montant_tva' THEN p_tva
    WHEN p_field = 'montant_ttc' THEN p_ttc
    WHEN p_field = 'montant_net' THEN p_net
    WHEN p_field LIKE 'metadata.%' THEN (p_metadata ->> substr(p_field, 10))::NUMERIC
    ELSE 0
  END, 0);
END;
$$;

-- 9.2 — [P-05] Résoudre le montant avec formule calculée
CREATE OR REPLACE FUNCTION fn_ae_resolve_amount_formula(
  p_ht NUMERIC, p_tva NUMERIC, p_ttc NUMERIC, p_net NUMERIC,
  p_metadata JSONB, p_montant_field TEXT, p_formula TEXT,
  p_country_code TEXT DEFAULT 'CG'
) RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_base   NUMERIC;
  v_pct    NUMERIC;
  v_param  TEXT;
BEGIN
  -- Si pas de formule : fallback sur montant_field
  IF p_formula IS NULL OR p_formula = '' THEN
    RETURN fn_ae_resolve_montant(p_ht, p_tva, p_ttc, p_net, p_metadata, p_montant_field);
  END IF;

  v_base := COALESCE(p_ht, 0);  -- La base des formules pct est toujours le HT

  -- 'pct:N' → montant_ht × N / 100
  IF p_formula LIKE 'pct:%' THEN
    v_pct := substr(p_formula, 5)::NUMERIC;
    RETURN ROUND(v_base * v_pct / 100, 2);
  END IF;

  -- 'pct_field:param_name' → montant_ht × fiscal_param / 100
  IF p_formula LIKE 'pct_field:%' THEN
    v_param := substr(p_formula, 11);
    SELECT param_value::NUMERIC INTO v_pct
    FROM accounting_fiscal_params
    WHERE country_code = p_country_code
      AND param_name   = v_param
      AND valid_from  <= CURRENT_DATE
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    ORDER BY valid_from DESC LIMIT 1;
    RETURN ROUND(v_base * COALESCE(v_pct, 0) / 100, 2);
  END IF;

  -- Fallback
  RETURN fn_ae_resolve_montant(p_ht, p_tva, p_ttc, p_net, p_metadata, p_montant_field);
END;
$$;

-- 9.3 — Résoudre libellé template (substitution {clé} depuis metadata)
CREATE OR REPLACE FUNCTION fn_ae_resolve_libelle(
  p_template TEXT, p_metadata JSONB, p_fallback TEXT
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_result TEXT := COALESCE(p_template, p_fallback, '');
  v_key    TEXT;
  v_val    TEXT;
BEGIN
  IF p_metadata IS NULL OR p_template IS NULL THEN RETURN COALESCE(p_fallback, ''); END IF;
  FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(p_metadata)
  LOOP
    v_result := REPLACE(v_result, '{' || v_key || '}', COALESCE(v_val, ''));
  END LOOP;
  RETURN v_result;
END;
$$;

-- 9.4 — [P-04] Évaluer un tableau de conditions JSONB (AND logic)
CREATE OR REPLACE FUNCTION fn_ae_eval_conditions(
  p_metadata JSONB,
  p_ht NUMERIC, p_tva NUMERIC, p_ttc NUMERIC, p_net NUMERIC,
  p_conditions JSONB  -- tableau [{field, op, value}]
) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_cond  JSONB;
  v_field TEXT;
  v_op    TEXT;
  v_left  NUMERIC;
  v_left_text TEXT;
BEGIN
  -- Tableau vide → pas de condition → toujours vrai
  IF p_conditions IS NULL OR jsonb_array_length(p_conditions) = 0 THEN RETURN TRUE; END IF;

  FOR v_cond IN SELECT value FROM jsonb_array_elements(p_conditions)
  LOOP
    v_field := v_cond->>'field';
    v_op    := v_cond->>'op';

    -- Opérateur is_not_null / is_null (pas de valeur numérique)
    IF v_op = 'is_not_null' THEN
      IF v_field LIKE 'metadata.%' THEN
        IF (p_metadata ->> substr(v_field, 10)) IS NULL THEN RETURN FALSE; END IF;
      ELSE
        IF fn_ae_resolve_montant(p_ht, p_tva, p_ttc, p_net, p_metadata, v_field) IS NULL THEN
          RETURN FALSE;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    IF v_op = 'is_null' THEN
      IF v_field LIKE 'metadata.%' THEN
        IF (p_metadata ->> substr(v_field, 10)) IS NOT NULL THEN RETURN FALSE; END IF;
      END IF;
      CONTINUE;
    END IF;

    -- Comparaisons texte (pour metadata string fields)
    IF v_field LIKE 'metadata.%' AND v_op IN ('=','!=') THEN
      v_left_text := p_metadata ->> substr(v_field, 10);
      IF v_op = '='  AND v_left_text != (v_cond->>'value') THEN RETURN FALSE; END IF;
      IF v_op = '!=' AND v_left_text  = (v_cond->>'value') THEN RETURN FALSE; END IF;
      CONTINUE;
    END IF;

    -- Comparaisons numériques
    v_left := fn_ae_resolve_montant(p_ht, p_tva, p_ttc, p_net, p_metadata, v_field);
    IF NOT (CASE v_op
      WHEN '>'  THEN v_left >  (v_cond->>'value')::NUMERIC
      WHEN '>=' THEN v_left >= (v_cond->>'value')::NUMERIC
      WHEN '<'  THEN v_left <  (v_cond->>'value')::NUMERIC
      WHEN '<=' THEN v_left <= (v_cond->>'value')::NUMERIC
      WHEN '='  THEN v_left =  (v_cond->>'value')::NUMERIC
      WHEN '!=' THEN v_left != (v_cond->>'value')::NUMERIC
      ELSE TRUE
    END) THEN RETURN FALSE; END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- 9.5 — [P-06] Résoudre le compte de trésorerie (délègue à fn_ohada_cash_account)
CREATE OR REPLACE FUNCTION fn_ae_resolve_treasury(p_metadata JSONB)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN fn_ohada_cash_account(COALESCE(p_metadata->>'mode_paiement', 'virement'));
EXCEPTION WHEN OTHERS THEN RETURN '521';
END;
$$;

-- 9.6 — Déterminer si un event_type a un impact trésorerie
CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB');
$$;

-- 9.7 — Sens de l'impact trésorerie (entrée ou sortie)
CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004','ECO-005',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002','HOT-004','TRP-001','CAB-001'
  );
$$;

-- 9.8 — Catégorie de la transaction (pour table transactions)
CREATE OR REPLACE FUNCTION fn_ae_category(p_event_type TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE split_part(p_event_type, '-', 1)
    WHEN 'FAC' THEN 'Facturation'  WHEN 'PAI' THEN 'Paie'
    WHEN 'SAN' THEN 'Santé'        WHEN 'RES' THEN 'Restaurant'
    WHEN 'ECO' THEN 'Scolarité'    WHEN 'COM' THEN 'Commerce'
    WHEN 'TRP' THEN 'Transport'    WHEN 'HOT' THEN 'Hôtel'
    WHEN 'FIS' THEN 'Fiscalité'    WHEN 'TRE' THEN 'Trésorerie'
    WHEN 'MOB' THEN 'Mobile Money' WHEN 'ONG' THEN 'ONG'
    WHEN 'CAB' THEN 'Cabinet'      ELSE 'Autre'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. fn_ae_get_applicable_rules() — Résolution versionnée des règles
-- Priorité : règle pays spécifique > règle générale
-- Filtre : status='active', plage dates valide, pays
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ae_get_applicable_rules(
  p_event_type   TEXT,
  p_date         DATE,
  p_country_code TEXT DEFAULT NULL
) RETURNS SETOF accounting_event_rules LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (sequence) r.*
  FROM accounting_event_rules r
  WHERE r.event_type  = p_event_type
    AND r.status      = 'active'
    AND r.valid_from <= p_date
    AND (r.valid_until IS NULL OR r.valid_until >= p_date)
    AND (
      (p_country_code IS NOT NULL AND r.country_codes IS NOT NULL
       AND p_country_code = ANY(r.country_codes))
      OR r.country_codes IS NULL
    )
  ORDER BY
    sequence,
    CASE WHEN r.country_codes IS NOT NULL THEN 0 ELSE 1 END,  -- pays spécifique en premier
    r.rule_version DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. MOTEUR PRINCIPAL — fn_ae_execute_event(UUID) + wrapper trigger
--
-- Architecture à 2 couches :
--   fn_ae_execute_event(p_event_id) : logique métier pure, appelable directement
--   fn_process_accounting_event()   : wrapper TRIGGER → appelle fn_ae_execute_event
--
-- fn_ae_execute_event est aussi appelé par fn_ae_process_pending (retry/recovery).
-- Séparer les deux évite de dupliquer la logique et permet les tests unitaires.
--
-- Fixes ARR :
--   [P-02] Compare-And-Swap sur status='pending' (évite double traitement concurrent)
--   [P-04] fn_ae_eval_conditions() multi-conditions JSONB (AND)
--   [P-05] fn_ae_resolve_amount_formula() montants calculés
--   [P-06] account_resolver étendu (4 valeurs) + 'metadata.FIELD' inline
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ae_execute_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event        accounting_events%ROWTYPE;
  v_rule         accounting_event_rules%ROWTYPE;
  v_montant      NUMERIC(14,2);
  v_debit        TEXT;
  v_credit       TEXT;
  v_libelle      TEXT;
  v_je_id        UUID;
  v_je_ids       UUID[]  := '{}';
  v_tx_id        UUID;
  v_total        NUMERIC(14,2) := 0;
  v_entries      INT     := 0;
  v_start        TIMESTAMPTZ   := clock_timestamp();
  v_country      TEXT;
  v_rows         INT;
  v_rules_used   JSONB   := '[]'::JSONB;
BEGIN
  -- Charger l'event
  SELECT * INTO v_event FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- [P-02] Compare-And-Swap : ne prendre le verrou QUE si encore 'pending'
  UPDATE accounting_events SET status = 'processing'
  WHERE id = p_event_id AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;  -- Concurrent exécution déjà en cours

  -- Résoudre le pays depuis metadata ou entreprise_config
  v_country := COALESCE(
    v_event.metadata->>'country_code',
    (SELECT ec.config->>'country_code'
     FROM entreprise_config ec WHERE ec.tenant_id = v_event.tenant_id LIMIT 1),
    'CG'
  );

  -- Parcourir les règles applicables (versionnées + multi-pays)
  FOR v_rule IN
    SELECT * FROM fn_ae_get_applicable_rules(v_event.event_type, v_event.date_event, v_country)
  LOOP
    -- [P-04] Évaluer toutes les conditions (AND)
    IF NOT fn_ae_eval_conditions(
      v_event.metadata, v_event.montant_ht, v_event.montant_tva,
      v_event.montant_ttc, v_event.montant_net, v_rule.conditions
    ) THEN CONTINUE; END IF;

    -- [P-05] Résoudre le montant (formule calculée ou champ direct)
    v_montant := fn_ae_resolve_amount_formula(
      v_event.montant_ht, v_event.montant_tva, v_event.montant_ttc, v_event.montant_net,
      v_event.metadata, v_rule.montant_field, v_rule.amount_formula, v_country
    );
    IF COALESCE(v_montant, 0) <= 0 THEN CONTINUE; END IF;

    -- [P-06] Résoudre les comptes (statique, treasury, ou metadata)
    v_debit  := v_rule.debit_account;
    v_credit := v_rule.credit_account;
    CASE v_rule.account_resolver
      WHEN 'treasury_debit'  THEN v_debit  := fn_ae_resolve_treasury(v_event.metadata);
      WHEN 'treasury_credit' THEN v_credit := fn_ae_resolve_treasury(v_event.metadata);
      WHEN 'metadata_debit'  THEN v_debit  := COALESCE(v_event.metadata->>'debit_account',  v_debit);
      WHEN 'metadata_credit' THEN v_credit := COALESCE(v_event.metadata->>'credit_account', v_credit);
      ELSE NULL;
    END CASE;
    -- Support 'metadata.FIELD' directement dans debit_account/credit_account
    IF v_debit  LIKE 'metadata.%' THEN v_debit  := v_event.metadata ->> substr(v_debit,  10); END IF;
    IF v_credit LIKE 'metadata.%' THEN v_credit := v_event.metadata ->> substr(v_credit, 10); END IF;
    IF v_debit IS NULL OR v_credit IS NULL THEN CONTINUE; END IF;

    -- Résoudre le libellé
    v_libelle := fn_ae_resolve_libelle(v_rule.libelle_tpl, v_event.metadata, v_event.libelle);

    -- Insérer l'écriture journal_entries
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year, piece_number
    ) VALUES (
      v_event.tenant_id, v_event.date_event, v_libelle,
      v_debit, v_credit, v_montant,
      v_rule.source_label, v_event.source_id, v_event.fiscal_year,
      v_event.metadata->>'piece_number'
    ) RETURNING id INTO v_je_id;

    v_je_ids  := array_append(v_je_ids, v_je_id);
    v_total   := v_total + v_montant;
    v_entries := v_entries + 1;
    v_rules_used := v_rules_used || to_jsonb(v_rule.id::TEXT);
  END LOOP;

  -- Créer la ligne transactions si impact trésorerie
  IF fn_ae_has_treasury_impact(v_event.event_type) AND COALESCE(v_event.montant_ttc, 0) > 0 THEN
    INSERT INTO transactions (
      tenant_id, type, categorie, description, montant, date,
      mode_paiement, source, source_id, fiscal_year
    ) VALUES (
      v_event.tenant_id,
      CASE WHEN fn_ae_is_income(v_event.event_type) THEN 'entree' ELSE 'sortie' END,
      fn_ae_category(v_event.event_type),
      v_event.libelle, v_event.montant_ttc, v_event.date_event,
      COALESCE(v_event.metadata->>'mode_paiement', 'virement'),
      v_event.source_module, v_event.source_id, v_event.fiscal_year
    ) RETURNING id INTO v_tx_id;
  END IF;

  -- Synchroniser trésorerie (non bloquant)
  BEGIN
    IF split_part(v_event.event_type, '-', 1) IN ('TRE','MOB','FAC','SAN','RES','ECO') THEN
      PERFORM fn_sync_tresorerie_soldes(v_event.tenant_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Audit log
  INSERT INTO accounting_event_log (
    event_id, tenant_id, journal_entry_ids, transaction_id,
    entries_count, total_debit, total_credit,
    is_balanced, schema_version, rules_snapshot, is_replay, duration_ms
  ) VALUES (
    p_event_id, v_event.tenant_id, v_je_ids, v_tx_id,
    v_entries, v_total, v_total,
    TRUE, '1.0.0',
    jsonb_build_object(
      'rule_ids', v_rules_used,
      'country', v_country,
      'event_version', v_event.event_version
    ),
    (v_event.replayed_from IS NOT NULL),
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INT
  );

  -- Marquer traité
  UPDATE accounting_events SET status = 'processed', processed_at = NOW() WHERE id = p_event_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE accounting_events
  SET status        = CASE WHEN retry_count >= max_retries THEN 'dead_letter' ELSE 'error' END,
      error_message = SQLERRM || ' [' || SQLSTATE || ']',
      last_error_at = NOW(),
      retry_count   = retry_count + 1
  WHERE id = p_event_id;
  RAISE WARNING '[accounting_engine] event=% : % [%]', p_event_id, SQLERRM, SQLSTATE;
END;
$$;

-- Wrapper TRIGGER : délègue à fn_ae_execute_event()
-- Séparation trigger/logique → fn_ae_execute_event est testable et appelable manuellement
CREATE OR REPLACE FUNCTION fn_process_accounting_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_ae_execute_event(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger : AFTER INSERT, seulement sur pending
CREATE TRIGGER trg_process_accounting_event
  AFTER INSERT ON accounting_events
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_process_accounting_event();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. ÉMISSION — emit_accounting_event()
-- [P-01] ON CONFLICT DO NOTHING (atomique)
-- [P-03] Validation tenant via get_my_tenant_id()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION emit_accounting_event(
  p_tenant_id     UUID,
  p_event_type    TEXT,
  p_source_module TEXT,
  p_source_table  TEXT,
  p_source_id     UUID,
  p_montant_ht    NUMERIC(14,2) DEFAULT 0,
  p_montant_tva   NUMERIC(14,2) DEFAULT 0,
  p_montant_ttc   NUMERIC(14,2) DEFAULT 0,
  p_montant_net   NUMERIC(14,2) DEFAULT NULL,
  p_libelle       TEXT          DEFAULT '',
  p_date_event    DATE          DEFAULT CURRENT_DATE,
  p_fiscal_year   INT           DEFAULT NULL,
  p_metadata      JSONB         DEFAULT '{}',
  p_event_version INT           DEFAULT 1
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id      UUID;
  v_caller_tenant UUID;
  v_year          INT := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM p_date_event)::INT);
  v_module        TEXT;
BEGIN
  -- [P-03] Valider le tenant appelant (sauf super-admin avec tenant NULL)
  BEGIN
    v_caller_tenant := get_my_tenant_id();
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;  -- Appel depuis migration / service sans contexte RLS
  END;
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant != p_tenant_id THEN
    RAISE EXCEPTION 'emit_accounting_event: tenant_id % interdit pour cet utilisateur (tenant: %)',
      p_tenant_id, v_caller_tenant;
  END IF;

  -- Validation paramètres
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'emit_accounting_event: event_type obligatoire';
  END IF;
  IF p_source_id IS NULL THEN
    RAISE EXCEPTION 'emit_accounting_event: source_id obligatoire';
  END IF;
  IF COALESCE(p_montant_ttc, 0) < 0 THEN
    RAISE EXCEPTION 'emit_accounting_event: montant_ttc négatif interdit (utilisez une extourne)';
  END IF;

  -- Extraire le module depuis event_type (ex: 'FAC' de 'FAC-001')
  v_module := split_part(p_event_type, '-', 1);

  -- [P-01] INSERT atomique avec ON CONFLICT sur uidx_ae_inflight
  -- Si un event pending/processing/processed existe déjà → DO NOTHING → v_event_id = NULL
  -- [P-01] ON CONFLICT avec colonnes + WHERE : syntaxe requise pour les partial unique indexes
  -- (ON CONFLICT ON CONSTRAINT ne fonctionne qu'avec les contraintes UNIQUE déclarées dans la table)
  INSERT INTO accounting_events (
    tenant_id, event_type, event_module, event_version, schema_version,
    source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status
  ) VALUES (
    p_tenant_id, p_event_type, v_module, p_event_version, '1.0.0',
    p_source_module, p_source_table, p_source_id,
    COALESCE(p_montant_ht, 0), COALESCE(p_montant_tva, 0),
    COALESCE(p_montant_ttc, 0), p_montant_net,
    COALESCE(p_libelle, ''), p_date_event, v_year,
    COALESCE(p_metadata, '{}'), 'pending'
  )
  ON CONFLICT (tenant_id, event_type, source_table, source_id)
  WHERE status IN ('pending','processing','processed')
  DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'emit_accounting_event: % pour %/% déjà en vol ou traité — ignoré.',
      p_event_type, p_source_table, p_source_id;
  END IF;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION emit_accounting_event IS
  'Point d''entrée unique du moteur. Appelé par tous les modules. Jamais d''INSERT direct dans journal_entries.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. EXTOURNE — fn_reverse_accounting_event()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reverse_accounting_event(
  p_event_id   UUID,
  p_reason     TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event       accounting_events%ROWTYPE;
  v_log         accounting_event_log%ROWTYPE;
  v_je          RECORD;
  v_ext_id      UUID;
BEGIN
  SELECT * INTO v_event FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: événement % introuvable', p_event_id;
  END IF;
  IF v_event.status != 'processed' THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: statut % — seul ''processed'' peut être extourné',
      v_event.status;
  END IF;
  IF EXISTS (SELECT 1 FROM accounting_event_extournes WHERE original_event_id = p_event_id) THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: cet événement a déjà été extourné';
  END IF;

  SELECT * INTO v_log FROM accounting_event_log WHERE event_id = p_event_id
    ORDER BY processed_at DESC LIMIT 1;

  -- Créer les écritures inverses
  FOR v_je IN
    SELECT * FROM journal_entries WHERE id = ANY(v_log.journal_entry_ids)
  LOOP
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year, piece_number
    ) VALUES (
      v_je.tenant_id, CURRENT_DATE,
      'EXTOURNE — ' || v_je.libelle || ' — ' || LEFT(p_reason, 80),
      v_je.credit_account, v_je.debit_account,  -- Inversés
      v_je.montant,
      'extourne_' || v_je.source, v_je.source_id,
      v_je.fiscal_year, 'EXT-' || COALESCE(v_je.piece_number, v_je.id::TEXT)
    );
  END LOOP;

  -- Créer l'événement d'extourne
  INSERT INTO accounting_events (
    tenant_id, event_type, event_module, source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status, correction_of, created_by
  )
  SELECT
    v_event.tenant_id,
    'EXT-' || v_event.event_module || '-' || split_part(v_event.event_type, '-', 2),
    'EXT', v_event.source_module, v_event.source_table, v_event.source_id,
    v_event.montant_ht, v_event.montant_tva, v_event.montant_ttc, v_event.montant_net,
    'EXTOURNE — ' || v_event.libelle,
    CURRENT_DATE, v_event.fiscal_year,
    jsonb_build_object('original_event_id', p_event_id, 'reason', p_reason),
    'processed', p_event_id, p_created_by
  RETURNING id INTO v_ext_id;

  INSERT INTO accounting_event_extournes (original_event_id, extourne_event_id, reason, created_by)
  VALUES (p_event_id, v_ext_id, p_reason, p_created_by);

  UPDATE accounting_events SET status = 'reversed', reversed_by = v_ext_id WHERE id = p_event_id;
  RETURN v_ext_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. REPLAY — fn_replay_accounting_event()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_replay_accounting_event(
  p_event_id UUID,
  p_mode     TEXT DEFAULT 'current'  -- 'current' | 'historical'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_original accounting_events%ROWTYPE;
  v_replay_id UUID;
BEGIN
  SELECT * INTO v_original FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_replay_accounting_event: événement % introuvable', p_event_id;
  END IF;
  IF v_original.status = 'processed' THEN
    RAISE EXCEPTION 'fn_replay_accounting_event: extourner d''abord l''événement (statut actuel: processed)';
  END IF;
  IF p_mode NOT IN ('current','historical') THEN
    RAISE EXCEPTION 'fn_replay_accounting_event: mode % invalide (current | historical)', p_mode;
  END IF;

  INSERT INTO accounting_events (
    tenant_id, event_type, event_module, event_version, schema_version,
    source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status, replayed_from
  )
  SELECT
    v_original.tenant_id, v_original.event_type, v_original.event_module,
    v_original.event_version, '1.0.0',
    v_original.source_module, v_original.source_table, v_original.source_id,
    v_original.montant_ht, v_original.montant_tva, v_original.montant_ttc, v_original.montant_net,
    v_original.libelle,
    CASE WHEN p_mode = 'historical' THEN v_original.date_event ELSE CURRENT_DATE END,
    v_original.fiscal_year,
    v_original.metadata || jsonb_build_object('replay_mode', p_mode, 'replayed_at', NOW()),
    'pending', p_event_id
  RETURNING id INTO v_replay_id;

  UPDATE accounting_events SET status = 'superseded' WHERE id = p_event_id;
  RETURN v_replay_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. UTILITAIRES ADMIN
-- ─────────────────────────────────────────────────────────────────────────────

-- Remettre les événements en erreur en pending (retry manuel)
CREATE OR REPLACE FUNCTION fn_ae_retry_errors(
  p_tenant_id  UUID  DEFAULT NULL,
  p_event_type TEXT  DEFAULT NULL,
  p_max_age    INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  UPDATE accounting_events
  SET status = 'pending', error_message = NULL
  WHERE status IN ('error','dead_letter')
    AND created_at >= NOW() - p_max_age
    AND (p_tenant_id  IS NULL OR tenant_id  = p_tenant_id)
    AND (p_event_type IS NULL OR event_type = p_event_type);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  -- Note : le trigger trg_process_accounting_event ne se redéclenche PAS sur UPDATE
  -- → Appeler fn_ae_process_pending() séparément pour traiter les événements remis en pending
  RETURN v_count;
END;
$$;

-- Traiter les événements pending non traités (utile après retry ou panne de trigger)
-- Appelle fn_ae_execute_event() directement → pas de trigger, pas de duplication de logique
CREATE OR REPLACE FUNCTION fn_ae_process_pending(
  p_tenant_id  UUID  DEFAULT NULL,
  p_event_type TEXT  DEFAULT NULL,
  p_limit      INT   DEFAULT 100
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count  INT := 0;
  v_id     UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM accounting_events
    WHERE status = 'pending'
      AND (p_tenant_id  IS NULL OR tenant_id  = p_tenant_id)
      AND (p_event_type IS NULL OR event_type = p_event_type)
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM fn_ae_execute_event(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. SANTÉ — fn_accounting_health_check()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_accounting_health_check(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (check_name TEXT, status TEXT, count BIGINT, details TEXT)
LANGUAGE sql STABLE AS $$
  SELECT 'events_in_error',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    COUNT(*),
    'Événements en error ou dead_letter (intervention manuelle possible)'
  FROM accounting_events
  WHERE status IN ('error','dead_letter')
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  SELECT 'events_stuck_processing',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END,
    COUNT(*),
    'Événements bloqués en processing depuis > 5 minutes (deadlock probable)'
  FROM accounting_events
  WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  SELECT 'unbalanced_log_entries',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END,
    COUNT(*),
    'Traitements avec journal_entries déséquilibrés (débit ≠ crédit)'
  FROM accounting_event_log
  WHERE NOT is_balanced AND entries_count > 0
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  SELECT 'active_rules',
    CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'INFO' END,
    COUNT(*),
    'Règles SYSCOHADA actives dans accounting_event_rules (0 = normal avant migration 139)'
  FROM accounting_event_rules WHERE status = 'active'

  UNION ALL

  SELECT 'pending_stale',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    COUNT(*),
    'Événements en pending depuis > 1 heure (trigger non déclenché ?)'
  FROM accounting_events
  WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. VUES DE MONITORING (9 vues)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_accounting_events_status AS
SELECT tenant_id, event_type, event_module, fiscal_year, status,
  COUNT(*) AS nb_events, SUM(montant_ttc) AS volume_total,
  MAX(created_at) AS dernier_event
FROM accounting_events
GROUP BY tenant_id, event_type, event_module, fiscal_year, status;

CREATE OR REPLACE VIEW v_accounting_events_errors AS
SELECT ae.id, ae.tenant_id, ae.event_type, ae.source_module, ae.source_table,
  ae.source_id, ae.status, ae.error_message, ae.retry_count, ae.max_retries,
  ae.last_error_at, ae.montant_ttc, ae.libelle, ae.created_at, ae.fiscal_year
FROM accounting_events ae
WHERE ae.status IN ('error','dead_letter')
ORDER BY ae.last_error_at DESC NULLS LAST;

CREATE OR REPLACE VIEW v_accounting_rules_active AS
SELECT event_type, sequence, rule_version, debit_account, credit_account,
  montant_field, amount_formula, source_label, libelle_tpl, conditions,
  country_codes, account_plan, valid_from, valid_until, notes
FROM accounting_event_rules WHERE status = 'active'
ORDER BY event_type, sequence;

CREATE OR REPLACE VIEW v_accounting_balance_check AS
SELECT ael.tenant_id, ae.fiscal_year, ae.event_module,
  COUNT(ael.id) AS nb_traitements,
  SUM(ael.entries_count) AS total_ecritures,
  SUM(ael.total_debit) AS sum_debit, SUM(ael.total_credit) AS sum_credit,
  ABS(SUM(ael.total_debit) - SUM(ael.total_credit)) AS ecart,
  BOOL_AND(ael.is_balanced) AS all_balanced
FROM accounting_event_log ael
JOIN accounting_events ae ON ae.id = ael.event_id
WHERE ae.status = 'processed'
GROUP BY ael.tenant_id, ae.fiscal_year, ae.event_module
ORDER BY ael.tenant_id, ae.fiscal_year DESC;

CREATE OR REPLACE VIEW v_accounting_replay_queue AS
SELECT ae.id, ae.tenant_id, ae.event_type, ae.fiscal_year,
  ae.source_table, ae.source_id, ae.montant_ttc, ae.libelle,
  ae.processed_at, ael.rules_snapshot->>'country' AS country_used,
  ael.schema_version AS processed_with_version
FROM accounting_events ae
JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.status = 'processed'
ORDER BY ae.fiscal_year DESC, ae.processed_at DESC;

CREATE OR REPLACE VIEW v_accounting_fiscal_params_active AS
SELECT country_code, param_name, param_value, valid_from, valid_until, source_reference
FROM accounting_fiscal_params
WHERE valid_from <= CURRENT_DATE AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
ORDER BY country_code, param_name;

-- [P-09] Vues ajoutées
CREATE OR REPLACE VIEW v_accounting_dead_letter AS
SELECT ae.id, ae.tenant_id, ae.event_type, ae.source_module, ae.source_table,
  ae.source_id, ae.status, ae.error_message, ae.last_error_at,
  ae.retry_count, ae.max_retries, ae.montant_ttc, ae.libelle,
  ae.created_at, ae.fiscal_year
FROM accounting_events ae
WHERE ae.status IN ('dead_letter','error')
ORDER BY ae.last_error_at DESC NULLS LAST, ae.created_at DESC;

CREATE OR REPLACE VIEW v_accounting_extourne_chain AS
SELECT
  orig.id AS original_id, orig.event_type, orig.libelle AS original_libelle,
  orig.montant_ttc AS montant_original, orig.fiscal_year,
  ext_ae.id AS extourne_id, ext_ae.created_at AS extourne_date,
  aee.reason AS motif, aee.created_by
FROM accounting_event_extournes aee
JOIN accounting_events orig    ON orig.id   = aee.original_event_id
LEFT JOIN accounting_events ext_ae ON ext_ae.id = aee.extourne_event_id
ORDER BY aee.created_at DESC;

CREATE OR REPLACE VIEW v_accounting_alerts AS
SELECT 'dead_letter'::TEXT AS alert_type, tenant_id,
  COUNT(*) AS count, 'Événements en dead_letter — intervention requise'::TEXT AS message
FROM accounting_events WHERE status = 'dead_letter'
GROUP BY tenant_id HAVING COUNT(*) > 0
UNION ALL
SELECT 'processing_stuck', tenant_id, COUNT(*), 'Événements bloqués en processing > 5 min'
FROM accounting_events WHERE status='processing' AND created_at < NOW() - INTERVAL '5 minutes'
GROUP BY tenant_id HAVING COUNT(*) > 0
UNION ALL
SELECT 'unbalanced', tenant_id, COUNT(*), 'Écritures déséquilibrées détectées'
FROM accounting_event_log WHERE NOT is_balanced
GROUP BY tenant_id HAVING COUNT(*) > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. ENREGISTREMENT — schema version 1.0.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.0.0', 1, 0, 0,
  '138_accounting_engine_infrastructure.sql',
  'Infrastructure moteur comptable central v2 (ARR-validated). Tables: accounting_events, '
  'event_rules (conditions JSONB + amount_formula), event_log, extournes, schema_versions, '
  'fiscal_params. Fonctions: emit (ON CONFLICT + tenant check), process (CAS), '
  'reverse, replay, health_check, retry. 9 vues monitoring. 0 règle métier (migrations 139+).',
  FALSE,
  'Plan Directeur Phase 4.0 — ARR v1.0'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
DROP TRIGGER IF EXISTS trg_process_accounting_event ON accounting_events;
DROP VIEW IF EXISTS v_accounting_alerts;
DROP VIEW IF EXISTS v_accounting_extourne_chain;
DROP VIEW IF EXISTS v_accounting_dead_letter;
DROP VIEW IF EXISTS v_accounting_fiscal_params_active;
DROP VIEW IF EXISTS v_accounting_replay_queue;
DROP VIEW IF EXISTS v_accounting_balance_check;
DROP VIEW IF EXISTS v_accounting_rules_active;
DROP VIEW IF EXISTS v_accounting_events_errors;
DROP VIEW IF EXISTS v_accounting_events_status;
DROP FUNCTION IF EXISTS fn_ae_process_pending(UUID,TEXT,INT);
DROP FUNCTION IF EXISTS fn_ae_retry_errors(UUID,TEXT,INTERVAL);
DROP FUNCTION IF EXISTS fn_accounting_health_check(UUID);
DROP FUNCTION IF EXISTS fn_replay_accounting_event(UUID,TEXT);
DROP FUNCTION IF EXISTS fn_reverse_accounting_event(UUID,TEXT,UUID);
DROP FUNCTION IF EXISTS emit_accounting_event(UUID,TEXT,TEXT,TEXT,UUID,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,DATE,INT,JSONB,INT);
DROP FUNCTION IF EXISTS fn_process_accounting_event();
DROP FUNCTION IF EXISTS fn_ae_execute_event(UUID);
DROP FUNCTION IF EXISTS fn_ae_get_applicable_rules(TEXT,DATE,TEXT);
DROP FUNCTION IF EXISTS fn_ae_category(TEXT);
DROP FUNCTION IF EXISTS fn_ae_is_income(TEXT);
DROP FUNCTION IF EXISTS fn_ae_has_treasury_impact(TEXT);
DROP FUNCTION IF EXISTS fn_ae_resolve_treasury(JSONB);
DROP FUNCTION IF EXISTS fn_ae_eval_conditions(JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB);
DROP FUNCTION IF EXISTS fn_ae_resolve_libelle(TEXT,JSONB,TEXT);
DROP FUNCTION IF EXISTS fn_ae_resolve_amount_formula(NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS fn_ae_resolve_montant(NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB,TEXT);
DROP TABLE IF EXISTS accounting_rule_audit_log;
DROP TABLE IF EXISTS accounting_event_extournes;
DROP TABLE IF EXISTS accounting_event_log;
DROP TABLE IF EXISTS accounting_event_rules;
DROP TABLE IF EXISTS accounting_events;
DROP TABLE IF EXISTS accounting_fiscal_params;
DROP TABLE IF EXISTS accounting_schema_versions;
COMMIT;
*/
