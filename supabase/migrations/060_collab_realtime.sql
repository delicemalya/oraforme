-- =============================================================================
-- Migration 060 : ERP Collaboratif — Événements, Tâches, Email Queue, SMS Queue
-- Auteur       : Oraforme ERP
-- Date         : 2026-05-29
-- Description  : Calendrier global, tâches collaboratives, file email/SMS,
--                enrichissement notifications (priorité, catégorie).
-- Idempotente  : IF NOT EXISTS / OR REPLACE / DO $$ EXCEPTION $$
-- =============================================================================


-- =============================================================================
-- SECTION 1 — ENRICHIR TABLE notifications
-- =============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normale'
    CHECK (priority IN ('basse','normale','haute','urgente')),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS action_href  TEXT;

CREATE INDEX IF NOT EXISTS idx_notif_priority
  ON notifications(tenant_id, priority)
  WHERE read = false;


-- =============================================================================
-- SECTION 2 — TABLE events (calendrier global)
-- =============================================================================

CREATE TABLE IF NOT EXISTS events (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT          NOT NULL,
  description   TEXT,
  type          TEXT          NOT NULL DEFAULT 'event'
                              CHECK (type IN (
                                'event','reunion','deadline','examen',
                                'paiement','conge','tache','rappel','formation'
                              )),
  statut        TEXT          NOT NULL DEFAULT 'planifie'
                              CHECK (statut IN ('planifie','confirme','annule','termine')),
  start_date    TIMESTAMPTZ   NOT NULL,
  end_date      TIMESTAMPTZ,
  all_day       BOOLEAN       NOT NULL DEFAULT false,
  location      TEXT,
  color         TEXT          DEFAULT '#DC2626',
  created_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to   UUID[]        NOT NULL DEFAULT '{}',
  recurrence    TEXT,
  source_module TEXT,
  source_id     UUID,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "events_select" ON events
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "events_insert" ON events
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "events_update" ON events
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
               WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "events_delete" ON events
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_events_tenant     ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(tenant_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_type       ON events(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_events_assigned   ON events USING gin(assigned_to);

CREATE OR REPLACE FUNCTION fn_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION fn_events_updated_at();

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- =============================================================================
-- SECTION 3 — TABLE tasks (tâches collaboratives)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT          NOT NULL,
  description   TEXT,
  statut        TEXT          NOT NULL DEFAULT 'todo'
                              CHECK (statut IN ('todo','en_cours','en_attente','termine','annule')),
  priorite      TEXT          NOT NULL DEFAULT 'normale'
                              CHECK (priorite IN ('basse','normale','haute','urgente')),
  due_date      DATE,
  assigned_to   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  tags          TEXT[]        NOT NULL DEFAULT '{}',
  source_module TEXT,
  source_id     UUID,
  ordre         INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tasks_select" ON tasks
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_insert" ON tasks
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_update" ON tasks
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
               WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_delete" ON tasks
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_tenant   ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_statut   ON tasks(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date) WHERE statut NOT IN ('termine','annule');

CREATE OR REPLACE FUNCTION fn_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_tasks_updated_at();

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- =============================================================================
-- SECTION 4 — TABLE task_comments
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id     UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  TEXT,
  content     TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "task_comments_select" ON task_comments
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_comments_insert" ON task_comments
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_comments_delete" ON task_comments
    FOR DELETE USING (tenant_id = get_my_tenant_id() AND user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_task_comments_task   ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_tenant ON task_comments(tenant_id);


-- =============================================================================
-- SECTION 5 — TABLE email_queue (file d'envoi asynchrone)
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_email    TEXT          NOT NULL,
  to_name     TEXT,
  subject     TEXT          NOT NULL,
  html_body   TEXT          NOT NULL,
  template    TEXT,
  params      JSONB         NOT NULL DEFAULT '{}',
  statut      TEXT          NOT NULL DEFAULT 'pending'
                            CHECK (statut IN ('pending','sent','failed','cancelled')),
  attempts    INTEGER       NOT NULL DEFAULT 0,
  max_attempts INTEGER      NOT NULL DEFAULT 3,
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "email_queue_select" ON email_queue
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "email_queue_insert" ON email_queue
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(statut, created_at)
  WHERE statut = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_tenant  ON email_queue(tenant_id);


-- =============================================================================
-- SECTION 6 — TABLE sms_queue (Twilio / WhatsApp Business ready)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sms_queue (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_phone    TEXT          NOT NULL,
  to_name     TEXT,
  message     TEXT          NOT NULL,
  provider    TEXT          NOT NULL DEFAULT 'twilio'
                            CHECK (provider IN ('twilio','vonage','orange','airtel')),
  channel     TEXT          NOT NULL DEFAULT 'sms'
                            CHECK (channel IN ('sms','whatsapp')),
  statut      TEXT          NOT NULL DEFAULT 'pending'
                            CHECK (statut IN ('pending','sent','failed','cancelled')),
  attempts    INTEGER       NOT NULL DEFAULT 0,
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  params      JSONB         NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sms_queue_select" ON sms_queue
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sms_queue_insert" ON sms_queue
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_sms_queue_pending ON sms_queue(statut, created_at)
  WHERE statut = 'pending';
CREATE INDEX IF NOT EXISTS idx_sms_queue_tenant  ON sms_queue(tenant_id);


-- =============================================================================
-- SECTION 7 — TRIGGER : notification automatique à l'assignation d'une tâche
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notifier le nouveau assigné seulement si différent du créateur
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    -- INSERT (nouvelle tâche assignée)
    IF TG_OP = 'INSERT' THEN
      PERFORM fn_notify(
        NEW.assigned_to,
        NEW.tenant_id,
        'Nouvelle tâche assignée',
        NEW.title,
        'info',
        '/dashboard/taches',
        'tasks',
        NEW.id
      );
    -- UPDATE : assigné a changé
    ELSIF TG_OP = 'UPDATE' AND
          (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND
          NEW.assigned_to IS NOT NULL
    THEN
      PERFORM fn_notify(
        NEW.assigned_to,
        NEW.tenant_id,
        'Tâche assignée',
        NEW.title,
        'info',
        '/dashboard/taches',
        'tasks',
        NEW.id
      );
    -- UPDATE : statut terminé → notifier le créateur
    ELSIF TG_OP = 'UPDATE' AND
          NEW.statut = 'termine' AND OLD.statut <> 'termine' AND
          NEW.created_by IS NOT NULL
    THEN
      PERFORM fn_notify(
        NEW.created_by,
        NEW.tenant_id,
        'Tâche terminée ✓',
        NEW.title,
        'success',
        '/dashboard/taches',
        'tasks',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task ON tasks;
CREATE TRIGGER trg_notify_task
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_notify_task_assigned();


-- =============================================================================
-- SECTION 8 — TRIGGER : notification d'échéance proche (tâches dues dans 24h)
--   Ce trigger est appelé lors d'une mise à jour ou inspection externe.
--   Pour un vrai rappel automatique, utilisez pg_cron ou Edge Function.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_notify_event_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notifier le créateur 24h avant le début
  IF NEW.created_by IS NOT NULL AND
     TG_OP = 'INSERT' AND
     NEW.start_date IS NOT NULL AND
     NEW.start_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
  THEN
    PERFORM fn_notify(
      NEW.created_by,
      NEW.tenant_id,
      'Rappel événement',
      NEW.title || ' — dans 24h',
      'warning',
      '/dashboard/calendrier',
      'events',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event ON events;
CREATE TRIGGER trg_notify_event
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION fn_notify_event_reminder();


-- =============================================================================
-- SECTION 9 — VUES utiles
-- =============================================================================

-- Vue: tâches avec compte de commentaires
CREATE OR REPLACE VIEW v_tasks_with_counts AS
SELECT
  t.*,
  COALESCE(c.comment_count, 0) AS comment_count
FROM tasks t
LEFT JOIN (
  SELECT task_id, COUNT(*) AS comment_count
  FROM task_comments
  GROUP BY task_id
) c ON c.task_id = t.id;

-- Vue: événements du mois courant
CREATE OR REPLACE VIEW v_events_this_month AS
SELECT *
FROM events
WHERE date_trunc('month', start_date) = date_trunc('month', NOW())
  AND statut <> 'annule';


-- =============================================================================
-- FIN DE LA MIGRATION 060
-- =============================================================================
-- Pour exécuter : Supabase SQL Editor → Coller → Run
-- =============================================================================
