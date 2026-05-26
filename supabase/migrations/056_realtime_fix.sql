-- ============================================================
-- Migration 056 — Fix WebSocket Realtime + Notifications
-- "socket connection was closed unexpectedly" → résolu
-- ============================================================
-- Problème : La table notifications n'était pas dans la
-- publication Supabase Realtime → WebSocket échouait avec 500
-- Solution :
--   1. Activer Realtime sur la table notifications
--   2. Vérifier/créer la table si elle n'existe pas
--   3. Ajouter workflow_notifications aussi
-- ============================================================

-- ── 1. Créer la table notifications si absente ──────────────
-- NOTE: La table existe déjà depuis CATCHUP_008_to_025 sans source/source_id
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  message    TEXT,
  type       TEXT        NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','success','error')),
  read       BOOLEAN     NOT NULL DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter les colonnes manquantes sur la table existante
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS source    TEXT,    -- 'workflow', 'finance', 'rh', 'ecole', etc.
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- ── 2. Activer RLS ──────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Chaque user voit seulement ses propres notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (
    user_id = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = get_my_tenant_id())
  );

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role peut insérer des notifications pour n'importe qui
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);  -- contrôlé par service_role au niveau app

-- ── 3. Activer Supabase Realtime sur notifications ──────────
-- Cela ajoute la table à la publication supabase_realtime
-- pour que les WebSocket postgres_changes fonctionnent
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── 4. Activer Realtime sur workflow_notifications aussi ─────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflow_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workflow_notifications;
  END IF;
END $$;

-- ── 5. Index pour les requêtes fréquentes ───────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant
  ON notifications (tenant_id, created_at DESC);

-- ── 6. Fonction helper pour créer une notification ──────────
CREATE OR REPLACE FUNCTION fn_notify(
  p_user_id  UUID,
  p_title    TEXT,
  p_message  TEXT    DEFAULT NULL,
  p_type     TEXT    DEFAULT 'info',
  p_link     TEXT    DEFAULT NULL,
  p_source   TEXT    DEFAULT NULL,
  p_source_id UUID   DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_notif_id  UUID;
BEGIN
  -- Récupérer le tenant_id de l'utilisateur cible
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO notifications (user_id, tenant_id, title, message, type, link, source, source_id)
  VALUES (p_user_id, v_tenant_id, p_title, p_message, p_type, p_link, p_source, p_source_id)
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- ── 7. Trigger : notifier lors d'une transition workflow ─────
CREATE OR REPLACE FUNCTION trg_wf_notify_on_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
  v_title    TEXT;
  v_type     TEXT;
  v_link     TEXT;
BEGIN
  -- Charger l'instance workflow
  SELECT * INTO v_instance
  FROM workflow_instances
  WHERE id = NEW.instance_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_link := '/dashboard/workflows/' || v_instance.id;

  -- Construire le message selon l'action
  CASE NEW.action
    WHEN 'approve' THEN
      v_title := '✅ Approuvé : ' || v_instance.title;
      v_type  := 'success';
    WHEN 'reject' THEN
      v_title := '❌ Refusé : ' || v_instance.title;
      v_type  := 'error';
    WHEN 'submit' THEN
      v_title := '📋 Soumis pour validation : ' || v_instance.title;
      v_type  := 'info';
    WHEN 'cancel' THEN
      v_title := '🚫 Annulé : ' || v_instance.title;
      v_type  := 'warning';
    ELSE
      v_title := '🔄 Mise à jour : ' || v_instance.title;
      v_type  := 'info';
  END CASE;

  -- Notifier l'initiateur du workflow
  IF v_instance.initiator_profile_id IS NOT NULL THEN
    DECLARE v_uid UUID;
    BEGIN
      SELECT user_id INTO v_uid FROM profiles WHERE id = v_instance.initiator_profile_id;
      IF FOUND AND v_uid IS NOT NULL AND v_uid != NEW.actor_user_id THEN
        PERFORM fn_notify(v_uid, v_title, NEW.comment, v_type, v_link, 'workflow', v_instance.id);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Attacher le trigger (seulement si la table workflow_transitions existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflow_transitions'
  ) THEN
    DROP TRIGGER IF EXISTS trg_wf_notify ON workflow_transitions;
    CREATE TRIGGER trg_wf_notify
      AFTER INSERT ON workflow_transitions
      FOR EACH ROW EXECUTE FUNCTION trg_wf_notify_on_transition();
  END IF;
END $$;

-- ── 8. Vue pratique pour l'inbox notifications ───────────────
CREATE OR REPLACE VIEW v_my_notifications AS
SELECT
  n.id,
  n.title,
  n.message,
  n.type,
  n.read,
  n.link,
  n.source,
  n.source_id,
  n.created_at
FROM notifications n
WHERE n.user_id = auth.uid()
ORDER BY n.created_at DESC;

COMMENT ON MIGRATION IS '056 — Fix WebSocket Realtime: active la publication supabase_realtime sur notifications + fn_notify helper + trigger workflow';
