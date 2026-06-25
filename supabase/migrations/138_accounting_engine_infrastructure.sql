-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 138 — Moteur Comptable Central — Infrastructure Pure
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.0
-- Gouvernance : docs/plan-directeur/phase35-gouvernance-moteur-comptable.md
-- Catalogue   : docs/plan-directeur/phase3-catalogue-evenements-comptables.md
-- Architecture: docs/plan-directeur/phase4-architecture-moteur-central.md
--
-- PÉRIMÈTRE EXCLUSIF DE CETTE MIGRATION :
--   ✅ Tables centrales + versionnement + audit
--   ✅ Index + contraintes d'intégrité
--   ✅ Fonctions du moteur (emit, process, replay, reverse, helpers)
--   ✅ Vues de monitoring et santé
--   ✅ RLS + sécurité
--   ✅ Paramètres fiscaux par pays (table de configuration)
--   ✅ Enregistrement de cette migration dans accounting_schema_versions
--
--   ❌ AUCUNE règle métier dans accounting_event_rules (migrations 139+ par module)
--   ❌ AUCUNE migration de module existant (Santé, Restaurant, École, etc.)
--   ❌ AUCUNE modification des triggers de migration 046 ou 136
--
-- Les anciens triggers (046, 130, 133, 136, 137) continuent de fonctionner
-- en parallèle — aucune rupture de service.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS & HELPERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- Pour gen_random_uuid() si non disponible

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACCOUNTING_SCHEMA_VERSIONS — Versionnement du moteur lui-même
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_schema_versions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT        NOT NULL UNIQUE,  -- '1.0.0', '1.1.0', '2.0.0'
  semver_major     INT         NOT NULL GENERATED ALWAYS AS (split_part(version, '.', 1)::INT) STORED,
  semver_minor     INT         NOT NULL GENERATED ALWAYS AS (split_part(version, '.', 2)::INT) STORED,
  semver_patch     INT         NOT NULL GENERATED ALWAYS AS (split_part(version, '.', 3)::INT) STORED,
  migration_file   TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  breaking_change  BOOLEAN     NOT NULL DEFAULT FALSE,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by       TEXT
);

COMMENT ON TABLE accounting_schema_versions IS
  'Historique des versions du moteur comptable central. Une entrée par migration modifiant le moteur.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTING_FISCAL_PARAMS — Paramètres fiscaux par pays
-- ─────────────────────────────────────────────────────────────────────────────
-- Utilisés par les MODULES pour calculer les montants (HT, TVA, etc.)
-- Le moteur encode les COMPTES ; les modules utilisent ces paramètres pour CALCULER.

CREATE TABLE IF NOT EXISTS accounting_fiscal_params (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code     TEXT        NOT NULL,  -- 'CG', 'CM', 'GA', 'CD', 'TD', 'CF', 'GQ'
  param_name       TEXT        NOT NULL,
  -- Paramètres disponibles :
  -- 'tva_taux'         : taux TVA standard (ex: '18.00')
  -- 'tva_taux_reduit'  : taux TVA réduit si applicable
  -- 'ca_taux'          : taux Contribution des Affaires / précompte IS à la source
  -- 'cnss_sal_taux'    : taux CNSS part salariale
  -- 'cnss_pat_taux'    : taux CNSS part patronale
  -- 'irpp_tranche_1'   : seuil 1ère tranche IRPP
  -- 'irpp_taux_1'      : taux 1ère tranche IRPP
  -- 'smic_mensuel'     : SMIC/SMIG mensuel en XAF
  param_value      TEXT        NOT NULL,  -- Valeur texte (parseFloat en TS)
  valid_from       DATE        NOT NULL,
  valid_until      DATE,                  -- NULL = toujours valide
  source_reference TEXT,                  -- Décret / Loi de référence
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, param_name, valid_from)
);

CREATE INDEX idx_afp_country_param ON accounting_fiscal_params (country_code, param_name);
CREATE INDEX idx_afp_validity ON accounting_fiscal_params (valid_from, valid_until);

COMMENT ON TABLE accounting_fiscal_params IS
  'Paramètres fiscaux par pays — taux TVA, CNSS, IRPP, CA. Versionnés par date de validité.';

-- Données initiales — paramètres Congo-Brazzaville (référence principale)
INSERT INTO accounting_fiscal_params (country_code, param_name, param_value, valid_from, source_reference, notes) VALUES
('CG', 'tva_taux',        '18.00', '2018-01-01', 'Code Général des Impôts Congo 2018', 'TVA standard CEMAC'),
('CG', 'ca_taux',         '5.00',  '2018-01-01', 'CGI Congo — Contribution des Affaires 5%', 'Précompte sur services'),
('CG', 'cnss_sal_taux',   '4.88',  '2018-01-01', 'CNSS Congo — Loi 009-92 et décrets', 'Part salariale CNSS'),
('CG', 'cnss_pat_taux',   '16.20', '2018-01-01', 'CNSS Congo — Loi 009-92 et décrets', 'Part patronale CNSS (maladie 2% + retraite 8% + AF 6.2%)'),
('CG', 'smic_mensuel',    '90000', '2024-01-01', 'Décret Congo SMIG 2024', 'SMIG Congo-Brazzaville 2024 — à reconfirmer'),
-- Cameroun
('CM', 'tva_taux',        '19.25', '2018-01-01', 'CGI Cameroun — TVA 19.25% (TVA 17.5% + CAC 10%)', 'Inclut Centimes Additionnels Communaux'),
('CM', 'cnss_sal_taux',   '2.80',  '2018-01-01', 'CNPS Cameroun', 'Part salariale CNPS'),
('CM', 'cnss_pat_taux',   '17.68', '2018-01-01', 'CNPS Cameroun', 'Part patronale CNPS'),
('CM', 'smic_mensuel',    '36270', '2014-01-01', 'Décret n°2014-2343 du 05/08/2014', 'SMIG Cameroun — à reconfirmer'),
-- Gabon
('GA', 'tva_taux',        '18.00', '2018-01-01', 'CGI Gabon', 'TVA standard Gabon'),
-- RDC
('CD', 'tva_taux',        '16.00', '2018-01-01', 'CGI RDC', 'TVA standard RDC'),
-- Tchad — à compléter avec sources officielles
('TD', 'tva_taux',        '18.00', '2018-01-01', 'CGI Tchad — À CONFIRMER', 'Taux indicatif — vérifier source officielle'),
-- RCA
('CF', 'tva_taux',        '19.00', '2018-01-01', 'CGI RCA — À CONFIRMER', 'Taux indicatif — vérifier source officielle');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ACCOUNTING_EVENTS — Table centrale des événements (immuable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_events (
  -- Identité
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,

  -- Type d'événement (catalogue Phase 3)
  event_type       TEXT        NOT NULL,  -- 'FAC-001', 'PAI-001', 'SAN-001', etc.
  event_module     TEXT        GENERATED ALWAYS AS (split_part(event_type, '-', 1)) STORED,

  -- Versionnement (Phase 3.5)
  event_version    INT         NOT NULL DEFAULT 1,
  schema_version   TEXT        NOT NULL DEFAULT '1.0.0',

  -- Source métier
  source_module    TEXT        NOT NULL,  -- 'facturation', 'paie', 'sante', etc.
  source_table     TEXT        NOT NULL,  -- 'factures', 'bulletins_paie', etc.
  source_id        UUID        NOT NULL,  -- ID de l'enregistrement source

  -- Montants bruts (calculés par le module, pas par le moteur)
  montant_ht       NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_tva      NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_ttc      NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_net      NUMERIC(14,2),         -- Net paie, net après remise, etc.

  -- Contexte
  devise           TEXT        NOT NULL DEFAULT 'XAF',
  fiscal_year      INT         NOT NULL,
  date_event       DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle          TEXT        NOT NULL,

  -- Métadonnées additionnelles (structurées, flexibles)
  metadata         JSONB       NOT NULL DEFAULT '{}',
  -- Exemples :
  -- {"mode_paiement":"virement","client_name":"AMD Finance","invoice_number":"FAC-2026-001"}
  -- {"employe_nom":"Jean Dupont","mois":6,"annee":2026,"cnss_pat":8500,"cnss_sal":2600,"irpp":3200}
  -- {"patient_nom":"Alice Martin","date_consult":"2026-06-25","medecin":"Dr Kongo"}

  -- Statut de traitement (cycle de vie Phase 3.5)
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | processed | error | retrying | dead_letter | cancelled | reversed | superseded

  -- Lien avec l'événement original (si c'est un replay ou une extourne)
  replayed_from    UUID        REFERENCES accounting_events(id),
  reversed_by      UUID        REFERENCES accounting_events(id),
  correction_of    UUID        REFERENCES accounting_events(id),

  -- Traitement
  processed_at     TIMESTAMPTZ,
  error_message    TEXT,
  retry_count      INT         NOT NULL DEFAULT 0,
  max_retries      INT         NOT NULL DEFAULT 3,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,

  -- Contraintes
  CONSTRAINT chk_ae_montant_positif CHECK (montant_ttc >= 0 AND montant_ht >= 0),
  CONSTRAINT chk_ae_status CHECK (
    status IN ('pending','processing','processed','error','retrying','dead_letter',
               'cancelled','reversed','superseded')
  ),
  CONSTRAINT chk_ae_event_type CHECK (event_type ~ '^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$'),
  CONSTRAINT chk_ae_fiscal_year CHECK (fiscal_year BETWEEN 2000 AND 2100),
  CONSTRAINT chk_ae_devise CHECK (devise IN ('XAF','EUR','USD','XOF','CDF'))
);

-- Idempotence : un seul événement PROCESSED par source_table + source_id + event_type
CREATE UNIQUE INDEX uidx_ae_idempotence ON accounting_events (source_table, source_id, event_type)
  WHERE status = 'processed';

-- Index de performance
CREATE INDEX idx_ae_tenant_date     ON accounting_events (tenant_id, date_event DESC);
CREATE INDEX idx_ae_tenant_status   ON accounting_events (tenant_id, status) WHERE status != 'processed';
CREATE INDEX idx_ae_source          ON accounting_events (source_table, source_id);
CREATE INDEX idx_ae_event_type      ON accounting_events (event_type, fiscal_year);
CREATE INDEX idx_ae_fiscal_year     ON accounting_events (tenant_id, fiscal_year);
CREATE INDEX idx_ae_module          ON accounting_events (event_module, tenant_id);
CREATE INDEX idx_ae_created_at      ON accounting_events (created_at DESC);
CREATE INDEX idx_ae_metadata_gin    ON accounting_events USING GIN (metadata);

COMMENT ON TABLE accounting_events IS
  'Journal central immuable de tous les événements comptables Oraforme. Append-only.';
COMMENT ON COLUMN accounting_events.event_type IS
  'Code événement du catalogue Phase 3 : FAC-001, PAI-001, SAN-001, etc.';
COMMENT ON COLUMN accounting_events.event_version IS
  'Version du schéma de l''événement — incrément si nouveaux champs metadata ajoutés.';
COMMENT ON COLUMN accounting_events.schema_version IS
  'Version du moteur comptable au moment de l''émission.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ACCOUNTING_EVENT_RULES — Règles SYSCOHADA versionnées par événement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_event_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification de la règle
  event_type       TEXT        NOT NULL,  -- 'FAC-001'
  sequence         INT         NOT NULL,  -- Ordre de l'écriture (1, 2, 3...)
  rule_version     INT         NOT NULL DEFAULT 1,

  -- Statut (cycle de vie Phase 3.5)
  status           TEXT        NOT NULL DEFAULT 'draft',
  -- draft | active | deprecated | archived | suspended | rejected
  superseded_by    UUID        REFERENCES accounting_event_rules(id),
  change_reason    TEXT,                  -- Pourquoi cette version a été créée

  -- Comptes SYSCOHADA (format 3/4 chiffres normalisé — post-migration 137)
  debit_account    TEXT        NOT NULL,
  credit_account   TEXT        NOT NULL,

  -- Résolution du montant
  montant_field    TEXT        NOT NULL DEFAULT 'montant_ttc',
  -- 'montant_ht'        : utilise montant_ht
  -- 'montant_tva'       : utilise montant_tva
  -- 'montant_ttc'       : utilise montant_ttc
  -- 'montant_net'       : utilise montant_net
  -- 'metadata.CHAMP'    : extrait du JSONB metadata (ex: 'metadata.cnss_patronal')

  -- Résolution dynamique du compte de trésorerie
  account_resolver TEXT,
  -- NULL                : utilise debit_account/credit_account statiques
  -- 'treasury_debit'    : le moteur appelle fn_ohada_cash_account(metadata.mode_paiement) pour le débit
  -- 'treasury_credit'   : idem pour le crédit

  -- Source pour journal_entries.source (permet le rapprochement)
  source_label     TEXT        NOT NULL,  -- 'factures_emises', 'paie_accrual', etc.

  -- Libellé de l'écriture (template avec substitutions)
  libelle_tpl      TEXT        NOT NULL,
  -- Variables disponibles : {invoice_number}, {client_name}, {employe_nom}, {mois}, {annee}
  -- et tout champ présent dans metadata

  -- Condition d'application (pour les écritures optionnelles)
  condition_field  TEXT,
  condition_op     TEXT,       -- '>', '<', '=', '!=', 'is_not_null'
  condition_value  TEXT,
  -- Exemple : condition_field='montant_tva', condition_op='>', condition_value='0'
  -- → N'écrire cette ligne QUE si tva > 0

  -- Scope géographique
  country_codes    TEXT[],     -- NULL = tous pays ; ['CG','CM'] = Congo + Cameroun uniquement

  -- Plan comptable applicable
  account_plan     TEXT        NOT NULL DEFAULT 'SYSCOHADA',
  -- 'SYSCOHADA' | 'COBAC' | 'CIMA' (pour assurances)

  -- Validité temporelle
  valid_from       DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,       -- NULL = toujours valide (jusqu'à nouvelle version)

  -- Exercices fiscaux applicables (NULL = tous)
  fiscal_years     INT[],

  -- Métadonnées de gestion
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  notes            TEXT,

  -- Contraintes
  CONSTRAINT chk_aer_accounts  CHECK (debit_account != credit_account),
  CONSTRAINT chk_aer_status    CHECK (status IN ('draft','active','deprecated','archived','suspended','rejected')),
  CONSTRAINT chk_aer_sequence  CHECK (sequence BETWEEN 1 AND 20),
  CONSTRAINT chk_aer_montant   CHECK (montant_field IN (
    'montant_ht','montant_tva','montant_ttc','montant_net'
  ) OR montant_field LIKE 'metadata.%')
);

-- Contrainte : pas de chevauchement de plages pour même event_type+sequence+country (partielle)
-- (Le check complet est fait dans fn_validate_rule_overlap())
CREATE UNIQUE INDEX uidx_aer_version ON accounting_event_rules
  (event_type, sequence, rule_version, COALESCE(country_codes::TEXT, 'ALL'));

-- Index performance
CREATE INDEX idx_aer_event_type   ON accounting_event_rules (event_type, status, valid_from);
CREATE INDEX idx_aer_active       ON accounting_event_rules (event_type, sequence) WHERE status = 'active';
CREATE INDEX idx_aer_country      ON accounting_event_rules USING GIN (country_codes);

COMMENT ON TABLE accounting_event_rules IS
  'Règles SYSCOHADA versionnées pour chaque événement comptable. Seed dans migrations 139+.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ACCOUNTING_EVENT_LOG — Audit trail de chaque traitement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_event_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES accounting_events(id),
  tenant_id           UUID        NOT NULL,

  -- Résultat du traitement
  journal_entry_ids   UUID[]      NOT NULL DEFAULT '{}',
  transaction_id      UUID,

  -- Vérification de l'équilibre comptable
  entries_count       INT         NOT NULL DEFAULT 0,
  total_debit         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit        NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_balanced         BOOLEAN     GENERATED ALWAYS AS (
    ABS(total_debit - total_credit) < 0.01
  ) STORED,

  -- Versionnement et traçabilité
  schema_version      TEXT        NOT NULL DEFAULT '1.0.0',
  rules_snapshot      JSONB,      -- Snapshot des règles utilisées (audit)
  replay_mode         TEXT,       -- NULL | 'current' | 'historical'
  is_replay           BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Performance
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms         INT,

  CONSTRAINT chk_ael_replay_mode CHECK (replay_mode IN (NULL, 'current', 'historical'))
);

CREATE INDEX idx_ael_event_id    ON accounting_event_log (event_id);
CREATE INDEX idx_ael_tenant      ON accounting_event_log (tenant_id, processed_at DESC);
CREATE INDEX idx_ael_je_ids      ON accounting_event_log USING GIN (journal_entry_ids);

COMMENT ON TABLE accounting_event_log IS
  'Audit trail immuable de chaque traitement d''événement comptable.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ACCOUNTING_EVENT_EXTOURNES — Tracking des extournes (contra-entries)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_event_extournes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id   UUID        NOT NULL REFERENCES accounting_events(id),
  extourne_event_id   UUID        REFERENCES accounting_events(id),
  reason              TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  UNIQUE (original_event_id)
);

COMMENT ON TABLE accounting_event_extournes IS
  'Lien entre un événement original et son événement d''extourne (correction comptable).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ACCOUNTING_RULE_AUDIT_LOG — Traçabilité des modifications de règles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_rule_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      UUID        NOT NULL REFERENCES accounting_event_rules(id),
  action       TEXT        NOT NULL,  -- 'created', 'activated', 'deprecated', 'archived', 'suspended'
  old_status   TEXT,
  new_status   TEXT,
  changed_by   TEXT,
  change_reason TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rule_snapshot JSONB       NOT NULL  -- Snapshot de la règle au moment du changement
);

CREATE INDEX idx_aral_rule_id ON accounting_rule_audit_log (rule_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS — SÉCURITÉ
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounting_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_event_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_event_extournes ENABLE ROW LEVEL SECURITY;
-- accounting_event_rules, accounting_fiscal_params, accounting_schema_versions
-- sont des données globales (pas de RLS par tenant)

CREATE POLICY ae_tenant_read ON accounting_events
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY ae_tenant_insert ON accounting_events
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Pas de UPDATE/DELETE par les utilisateurs (seul SECURITY DEFINER peut modifier)
CREATE POLICY ael_tenant_read ON accounting_event_log
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY aee_tenant_read ON accounting_event_extournes
  FOR SELECT USING (
    original_event_id IN (SELECT id FROM accounting_events WHERE tenant_id = get_my_tenant_id())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. FONCTIONS HELPERS DU MOTEUR
-- ─────────────────────────────────────────────────────────────────────────────

-- 9.1 Résoudre le montant depuis metadata ou champs directs
CREATE OR REPLACE FUNCTION fn_ae_resolve_montant(
  p_ht       NUMERIC,
  p_tva      NUMERIC,
  p_ttc      NUMERIC,
  p_net      NUMERIC,
  p_metadata JSONB,
  p_field    TEXT
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE
    WHEN p_field = 'montant_ht'  THEN COALESCE(p_ht,  0)
    WHEN p_field = 'montant_tva' THEN COALESCE(p_tva, 0)
    WHEN p_field = 'montant_ttc' THEN COALESCE(p_ttc, 0)
    WHEN p_field = 'montant_net' THEN COALESCE(p_net, 0)
    WHEN p_field LIKE 'metadata.%' THEN
      COALESCE((p_metadata ->> substr(p_field, 10))::NUMERIC, 0)
    ELSE 0
  END;
END;
$$;

-- 9.2 Résoudre un libellé template (substitution de variables {champ})
CREATE OR REPLACE FUNCTION fn_ae_resolve_libelle(
  p_template TEXT,
  p_metadata JSONB,
  p_fallback TEXT
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_result TEXT := COALESCE(p_template, p_fallback);
  v_key    TEXT;
  v_val    TEXT;
BEGIN
  IF p_metadata IS NULL OR p_template IS NULL THEN
    RETURN COALESCE(p_fallback, '');
  END IF;
  FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(p_metadata)
  LOOP
    v_result := REPLACE(v_result, '{' || v_key || '}', COALESCE(v_val, ''));
  END LOOP;
  RETURN v_result;
END;
$$;

-- 9.3 Évaluer une condition sur un montant ou un champ metadata
CREATE OR REPLACE FUNCTION fn_ae_eval_condition(
  p_metadata     JSONB,
  p_ht           NUMERIC,
  p_tva          NUMERIC,
  p_ttc          NUMERIC,
  p_net          NUMERIC,
  p_field        TEXT,
  p_op           TEXT,
  p_value        TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_left NUMERIC;
  v_right NUMERIC;
BEGIN
  IF p_field IS NULL THEN RETURN TRUE; END IF;

  -- Résoudre la valeur gauche
  v_left := fn_ae_resolve_montant(p_ht, p_tva, p_ttc, p_net, p_metadata, p_field);

  -- is_not_null : vérifie que le champ existe et est non null
  IF p_op = 'is_not_null' THEN
    IF p_field LIKE 'metadata.%' THEN
      RETURN (p_metadata ->> substr(p_field, 10)) IS NOT NULL;
    END IF;
    RETURN v_left IS NOT NULL;
  END IF;

  v_right := p_value::NUMERIC;

  RETURN CASE p_op
    WHEN '>'  THEN v_left > v_right
    WHEN '>=' THEN v_left >= v_right
    WHEN '<'  THEN v_left < v_right
    WHEN '<=' THEN v_left <= v_right
    WHEN '='  THEN v_left = v_right
    WHEN '!=' THEN v_left != v_right
    ELSE TRUE
  END;
END;
$$;

-- 9.4 Résoudre le compte de trésorerie selon le mode de paiement
-- (Délègue à fn_ohada_cash_account si disponible, sinon fallback)
CREATE OR REPLACE FUNCTION fn_ae_resolve_treasury_account(
  p_metadata  JSONB,
  p_side      TEXT  -- 'debit' ou 'credit'
) RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_mode TEXT;
BEGIN
  v_mode := COALESCE(p_metadata->>'mode_paiement', 'virement');
  -- Déléguer à la fonction existante de migration 135
  RETURN fn_ohada_cash_account(v_mode);
EXCEPTION WHEN OTHERS THEN
  RETURN '521';  -- Fallback banque
END;
$$;

-- 9.5 Déterminer si un event_type impacte la trésorerie
CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB');
$$;

-- 9.6 Déterminer le sens de l'impact trésorerie
CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002','HOT-004','TRP-001','CAB-001'
  );
$$;

-- 9.7 Catégorie pour la table transactions
CREATE OR REPLACE FUNCTION fn_ae_category(p_event_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE split_part(p_event_type, '-', 1)
    WHEN 'FAC' THEN 'Facturation'
    WHEN 'PAI' THEN 'Paie'
    WHEN 'SAN' THEN 'Santé'
    WHEN 'RES' THEN 'Restaurant'
    WHEN 'ECO' THEN 'Scolarité'
    WHEN 'COM' THEN 'Commerce'
    WHEN 'TRP' THEN 'Transport'
    WHEN 'HOT' THEN 'Hôtel'
    WHEN 'FIS' THEN 'Fiscalité'
    WHEN 'TRE' THEN 'Trésorerie'
    WHEN 'MOB' THEN 'Mobile Money'
    WHEN 'ONG' THEN 'ONG'
    WHEN 'CAB' THEN 'Cabinet'
    ELSE 'Autre'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. FONCTION CENTRALE — fn_get_applicable_rules()
-- Résolution des règles avec versionnement + pays + date
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ae_get_applicable_rules(
  p_event_type   TEXT,
  p_date         DATE,
  p_country_code TEXT DEFAULT NULL
) RETURNS SETOF accounting_event_rules LANGUAGE sql STABLE AS $$
  -- Priorité : règle pays spécifique > règle générale OHADA
  -- Filtre : status='active', plage de dates, pays
  SELECT DISTINCT ON (sequence) r.*
  FROM accounting_event_rules r
  WHERE r.event_type = p_event_type
    AND r.status     = 'active'
    AND r.valid_from <= p_date
    AND (r.valid_until IS NULL OR r.valid_until >= p_date)
    AND (
      -- Règle spécifique au pays
      (p_country_code IS NOT NULL AND r.country_codes IS NOT NULL
       AND p_country_code = ANY(r.country_codes))
      OR
      -- Règle générale (tous pays)
      r.country_codes IS NULL
    )
  ORDER BY sequence,
    -- Priorité : règle pays spécifique avant règle générale
    CASE WHEN r.country_codes IS NOT NULL THEN 0 ELSE 1 END,
    r.rule_version DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. MOTEUR PRINCIPAL — fn_process_accounting_event()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_process_accounting_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule          accounting_event_rules%ROWTYPE;
  v_montant       NUMERIC(14,2);
  v_debit         TEXT;
  v_credit        TEXT;
  v_libelle       TEXT;
  v_je_id         UUID;
  v_je_ids        UUID[] := '{}';
  v_tx_id         UUID;
  v_total         NUMERIC(14,2) := 0;
  v_entries       INT           := 0;
  v_start_time    TIMESTAMPTZ   := clock_timestamp();
  v_country       TEXT;
  v_rules_used    JSONB         := '[]'::JSONB;
BEGIN
  -- Verrou optimiste : marquer comme en cours de traitement
  UPDATE accounting_events SET status = 'processing' WHERE id = NEW.id;

  -- Récupérer le code pays du tenant (depuis entreprise_config si disponible)
  v_country := COALESCE(
    NEW.metadata->>'country_code',
    (SELECT ec.nom::TEXT FROM entreprise_config ec  -- On cherche le pays dans la config
     WHERE ec.tenant_id = NEW.tenant_id LIMIT 1),
    'CG'  -- Fallback Congo-Brazzaville
  );

  -- Parcourir les règles applicables dans l'ordre
  FOR v_rule IN
    SELECT * FROM fn_ae_get_applicable_rules(NEW.event_type, NEW.date_event, v_country)
  LOOP
    -- Évaluer la condition d'application
    IF NOT fn_ae_eval_condition(
      NEW.metadata, NEW.montant_ht, NEW.montant_tva, NEW.montant_ttc, NEW.montant_net,
      v_rule.condition_field, v_rule.condition_op, v_rule.condition_value
    ) THEN
      CONTINUE;
    END IF;

    -- Résoudre le montant
    v_montant := fn_ae_resolve_montant(
      NEW.montant_ht, NEW.montant_tva, NEW.montant_ttc, NEW.montant_net,
      NEW.metadata, v_rule.montant_field
    );

    IF COALESCE(v_montant, 0) <= 0 THEN CONTINUE; END IF;

    -- Résoudre les comptes (statiques ou dynamiques via account_resolver)
    v_debit  := v_rule.debit_account;
    v_credit := v_rule.credit_account;

    IF v_rule.account_resolver = 'treasury_debit' THEN
      v_debit := fn_ae_resolve_treasury_account(NEW.metadata, 'debit');
    ELSIF v_rule.account_resolver = 'treasury_credit' THEN
      v_credit := fn_ae_resolve_treasury_account(NEW.metadata, 'credit');
    END IF;

    -- Résoudre le libellé
    v_libelle := fn_ae_resolve_libelle(v_rule.libelle_tpl, NEW.metadata, NEW.libelle);

    -- Créer l'écriture journal_entries
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year,
      piece_number
    ) VALUES (
      NEW.tenant_id, NEW.date_event, v_libelle,
      v_debit, v_credit, v_montant,
      v_rule.source_label, NEW.source_id, NEW.fiscal_year,
      NEW.metadata->>'piece_number'
    )
    RETURNING id INTO v_je_id;

    v_je_ids    := array_append(v_je_ids, v_je_id);
    v_total     := v_total + v_montant;
    v_entries   := v_entries + 1;
    v_rules_used := v_rules_used || to_jsonb(v_rule.id);
  END LOOP;

  -- Créer la ligne transactions si impact trésorerie
  IF fn_ae_has_treasury_impact(NEW.event_type) AND COALESCE(NEW.montant_ttc, 0) > 0 THEN
    INSERT INTO transactions (
      tenant_id, type, categorie, description, montant, date,
      mode_paiement, source, source_id, fiscal_year,
      debit_account, credit_account
    ) VALUES (
      NEW.tenant_id,
      CASE WHEN fn_ae_is_income(NEW.event_type) THEN 'entree' ELSE 'sortie' END,
      fn_ae_category(NEW.event_type),
      NEW.libelle,
      NEW.montant_ttc,
      NEW.date_event,
      COALESCE(NEW.metadata->>'mode_paiement', 'virement'),
      NEW.source_module,
      NEW.source_id,
      NEW.fiscal_year,
      NULL, NULL  -- Les comptes sont dans journal_entries
    )
    RETURNING id INTO v_tx_id;
  END IF;

  -- Synchroniser la trésorerie si événement tréso
  IF split_part(NEW.event_type, '-', 1) IN ('TRE','MOB','FAC','SAN','RES','ECO') THEN
    BEGIN
      PERFORM fn_sync_tresorerie_soldes(NEW.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- Non bloquant
    END;
  END IF;

  -- Créer le log d'audit
  INSERT INTO accounting_event_log (
    event_id, tenant_id, journal_entry_ids, transaction_id,
    entries_count, total_debit, total_credit,
    schema_version, rules_snapshot, is_replay,
    duration_ms
  ) VALUES (
    NEW.id, NEW.tenant_id, v_je_ids, v_tx_id,
    v_entries, v_total, v_total,
    '1.0.0',
    jsonb_build_object('rule_ids', v_rules_used, 'country', v_country),
    (NEW.replayed_from IS NOT NULL),
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INT
  );

  -- Marquer comme traité
  UPDATE accounting_events
  SET status = 'processed', processed_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Isolation : ne jamais propager l'erreur vers la transaction source
  UPDATE accounting_events
  SET status        = CASE WHEN retry_count >= max_retries THEN 'dead_letter' ELSE 'error' END,
      error_message = SQLERRM || ' | ' || SQLSTATE,
      retry_count   = retry_count + 1
  WHERE id = NEW.id;

  RAISE WARNING '[accounting_engine] Erreur event % (type=%): % — %',
    NEW.id, NEW.event_type, SQLERRM, SQLSTATE;

  RETURN NEW;
END;
$$;

-- Trigger : AFTER INSERT uniquement, sur événements pending
CREATE TRIGGER trg_process_accounting_event
  AFTER INSERT ON accounting_events
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_process_accounting_event();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FONCTION D'ÉMISSION — emit_accounting_event()
-- Point d'entrée unique pour tous les modules métier
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
  v_event_id  UUID;
  v_year      INT := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM p_date_event)::INT);
BEGIN
  -- Validation des entrées
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'emit_accounting_event: event_type est obligatoire';
  END IF;
  IF p_source_id IS NULL THEN
    RAISE EXCEPTION 'emit_accounting_event: source_id est obligatoire';
  END IF;
  IF p_montant_ttc < 0 THEN
    RAISE EXCEPTION 'emit_accounting_event: montant_ttc ne peut pas être négatif (utilisez une extourne)';
  END IF;

  -- Idempotence : ne pas réémettre si déjà traité pour ce triplet
  IF EXISTS (
    SELECT 1 FROM accounting_events
    WHERE tenant_id    = p_tenant_id
      AND event_type   = p_event_type
      AND source_table = p_source_table
      AND source_id    = p_source_id
      AND status       = 'processed'
  ) THEN
    RAISE NOTICE 'emit_accounting_event: événement % pour %/% déjà traité, ignoré.',
      p_event_type, p_source_table, p_source_id;
    RETURN NULL;
  END IF;

  -- Insérer l'événement (le trigger trg_process_accounting_event se déclenche immédiatement)
  INSERT INTO accounting_events (
    tenant_id, event_type, event_version, schema_version,
    source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status
  ) VALUES (
    p_tenant_id, p_event_type, p_event_version, '1.0.0',
    p_source_module, p_source_table, p_source_id,
    COALESCE(p_montant_ht, 0), COALESCE(p_montant_tva, 0),
    COALESCE(p_montant_ttc, 0), p_montant_net,
    COALESCE(p_libelle, ''), p_date_event, v_year,
    COALESCE(p_metadata, '{}'), 'pending'
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION emit_accounting_event IS
  'Point d''entrée unique du moteur comptable. Appelé par tous les modules métier.
   Ne jamais insérer directement dans journal_entries depuis un module.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. FONCTION D'EXTOURNE — fn_reverse_accounting_event()
-- Crée les écritures inverses pour corriger une erreur
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reverse_accounting_event(
  p_event_id   UUID,
  p_reason     TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event          accounting_events%ROWTYPE;
  v_je             RECORD;
  v_extourne_id    UUID;
  v_log            accounting_event_log%ROWTYPE;
BEGIN
  -- Récupérer l'événement original
  SELECT * INTO v_event FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: événement % introuvable', p_event_id;
  END IF;
  IF v_event.status != 'processed' THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: seul un événement processed peut être extourné (statut actuel: %)', v_event.status;
  END IF;

  -- Vérifier qu'une extourne n'existe pas déjà
  IF EXISTS (SELECT 1 FROM accounting_event_extournes WHERE original_event_id = p_event_id) THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: cet événement a déjà été extourné';
  END IF;

  -- Récupérer le log pour avoir les journal_entry_ids
  SELECT * INTO v_log FROM accounting_event_log WHERE event_id = p_event_id ORDER BY processed_at DESC LIMIT 1;

  -- Créer les écritures inverses pour chaque journal_entry original
  FOR v_je IN
    SELECT * FROM journal_entries
    WHERE id = ANY(v_log.journal_entry_ids)
  LOOP
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year, piece_number
    ) VALUES (
      v_je.tenant_id,
      CURRENT_DATE,
      'EXTOURNE — ' || v_je.libelle || ' — ' || LEFT(p_reason, 100),
      v_je.credit_account,   -- Débit et crédit inversés
      v_je.debit_account,
      v_je.montant,
      'extourne_' || v_je.source,
      v_je.source_id,
      v_je.fiscal_year,
      'EXT-' || COALESCE(v_je.piece_number, v_je.id::TEXT)
    );
  END LOOP;

  -- Créer un événement d'extourne dans accounting_events
  INSERT INTO accounting_events (
    tenant_id, event_type, source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status,
    correction_of, created_by
  ) VALUES (
    v_event.tenant_id,
    'EXT-' || split_part(v_event.event_type, '-', 1) || '-' || split_part(v_event.event_type, '-', 2),
    v_event.source_module, v_event.source_table, v_event.source_id,
    v_event.montant_ht, v_event.montant_tva, v_event.montant_ttc, v_event.montant_net,
    'EXTOURNE — ' || v_event.libelle,
    CURRENT_DATE, v_event.fiscal_year,
    jsonb_build_object('original_event_id', p_event_id, 'reason', p_reason),
    'processed',  -- L'extourne est déjà traitée (on vient d'insérer les JE)
    p_event_id, p_created_by
  )
  RETURNING id INTO v_extourne_id;

  -- Enregistrer dans la table d'extournes
  INSERT INTO accounting_event_extournes (original_event_id, extourne_event_id, reason, created_by)
  VALUES (p_event_id, v_extourne_id, p_reason, p_created_by);

  -- Marquer l'événement original comme extourné
  UPDATE accounting_events
  SET status = 'reversed', reversed_by = v_extourne_id
  WHERE id = p_event_id;

  RETURN v_extourne_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. FONCTION DE REPLAY — fn_replay_accounting_event()
-- Rejoue un événement avec les règles actuelles ou historiques
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_replay_accounting_event(
  p_event_id   UUID,
  p_mode       TEXT DEFAULT 'current'  -- 'current' | 'historical'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_original    accounting_events%ROWTYPE;
  v_replay_id   UUID;
BEGIN
  SELECT * INTO v_original FROM accounting_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_replay_accounting_event: événement % introuvable', p_event_id;
  END IF;

  -- Pour rejouer, l'événement doit être extourné d'abord (si déjà processed)
  IF v_original.status = 'processed' THEN
    RAISE EXCEPTION 'fn_replay_accounting_event: extourner d''abord l''événement avant de le rejouer';
  END IF;

  -- Créer un nouvel événement basé sur l'original
  INSERT INTO accounting_events (
    tenant_id, event_type, event_version, schema_version,
    source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status,
    replayed_from, created_by
  )
  SELECT
    tenant_id, event_type, event_version, '1.0.0',
    source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle,
    CASE WHEN p_mode = 'historical' THEN date_event ELSE CURRENT_DATE END,
    fiscal_year,
    metadata || jsonb_build_object('replay_mode', p_mode, 'replayed_at', NOW()),
    'pending',
    p_event_id, NULL
  FROM accounting_events WHERE id = p_event_id
  RETURNING id INTO v_replay_id;

  -- Marquer l'original comme superseded
  UPDATE accounting_events SET status = 'superseded' WHERE id = p_event_id;

  RETURN v_replay_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. FONCTION DE SANTÉ — fn_accounting_health_check()
-- Diagnostic complet du moteur
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_accounting_health_check(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  check_name    TEXT,
  status        TEXT,
  count         BIGINT,
  details       TEXT
) LANGUAGE sql STABLE AS $$
  -- Événements en erreur
  SELECT 'events_in_error', CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    COUNT(*), 'Événements en erreur non traités'
  FROM accounting_events
  WHERE status IN ('error', 'dead_letter')
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  -- Événements bloqués en processing (> 5 min = deadlock probable)
  SELECT 'events_stuck_processing', CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END,
    COUNT(*), 'Événements bloqués en processing depuis > 5 minutes'
  FROM accounting_events
  WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  -- Écritures non équilibrées (débit ≠ crédit dans le log)
  SELECT 'unbalanced_entries', CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END,
    COUNT(*), 'Événements avec journal_entries déséquilibrés'
  FROM accounting_event_log
  WHERE NOT is_balanced
    AND entries_count > 0
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)

  UNION ALL

  -- Règles actives disponibles
  SELECT 'active_rules', CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END,
    COUNT(*), 'Règles SYSCOHADA actives dans accounting_event_rules'
  FROM accounting_event_rules WHERE status = 'active'

  UNION ALL

  -- Événements pending depuis > 1 heure (trigger non déclenché ?)
  SELECT 'events_pending_stale', CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    COUNT(*), 'Événements en pending depuis > 1 heure'
  FROM accounting_events
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '1 hour'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. VUES DE MONITORING
-- ─────────────────────────────────────────────────────────────────────────────

-- 16.1 Tableau de bord des événements par statut
CREATE OR REPLACE VIEW v_accounting_events_status AS
SELECT
  tenant_id,
  event_type,
  event_module,
  fiscal_year,
  status,
  COUNT(*)                              AS nb_events,
  SUM(montant_ttc)                      AS volume_total,
  MAX(created_at)                       AS dernier_event,
  COUNT(*) FILTER (WHERE status = 'error')        AS nb_erreurs,
  COUNT(*) FILTER (WHERE status = 'dead_letter')  AS nb_dead_letter
FROM accounting_events
GROUP BY tenant_id, event_type, event_module, fiscal_year, status;

-- 16.2 File des événements en erreur
CREATE OR REPLACE VIEW v_accounting_events_errors AS
SELECT
  ae.id,
  ae.tenant_id,
  ae.event_type,
  ae.source_module,
  ae.source_table,
  ae.source_id,
  ae.status,
  ae.error_message,
  ae.retry_count,
  ae.max_retries,
  ae.montant_ttc,
  ae.libelle,
  ae.created_at,
  ae.fiscal_year
FROM accounting_events ae
WHERE ae.status IN ('error', 'dead_letter')
ORDER BY ae.created_at DESC;

-- 16.3 Règles actives (vue opérationnelle)
CREATE OR REPLACE VIEW v_accounting_rules_active AS
SELECT
  event_type,
  sequence,
  rule_version,
  debit_account,
  credit_account,
  montant_field,
  source_label,
  libelle_tpl,
  country_codes,
  account_plan,
  valid_from,
  valid_until,
  notes
FROM accounting_event_rules
WHERE status = 'active'
ORDER BY event_type, sequence;

-- 16.4 Vérification de la balance par exercice et tenant
CREATE OR REPLACE VIEW v_accounting_balance_check AS
SELECT
  ael.tenant_id,
  ae.fiscal_year,
  ae.event_module,
  COUNT(ael.id)            AS nb_logs,
  SUM(ael.entries_count)   AS total_entries,
  SUM(ael.total_debit)     AS sum_debit,
  SUM(ael.total_credit)    AS sum_credit,
  ABS(SUM(ael.total_debit) - SUM(ael.total_credit)) AS ecart,
  BOOL_AND(ael.is_balanced) AS all_balanced
FROM accounting_event_log ael
JOIN accounting_events ae ON ae.id = ael.event_id
WHERE ae.status = 'processed'
GROUP BY ael.tenant_id, ae.fiscal_year, ae.event_module
ORDER BY ael.tenant_id, ae.fiscal_year DESC, ae.event_module;

-- 16.5 Queue de replay (événements candidats à rejouer après correction de règle)
CREATE OR REPLACE VIEW v_accounting_replay_queue AS
SELECT
  ae.id,
  ae.tenant_id,
  ae.event_type,
  ae.fiscal_year,
  ae.source_table,
  ae.source_id,
  ae.montant_ttc,
  ae.libelle,
  ae.processed_at,
  ael.rules_snapshot->>'country' AS country_used
FROM accounting_events ae
JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.status = 'processed'
ORDER BY ae.fiscal_year DESC, ae.processed_at DESC;

-- 16.6 Paramètres fiscaux actifs (vue courante)
CREATE OR REPLACE VIEW v_accounting_fiscal_params_active AS
SELECT
  country_code,
  param_name,
  param_value,
  valid_from,
  valid_until,
  source_reference
FROM accounting_fiscal_params
WHERE valid_from <= CURRENT_DATE
  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
ORDER BY country_code, param_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. ENREGISTREMENT DE CETTE MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions (version, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.0.0',
  '138_accounting_engine_infrastructure.sql',
  'Infrastructure du moteur comptable central : tables accounting_events, event_rules, event_log, extournes, schema_versions, fiscal_params. Fonctions : emit_accounting_event, fn_process_accounting_event, fn_reverse_accounting_event, fn_replay_accounting_event, fn_accounting_health_check. Vues de monitoring. Aucune règle métier, aucune migration de module.',
  FALSE,
  'Plan Directeur Phase 4.0'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. REQUÊTES DE CONTRÔLE POST-MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

-- A) Vérifier les tables créées
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'accounting_%' ORDER BY table_name;

-- B) Vérifier les fonctions créées
-- SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%accounting%' OR routine_name LIKE 'emit_%' OR routine_name LIKE 'fn_ae_%' OR routine_name LIKE 'fn_replay_%' OR routine_name LIKE 'fn_reverse_%';

-- C) Vérifier la version enregistrée
-- SELECT * FROM accounting_schema_versions;

-- D) Tester le health check (doit retourner 5 lignes toutes OK sauf 'active_rules' en WARNING car pas encore de règles)
-- SELECT * FROM fn_accounting_health_check();

-- E) Tester l'émission d'un événement fictif (à n'exécuter qu'en DEV)
-- SELECT emit_accounting_event(
--   (SELECT id FROM tenants LIMIT 1),
--   'FAC-001', 'facturation', 'factures', gen_random_uuid(),
--   1000, 180, 1180, NULL,
--   'Test moteur central', CURRENT_DATE, 2026,
--   '{"invoice_number":"TEST-001","client_name":"Test Client","mode_paiement":"virement"}'
-- );
-- → Doit retourner un UUID et status='error' (pas encore de règles pour FAC-001)
-- → Ne PAS exécuter en production avant que les règles soient définies (migration 139+)

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;

DROP TRIGGER IF EXISTS trg_process_accounting_event ON accounting_events;
DROP FUNCTION IF EXISTS fn_process_accounting_event();
DROP FUNCTION IF EXISTS emit_accounting_event(UUID,TEXT,TEXT,TEXT,UUID,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,DATE,INT,JSONB,INT);
DROP FUNCTION IF EXISTS fn_reverse_accounting_event(UUID,TEXT,UUID);
DROP FUNCTION IF EXISTS fn_replay_accounting_event(UUID,TEXT);
DROP FUNCTION IF EXISTS fn_accounting_health_check(UUID);
DROP FUNCTION IF EXISTS fn_ae_resolve_montant(NUMERIC,NUMERIC,NUMERIC,NUMERIC,JSONB,TEXT);
DROP FUNCTION IF EXISTS fn_ae_resolve_libelle(TEXT,JSONB,TEXT);
DROP FUNCTION IF EXISTS fn_ae_eval_condition(JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS fn_ae_resolve_treasury_account(JSONB,TEXT);
DROP FUNCTION IF EXISTS fn_ae_has_treasury_impact(TEXT);
DROP FUNCTION IF EXISTS fn_ae_is_income(TEXT);
DROP FUNCTION IF EXISTS fn_ae_category(TEXT);
DROP FUNCTION IF EXISTS fn_ae_get_applicable_rules(TEXT,DATE,TEXT);

DROP VIEW IF EXISTS v_accounting_events_status;
DROP VIEW IF EXISTS v_accounting_events_errors;
DROP VIEW IF EXISTS v_accounting_rules_active;
DROP VIEW IF EXISTS v_accounting_balance_check;
DROP VIEW IF EXISTS v_accounting_replay_queue;
DROP VIEW IF EXISTS v_accounting_fiscal_params_active;

DROP TABLE IF EXISTS accounting_rule_audit_log;
DROP TABLE IF EXISTS accounting_event_extournes;
DROP TABLE IF EXISTS accounting_event_log;
DROP TABLE IF EXISTS accounting_event_rules;
DROP TABLE IF EXISTS accounting_events;
DROP TABLE IF EXISTS accounting_fiscal_params;
DROP TABLE IF EXISTS accounting_schema_versions;

COMMIT;
*/
