-- ============================================================
-- Migration 055 — Workflow Engine Enterprise-Grade
-- Automatisation validations multi-niveaux — 8 types
-- Multi-tenant · RBAC · Audit · Notifications
-- ============================================================

-- ── 1. workflow_definitions ───────────────────────────────────────────────────
-- Catalogue des types de workflows (global + tenant-spécifique)

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global template
  type_key    TEXT NOT NULL,   -- 'depense', 'achat', 'conge', etc.
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#64748B',
  icon        TEXT NOT NULL DEFAULT 'workflow',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  steps_config JSONB NOT NULL, -- Définition complète des étapes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type_key)
);

CREATE INDEX IF NOT EXISTS wf_def_tenant_type ON workflow_definitions(tenant_id, type_key, is_active);

-- ── 2. workflow_instances ─────────────────────────────────────────────────────
-- Une instance = un document en cours de validation

CREATE TABLE IF NOT EXISTS workflow_instances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  definition_type_key  TEXT NOT NULL,   -- 'depense', 'achat', etc.
  source_table         TEXT,            -- 'depenses', 'achats', 'conges'...
  source_id            UUID,            -- ID du document source
  title                TEXT NOT NULL,
  description          TEXT,
  montant              NUMERIC,
  current_step         TEXT NOT NULL DEFAULT 'brouillon',
  statut               TEXT NOT NULL DEFAULT 'actif',
  -- 'actif' | 'approuve' | 'rejete' | 'annule' | 'expire'
  current_step_roles   TEXT[] NOT NULL DEFAULT '{}',
  -- Rôles pouvant agir à l'étape actuelle (pour requêtes rapides)
  initiator_profile_id UUID REFERENCES profiles(id),
  initiator_email      TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}',
  priority             TEXT NOT NULL DEFAULT 'normale',
  -- 'basse' | 'normale' | 'haute' | 'urgente'
  due_at               TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  rejected_reason      TEXT,
  step_order           INT NOT NULL DEFAULT 0,
  total_steps          INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wf_inst_tenant_statut     ON workflow_instances(tenant_id, statut);
CREATE INDEX IF NOT EXISTS wf_inst_tenant_step_roles ON workflow_instances USING GIN(current_step_roles);
CREATE INDEX IF NOT EXISTS wf_inst_initiator         ON workflow_instances(initiator_profile_id, statut);
CREATE INDEX IF NOT EXISTS wf_inst_source            ON workflow_instances(source_table, source_id);
CREATE INDEX IF NOT EXISTS wf_inst_type_step         ON workflow_instances(tenant_id, definition_type_key, current_step);

-- ── 3. workflow_transitions ───────────────────────────────────────────────────
-- Audit trail complet de chaque changement d'état

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  from_step        TEXT NOT NULL,
  to_step          TEXT NOT NULL,
  action           TEXT NOT NULL,
  -- 'create' | 'submit' | 'approve' | 'reject' | 'cancel' | 'expire' | 'comment'
  actor_profile_id UUID REFERENCES profiles(id),
  actor_email      TEXT,
  actor_role       TEXT,
  comment          TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wf_trans_instance   ON workflow_transitions(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wf_trans_actor      ON workflow_transitions(actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wf_trans_tenant     ON workflow_transitions(tenant_id, created_at DESC);

-- ── 4. workflow_comments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  author_profile_id UUID REFERENCES profiles(id),
  author_email     TEXT,
  content          TEXT NOT NULL,
  is_internal      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wf_comments_instance ON workflow_comments(instance_id, created_at);

-- ── 5. workflow_notifications ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  instance_id      UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  recipient_profile_id UUID REFERENCES profiles(id),
  recipient_email  TEXT,
  type             TEXT NOT NULL,
  -- 'action_required' | 'approved' | 'rejected' | 'cancelled' | 'commented' | 'reminder'
  title            TEXT NOT NULL,
  body             TEXT,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wf_notif_recipient ON workflow_notifications(recipient_profile_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS wf_notif_instance  ON workflow_notifications(instance_id);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE workflow_definitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;

-- Definitions : lisibles par tous les membres du tenant (ou templates globaux)
CREATE POLICY wf_def_read ON workflow_definitions FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = get_my_tenant_id());

CREATE POLICY wf_def_write ON workflow_definitions FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner','admin'))
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner','admin'));

-- Instances : lisibles par tout le tenant
CREATE POLICY wf_inst_read ON workflow_instances FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY wf_inst_insert ON workflow_instances FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY wf_inst_update ON workflow_instances FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

-- Transitions : lisibles par tout le tenant
CREATE POLICY wf_trans_read   ON workflow_transitions FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY wf_trans_insert ON workflow_transitions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Comments
CREATE POLICY wf_comm_read   ON workflow_comments FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY wf_comm_insert ON workflow_comments FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Notifications : chaque user voit les siennes
CREATE POLICY wf_notif_read ON workflow_notifications FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY wf_notif_update ON workflow_notifications FOR UPDATE
  USING (tenant_id = get_my_tenant_id() AND recipient_profile_id = get_my_profile_id());

-- ── 7. Données : configurations par défaut (templates globaux) ────────────────

-- DÉPENSE
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'depense', 'Demande de dépense',
  'Circuit de validation des demandes de dépenses',
  '#F97316', 'receipt',
  '{
    "steps": [
      {"key":"brouillon",       "label":"Brouillon",          "order":0, "roles":null,                        "sla_h":null, "description":"Rédaction de la demande"},
      {"key":"soumis",          "label":"Soumis",             "order":1, "roles":["admin","owner"],           "sla_h":24,   "description":"En attente validation responsable"},
      {"key":"valide_manager",  "label":"Validé Responsable", "order":2, "roles":["admin","owner"],           "sla_h":48,   "description":"En attente validation finance"},
      {"key":"valide_finance",  "label":"Validé Finance",     "order":3, "roles":["admin","owner"],           "sla_h":24,   "description":"En attente paiement trésorerie"},
      {"key":"paye",            "label":"Payé",               "order":4, "roles":null,                        "sla_h":null, "description":"Paiement effectué"},
      {"key":"cloture",         "label":"Clôturé",            "order":5, "roles":null,                        "sla_h":null, "description":"Dossier clôturé", "is_terminal":true},
      {"key":"rejete",          "label":"Rejeté",             "order":-1,"roles":null,                        "sla_h":null, "description":"Demande rejetée",  "is_terminal":true, "is_reject":true},
      {"key":"annule",          "label":"Annulé",             "order":-2,"roles":null,                        "sla_h":null, "description":"Demande annulée",  "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","valide_manager","valide_finance"],
    "terminal_steps": ["cloture","rejete","annule"],
    "success_step": "cloture",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": true
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- ACHAT
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'achat', 'Bon de commande / Achat',
  'Validation des achats et bons de commande',
  '#8B5CF6', 'shopping-cart',
  '{
    "steps": [
      {"key":"brouillon",          "label":"Brouillon",         "order":0, "roles":null,             "sla_h":null, "description":"Rédaction du bon de commande"},
      {"key":"soumis",             "label":"Soumis",            "order":1, "roles":["admin","owner"], "sla_h":24,   "description":"En attente validation responsable"},
      {"key":"valide_manager",     "label":"Validé Manager",    "order":2, "roles":["admin","owner"], "sla_h":48,   "description":"En attente validation DG/Finance"},
      {"key":"commande_validee",   "label":"Commande Validée",  "order":3, "roles":["admin","owner"], "sla_h":72,   "description":"En attente réception"},
      {"key":"recu",               "label":"Reçu",              "order":4, "roles":["admin","owner"], "sla_h":24,   "description":"En attente paiement fournisseur"},
      {"key":"paye",               "label":"Payé",              "order":5, "roles":null,             "sla_h":null, "description":"Fournisseur réglé"},
      {"key":"cloture",            "label":"Clôturé",           "order":6, "roles":null,             "sla_h":null, "description":"Dossier clôturé", "is_terminal":true},
      {"key":"rejete",             "label":"Rejeté",            "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",             "label":"Annulé",            "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","valide_manager","commande_validee","recu"],
    "terminal_steps": ["cloture","rejete","annule"],
    "success_step": "cloture",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": true
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- CONGÉ
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'conge', 'Demande de congé',
  'Validation des demandes de congés et absences',
  '#10B981', 'calendar',
  '{
    "steps": [
      {"key":"brouillon",      "label":"Brouillon",          "order":0, "roles":null,             "sla_h":null, "description":"Rédaction de la demande"},
      {"key":"soumis",         "label":"Soumis",             "order":1, "roles":["admin","owner"], "sla_h":24,   "description":"En attente validation manager"},
      {"key":"valide_manager", "label":"Validé Manager",     "order":2, "roles":["admin","owner"], "sla_h":48,   "description":"En attente validation RH"},
      {"key":"valide_rh",      "label":"Validé RH",          "order":3, "roles":null,             "sla_h":null, "description":"Congé approuvé"},
      {"key":"actif",          "label":"En cours",           "order":4, "roles":null,             "sla_h":null, "description":"Congé en cours"},
      {"key":"termine",        "label":"Terminé",            "order":5, "roles":null,             "sla_h":null, "description":"Congé terminé", "is_terminal":true},
      {"key":"rejete",         "label":"Rejeté",             "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",         "label":"Annulé",             "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","valide_manager"],
    "terminal_steps": ["termine","rejete","annule"],
    "success_step": "termine",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": false
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- RECRUTEMENT
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'rh_recrutement', 'Recrutement',
  'Processus complet de recrutement d''un nouveau collaborateur',
  '#2563EB', 'users',
  '{
    "steps": [
      {"key":"brouillon",      "label":"Brouillon",          "order":0, "roles":null,             "sla_h":null},
      {"key":"soumis",         "label":"Offre publiée",      "order":1, "roles":["admin","owner"], "sla_h":72},
      {"key":"selection",      "label":"Sélection CVs",      "order":2, "roles":["admin","owner"], "sla_h":168},
      {"key":"entretien",      "label":"Entretiens",         "order":3, "roles":["admin","owner"], "sla_h":168},
      {"key":"valide_rh",      "label":"Validé RH",          "order":4, "roles":["admin","owner"], "sla_h":48},
      {"key":"offre_faite",    "label":"Offre faite",        "order":5, "roles":["admin","owner"], "sla_h":72},
      {"key":"accepte",        "label":"Accepté",            "order":6, "roles":null,             "sla_h":null},
      {"key":"onboarding",     "label":"Onboarding",         "order":7, "roles":null,             "sla_h":null},
      {"key":"integre",        "label":"Intégré",            "order":8, "roles":null,             "sla_h":null, "is_terminal":true},
      {"key":"rejete",         "label":"Rejeté",             "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",         "label":"Annulé",             "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","selection","entretien","valide_rh","offre_faite"],
    "terminal_steps": ["integre","rejete","annule"],
    "success_step": "integre",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": false
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- FACTURATION
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'facturation', 'Validation facture client',
  'Circuit de validation et envoi des factures',
  '#16A34A', 'file-text',
  '{
    "steps": [
      {"key":"brouillon",    "label":"Brouillon",        "order":0, "roles":null,             "sla_h":null},
      {"key":"en_revision",  "label":"En révision",      "order":1, "roles":["admin","owner"], "sla_h":24},
      {"key":"validee",      "label":"Validée",          "order":2, "roles":["admin","owner"], "sla_h":24},
      {"key":"envoyee",      "label":"Envoyée client",   "order":3, "roles":["admin","owner"], "sla_h":720},
      {"key":"relancee",     "label":"Relancée",         "order":4, "roles":null,             "sla_h":360},
      {"key":"payee",        "label":"Payée",            "order":5, "roles":null,             "sla_h":null, "is_terminal":true},
      {"key":"annulee",      "label":"Annulée",          "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["en_revision","validee","envoyee","relancee"],
    "terminal_steps": ["payee","annulee"],
    "success_step": "payee",
    "cancel_step": "annulee",
    "finance_trigger": true
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- PAIEMENT / DÉCAISSEMENT
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'paiement', 'Demande de paiement',
  'Validation multi-niveaux des sorties de fonds',
  '#DC2626', 'credit-card',
  '{
    "steps": [
      {"key":"brouillon",    "label":"Brouillon",      "order":0, "roles":null,             "sla_h":null},
      {"key":"soumis",       "label":"Soumis",         "order":1, "roles":["admin","owner"], "sla_h":24},
      {"key":"valide_raf",   "label":"Validé RAF",     "order":2, "roles":["owner"],         "sla_h":24},
      {"key":"valide_dg",    "label":"Validé DG",      "order":3, "roles":["owner"],         "sla_h":24},
      {"key":"approuve",     "label":"Approuvé",       "order":4, "roles":["owner","admin"], "sla_h":24},
      {"key":"execute",      "label":"Exécuté",        "order":5, "roles":null,             "sla_h":null, "is_terminal":true},
      {"key":"rejete",       "label":"Rejeté",         "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",       "label":"Annulé",         "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","valide_raf","valide_dg","approuve"],
    "terminal_steps": ["execute","rejete","annule"],
    "success_step": "execute",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": true
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- STOCK / MOUVEMENT
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'stock', 'Mouvement de stock',
  'Validation des sorties et ajustements de stock',
  '#0891B2', 'package',
  '{
    "steps": [
      {"key":"brouillon",      "label":"Brouillon",         "order":0, "roles":null,             "sla_h":null},
      {"key":"soumis",         "label":"Soumis",            "order":1, "roles":["admin","owner"], "sla_h":24},
      {"key":"valide_stock",   "label":"Validé Gestionnaire","order":2, "roles":["admin","owner"], "sla_h":24},
      {"key":"execute",        "label":"Exécuté",           "order":3, "roles":null,             "sla_h":null, "is_terminal":true},
      {"key":"rejete",         "label":"Rejeté",            "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",         "label":"Annulé",            "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","valide_stock"],
    "terminal_steps": ["execute","rejete","annule"],
    "success_step": "execute",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": false
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- INSCRIPTION ÉTUDIANT
INSERT INTO workflow_definitions (tenant_id, type_key, name, description, color, icon, steps_config)
VALUES (NULL, 'inscription_etudiant', 'Inscription étudiant',
  'Processus d''inscription et validation des dossiers',
  '#7C3AED', 'graduation-cap',
  '{
    "steps": [
      {"key":"brouillon",      "label":"Dossier déposé",   "order":0, "roles":null,             "sla_h":null},
      {"key":"soumis",         "label":"Soumis",           "order":1, "roles":["admin","owner"], "sla_h":48},
      {"key":"verif_docs",     "label":"Docs vérifiés",    "order":2, "roles":["admin","owner"], "sla_h":24},
      {"key":"valide_daac",    "label":"Validé DAAC",      "order":3, "roles":["admin","owner"], "sla_h":24},
      {"key":"paiement_ok",    "label":"Paiement confirmé","order":4, "roles":null,             "sla_h":null},
      {"key":"inscrit",        "label":"Inscrit",          "order":5, "roles":null,             "sla_h":null, "is_terminal":true},
      {"key":"rejete",         "label":"Dossier rejeté",   "order":-1,"roles":null,             "sla_h":null, "is_terminal":true, "is_reject":true},
      {"key":"annule",         "label":"Annulé",           "order":-2,"roles":null,             "sla_h":null, "is_terminal":true, "is_cancel":true}
    ],
    "active_steps": ["soumis","verif_docs","valide_daac","paiement_ok"],
    "terminal_steps": ["inscrit","rejete","annule"],
    "success_step": "inscrit",
    "reject_step": "rejete",
    "cancel_step": "annule",
    "finance_trigger": true
  }'
)
ON CONFLICT (tenant_id, type_key) DO NOTHING;

-- ── 8. Fonction : créer une instance de workflow ──────────────────────────────

CREATE OR REPLACE FUNCTION fn_wf_create(
  p_tenant_id     UUID,
  p_type_key      TEXT,
  p_title         TEXT,
  p_description   TEXT DEFAULT NULL,
  p_montant       NUMERIC DEFAULT NULL,
  p_source_table  TEXT DEFAULT NULL,
  p_source_id     UUID DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}',
  p_priority      TEXT DEFAULT 'normale'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_def      workflow_definitions;
  v_steps    JSONB;
  v_step0    JSONB;
  v_step1    JSONB;
  v_roles    TEXT[];
  v_prof_id  UUID;
  v_email    TEXT;
  v_inst_id  UUID;
  v_sla_h    INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Trouver la définition (tenant-spécifique d'abord, puis globale)
  SELECT * INTO v_def
  FROM workflow_definitions
  WHERE type_key = p_type_key AND is_active = true
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow type not found: %', p_type_key;
  END IF;

  v_steps := v_def.steps_config->'steps';

  -- Étape 0 = brouillon, étape 1 = première active
  SELECT elem INTO v_step1
  FROM jsonb_array_elements(v_steps) AS elem
  WHERE (elem->>'order')::INT = 1
  LIMIT 1;

  v_roles := CASE WHEN v_step1 IS NOT NULL AND v_step1->'roles' != 'null'::jsonb
    THEN ARRAY(SELECT jsonb_array_elements_text(v_step1->'roles'))
    ELSE ARRAY[]::TEXT[]
  END;

  -- Profil de l'initiateur
  SELECT id, email INTO v_prof_id, v_email
  FROM profiles JOIN auth.users ON auth.users.id = profiles.user_id
  WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = p_tenant_id
  ORDER BY profiles.created_at ASC
  LIMIT 1;

  -- SLA
  v_sla_h := CASE WHEN v_step1 IS NOT NULL THEN (v_step1->>'sla_h')::INT ELSE NULL END;

  -- Créer l'instance
  INSERT INTO workflow_instances (
    tenant_id, definition_type_key, source_table, source_id,
    title, description, montant, current_step, statut,
    current_step_roles, initiator_profile_id, initiator_email,
    metadata, priority, due_at, step_order, total_steps
  ) VALUES (
    p_tenant_id, p_type_key, p_source_table, p_source_id,
    p_title, p_description, p_montant, 'brouillon', 'actif',
    '{}', v_prof_id, v_email,
    p_metadata, p_priority,
    CASE WHEN v_sla_h IS NOT NULL THEN NOW() + (v_sla_h || ' hours')::INTERVAL ELSE NULL END,
    0, jsonb_array_length(v_steps)
  ) RETURNING id INTO v_inst_id;

  -- Transition initiale
  INSERT INTO workflow_transitions (instance_id, tenant_id, from_step, to_step, action, actor_profile_id, actor_email, actor_role)
  VALUES (v_inst_id, p_tenant_id, '', 'brouillon', 'create', v_prof_id, v_email, get_my_role());

  RETURN v_inst_id;
END;
$$;

-- ── 9. Fonction : transition workflow (soumettre / approuver / rejeter) ────────

CREATE OR REPLACE FUNCTION fn_wf_transition(
  p_instance_id UUID,
  p_action      TEXT,   -- 'submit' | 'approve' | 'reject' | 'cancel'
  p_comment     TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst       workflow_instances;
  v_def        workflow_definitions;
  v_steps      JSONB;
  v_cur_step   JSONB;
  v_next_step  JSONB;
  v_new_step   TEXT;
  v_new_status TEXT;
  v_new_roles  TEXT[];
  v_new_order  INT;
  v_sla_h      INT;
  v_prof_id    UUID;
  v_email      TEXT;
  v_role       TEXT;
  v_cur_order  INT;
BEGIN
  -- Récupérer l'instance
  SELECT * INTO v_inst FROM workflow_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instance not found'; END IF;

  -- Vérifier accès tenant
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = v_inst.tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Acteur
  SELECT id, email INTO v_prof_id, v_email
  FROM profiles JOIN auth.users ON auth.users.id = profiles.user_id
  WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = v_inst.tenant_id
  ORDER BY profiles.created_at ASC LIMIT 1;

  v_role := get_my_role();

  -- Vérifier que l'instance est active
  IF v_inst.statut != 'actif' THEN
    RAISE EXCEPTION 'Instance is not active (statut: %)', v_inst.statut;
  END IF;

  -- Définition du workflow
  SELECT * INTO v_def
  FROM workflow_definitions
  WHERE type_key = v_inst.definition_type_key AND is_active = true
    AND (tenant_id = v_inst.tenant_id OR tenant_id IS NULL)
  ORDER BY tenant_id NULLS LAST LIMIT 1;

  v_steps := v_def.steps_config->'steps';

  -- Étape courante
  SELECT elem INTO v_cur_step
  FROM jsonb_array_elements(v_steps) AS elem
  WHERE elem->>'key' = v_inst.current_step;

  v_cur_order := COALESCE((v_cur_step->>'order')::INT, 0);

  -- Calculer prochaine étape
  IF p_action = 'reject' THEN
    v_new_step   := v_def.steps_config->>'reject_step';
    v_new_status := 'rejete';
    v_new_roles  := '{}';
    v_new_order  := v_cur_order;

  ELSIF p_action = 'cancel' THEN
    v_new_step   := v_def.steps_config->>'cancel_step';
    v_new_status := 'annule';
    v_new_roles  := '{}';
    v_new_order  := v_cur_order;

  ELSIF p_action IN ('submit', 'approve') THEN
    -- Trouver l'étape suivante (order + 1)
    SELECT elem INTO v_next_step
    FROM jsonb_array_elements(v_steps) AS elem
    WHERE (elem->>'order')::INT = v_cur_order + 1
    LIMIT 1;

    IF NOT FOUND THEN
      -- Pas d'étape suivante → clôturer
      v_new_step   := v_def.steps_config->>'success_step';
      v_new_status := 'approuve';
      v_new_roles  := '{}';
      v_new_order  := v_cur_order + 1;
    ELSE
      v_new_step  := v_next_step->>'key';
      v_new_order := (v_next_step->>'order')::INT;
      v_new_roles := CASE
        WHEN v_next_step->'roles' IS NOT NULL AND v_next_step->'roles' != 'null'::jsonb
        THEN ARRAY(SELECT jsonb_array_elements_text(v_next_step->'roles'))
        ELSE '{}'::TEXT[]
      END;
      -- Terminal?
      IF COALESCE((v_next_step->>'is_terminal')::BOOLEAN, false) THEN
        v_new_status := 'approuve';
      ELSE
        v_new_status := 'actif';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- SLA pour nouvelle étape
  v_sla_h := (v_next_step->>'sla_h')::INT;

  -- Mettre à jour l'instance
  UPDATE workflow_instances SET
    current_step       = v_new_step,
    statut             = v_new_status,
    current_step_roles = v_new_roles,
    step_order         = v_new_order,
    due_at             = CASE WHEN v_sla_h IS NOT NULL THEN NOW() + (v_sla_h || ' hours')::INTERVAL ELSE NULL END,
    completed_at       = CASE WHEN v_new_status != 'actif' THEN NOW() ELSE NULL END,
    rejected_reason    = CASE WHEN p_action = 'reject' THEN p_comment ELSE rejected_reason END,
    updated_at         = NOW()
  WHERE id = p_instance_id;

  -- Enregistrer la transition
  INSERT INTO workflow_transitions (instance_id, tenant_id, from_step, to_step, action, actor_profile_id, actor_email, actor_role, comment)
  VALUES (p_instance_id, v_inst.tenant_id, v_inst.current_step, v_new_step, p_action, v_prof_id, v_email, v_role, p_comment);

  -- Notifications
  -- 1. Notifier les approbateurs suivants
  IF v_new_roles != '{}' AND v_new_status = 'actif' THEN
    INSERT INTO workflow_notifications (tenant_id, instance_id, recipient_profile_id, recipient_email, type, title, body)
    SELECT
      v_inst.tenant_id, p_instance_id, p.id, au.email,
      'action_required',
      'Approbation requise : ' || v_inst.title,
      'Une demande "' || v_inst.definition_type_key || '" attend votre validation.'
    FROM profiles p
    JOIN auth.users au ON au.id = p.user_id
    WHERE p.tenant_id = v_inst.tenant_id
      AND (p.role = ANY(v_new_roles) OR p.role IN ('owner'))
      AND p.id != v_prof_id;
  END IF;

  -- 2. Notifier l'initiateur
  IF p_action IN ('approve','reject','cancel') THEN
    INSERT INTO workflow_notifications (tenant_id, instance_id, recipient_profile_id, type, title, body)
    VALUES (
      v_inst.tenant_id, p_instance_id, v_inst.initiator_profile_id,
      CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'cancelled' END,
      CASE p_action
        WHEN 'approve' THEN 'Approuvé : ' || v_inst.title
        WHEN 'reject'  THEN 'Rejeté : '   || v_inst.title
        ELSE 'Annulé : ' || v_inst.title
      END,
      CASE p_action
        WHEN 'approve' THEN 'Votre demande a été approuvée (étape : ' || v_new_step || ').'
        WHEN 'reject'  THEN 'Votre demande a été rejetée. Motif : ' || COALESCE(p_comment, '—')
        ELSE 'Votre demande a été annulée.'
      END
    );
  END IF;

  -- Trigger finance si workflow approuvé et type financier
  IF v_new_status = 'approuve' AND COALESCE((v_def.steps_config->>'finance_trigger')::BOOLEAN, false)
     AND v_inst.montant > 0 THEN
    -- Auto-créer transaction si source_table = 'depenses' et source_id renseigné
    -- (Le trigger existant fn_depense_to_transaction sera appelé par l'app)
    PERFORM 1; -- placeholder pour extension future
  END IF;

  RETURN json_build_object(
    'success', true,
    'instance_id', p_instance_id,
    'new_step', v_new_step,
    'new_status', v_new_status,
    'action', p_action
  );
END;
$$;

-- ── 10. Fonction : ajouter un commentaire ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_wf_comment(
  p_instance_id UUID,
  p_content     TEXT,
  p_internal    BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst    workflow_instances;
  v_prof_id UUID;
  v_email   TEXT;
  v_comm_id UUID;
BEGIN
  SELECT * INTO v_inst FROM workflow_instances WHERE id = p_instance_id;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND tenant_id = v_inst.tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id, email INTO v_prof_id, v_email
  FROM profiles JOIN auth.users ON auth.users.id = profiles.user_id
  WHERE profiles.user_id = auth.uid() AND profiles.tenant_id = v_inst.tenant_id
  ORDER BY profiles.created_at LIMIT 1;

  INSERT INTO workflow_comments (instance_id, tenant_id, author_profile_id, author_email, content, is_internal)
  VALUES (p_instance_id, v_inst.tenant_id, v_prof_id, v_email, p_content, p_internal)
  RETURNING id INTO v_comm_id;

  -- Enregistrer dans transitions comme action 'comment'
  INSERT INTO workflow_transitions (instance_id, tenant_id, from_step, to_step, action, actor_profile_id, actor_email, comment)
  VALUES (p_instance_id, v_inst.tenant_id, v_inst.current_step, v_inst.current_step, 'comment', v_prof_id, v_email, p_content);

  RETURN v_comm_id;
END;
$$;

-- ── 11. Vue : inbox des approbations en attente ───────────────────────────────

CREATE OR REPLACE VIEW v_workflow_inbox AS
SELECT
  wi.id,
  wi.tenant_id,
  wi.definition_type_key,
  wi.title,
  wi.description,
  wi.montant,
  wi.current_step,
  wi.statut,
  wi.priority,
  wi.initiator_email,
  wi.created_at,
  wi.due_at,
  wi.step_order,
  wi.total_steps,
  wi.metadata,
  -- SLA dépassé?
  CASE WHEN wi.due_at IS NOT NULL AND wi.due_at < NOW() AND wi.statut = 'actif' THEN true ELSE false END AS is_overdue,
  -- Heures restantes
  CASE WHEN wi.due_at IS NOT NULL THEN EXTRACT(EPOCH FROM (wi.due_at - NOW()))/3600 ELSE NULL END AS hours_remaining
FROM workflow_instances wi
WHERE wi.statut = 'actif';

COMMENT ON VIEW v_workflow_inbox IS
  'Vue des workflows actifs. Filtrer par current_step_roles pour obtenir l''inbox d''un utilisateur.';

-- ── 12. Trigger : updated_at automatique ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_wf_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wf_inst_updated_at ON workflow_instances;
CREATE TRIGGER trg_wf_inst_updated_at
  BEFORE UPDATE ON workflow_instances
  FOR EACH ROW EXECUTE FUNCTION fn_update_wf_updated_at();

-- ── 13. Grants aux fonctions ──────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION fn_wf_create       TO authenticated;
GRANT EXECUTE ON FUNCTION fn_wf_transition   TO authenticated;
GRANT EXECUTE ON FUNCTION fn_wf_comment      TO authenticated;

-- ── FIN Migration 055 ─────────────────────────────────────────────────────────
-- Tables : workflow_definitions, workflow_instances, workflow_transitions,
--          workflow_comments, workflow_notifications
-- Fonctions : fn_wf_create, fn_wf_transition, fn_wf_comment
-- Vue : v_workflow_inbox
-- 8 types configurés : depense, achat, conge, rh_recrutement, facturation,
--                      paiement, stock, inscription_etudiant
