-- ============================================================
-- 032 — Moteur d'automatisation ERP
--       Règles, tâches planifiées, notifications automatiques
-- ============================================================

-- ── 1. Table règles d'automatisation ────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,   -- 'absence','stock_min','contrat_expire','impaye','bulletin_publie','salaire_valide'
  active      BOOLEAN     NOT NULL DEFAULT true,
  delay_hours INT         NOT NULL DEFAULT 0,   -- délai avant déclenchement
  config      JSONB       NOT NULL DEFAULT '{}',-- paramètres spécifiques
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules: all" ON automation_rules;
CREATE POLICY "automation_rules: all" ON automation_rules
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules (tenant_id, event_type);

-- ── 2. Table tâches planifiées ────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_type     TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at   TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'error')),
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_tasks: all" ON scheduled_tasks;
CREATE POLICY "scheduled_tasks: all" ON scheduled_tasks
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks (tenant_id, status, scheduled_at);

-- ── 3. Fonction utilitaire : créer une notification ──────────

CREATE OR REPLACE FUNCTION fn_notify(
  p_tenant_id  UUID,
  p_user_id    UUID,
  p_title      TEXT,
  p_message    TEXT,
  p_type       TEXT    DEFAULT 'info',
  p_link       TEXT    DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (tenant_id, user_id, title, message, type, link)
  VALUES (p_tenant_id, p_user_id, p_title, p_message, p_type, p_link);
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais faire rater la transaction parente pour une notification
  NULL;
END;
$$;

-- Broadcast (tous les membres du tenant)
CREATE OR REPLACE FUNCTION fn_notify_broadcast(
  p_tenant_id UUID,
  p_title     TEXT,
  p_message   TEXT,
  p_type      TEXT DEFAULT 'info',
  p_link      TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (tenant_id, user_id, title, message, type, link)
  VALUES (p_tenant_id, NULL, p_title, p_message, p_type, p_link);
END;
$$;

-- ── 4. Trigger : Absence → notifier parents ──────────────────

CREATE OR REPLACE FUNCTION fn_absence_to_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nom_etudiant TEXT;
  v_parent       RECORD;
BEGIN
  SELECT COALESCE(nom || ' ' || prenom, 'un étudiant') INTO v_nom_etudiant
    FROM etudiants WHERE id = NEW.etudiant_id LIMIT 1;

  -- Notifier les parents via parent_links
  FOR v_parent IN
    SELECT parent_user_id FROM parent_links WHERE etudiant_id = NEW.etudiant_id
  LOOP
    PERFORM fn_notify(
      NEW.tenant_id,
      v_parent.parent_user_id,
      'Absence signalée',
      'Votre enfant ' || v_nom_etudiant || ' a été absent(e) le ' || TO_CHAR(COALESCE(NEW.date_absence, NOW()::date), 'DD/MM/YYYY') || '.',
      'warning',
      '/dashboard/ecole/espace-parent'
    );
  END LOOP;

  -- Planifier une tâche de rappel si non justifiée après 48h
  INSERT INTO scheduled_tasks (tenant_id, task_type, payload, scheduled_at)
  VALUES (
    NEW.tenant_id,
    'absence_reminder',
    jsonb_build_object('absence_id', NEW.id, 'etudiant_id', NEW.etudiant_id, 'etudiant_nom', v_nom_etudiant),
    NOW() + INTERVAL '48 hours'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_absence_notify ON absences_etudiants;
CREATE TRIGGER trg_absence_notify
  AFTER INSERT ON absences_etudiants
  FOR EACH ROW EXECUTE FUNCTION fn_absence_to_notification();

-- ── 5. Trigger : Bulletin publié → notifier étudiant ────────

CREATE OR REPLACE FUNCTION fn_bulletin_to_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_student_user_id UUID;
  v_nom_etudiant    TEXT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'publie') AND NEW.statut = 'publie' THEN
    SELECT p.user_id, COALESCE(e.prenom || ' ' || e.nom, 'Étudiant')
      INTO v_student_user_id, v_nom_etudiant
      FROM etudiants e
      LEFT JOIN profiles p ON p.tenant_id = NEW.tenant_id
        AND p.ecole_role_name = 'ETUDIANT'
        -- Lier via numero_etudiant si disponible, sinon broadcast
        LIMIT 1;

    IF v_student_user_id IS NOT NULL THEN
      PERFORM fn_notify(
        NEW.tenant_id,
        v_student_user_id,
        'Bulletin disponible',
        'Votre bulletin de notes est maintenant disponible. Consultez vos résultats.',
        'success',
        '/dashboard/ecole/espace-etudiant'
      );
    END IF;

    -- Notifier aussi les admin/direction
    PERFORM fn_notify_broadcast(
      NEW.tenant_id,
      'Bulletin publié',
      'Un nouveau bulletin a été publié pour la session en cours.',
      'info',
      '/dashboard/ecole/daac'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Note: Appliquer si table bulletins_notes existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bulletins_notes') THEN
    DROP TRIGGER IF EXISTS trg_bulletin_notify ON bulletins_notes;
    CREATE TRIGGER trg_bulletin_notify
      AFTER UPDATE ON bulletins_notes
      FOR EACH ROW EXECUTE FUNCTION fn_bulletin_to_notification();
  END IF;
END $$;

-- ── 6. Trigger : Fiche de paie validée → notifier employé ───

CREATE OR REPLACE FUNCTION fn_paie_to_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employe_user_id UUID;
  v_employe_nom     TEXT;
  v_periode         TEXT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN
    SELECT p.user_id, COALESCE(e.nom, 'Employé')
      INTO v_employe_user_id, v_employe_nom
      FROM employes e
      LEFT JOIN profiles p ON p.tenant_id = e.tenant_id AND p.user_id IS NOT NULL
      WHERE e.id = NEW.employe_id
      LIMIT 1;

    v_periode := COALESCE(TO_CHAR(NEW.periode_mois::date, 'MMMM YYYY'), 'ce mois');

    IF v_employe_user_id IS NOT NULL THEN
      PERFORM fn_notify(
        NEW.tenant_id,
        v_employe_user_id,
        'Fiche de paie disponible',
        'Votre bulletin de salaire pour ' || v_periode || ' est disponible. Net : ' || COALESCE(NEW.salaire_net::text, '0') || ' FCFA.',
        'success',
        '/dashboard/rh'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paie_notify ON fiches_paie;
CREATE TRIGGER trg_paie_notify
  AFTER UPDATE ON fiches_paie
  FOR EACH ROW EXECUTE FUNCTION fn_paie_to_notification();

-- ── 7. Trigger : Paiement scolaire → notifier étudiant ──────

CREATE OR REPLACE FUNCTION fn_paiement_scolaire_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_etudiant_nom TEXT;
BEGIN
  SELECT COALESCE(prenom || ' ' || nom, 'Étudiant') INTO v_etudiant_nom
    FROM etudiants WHERE id = NEW.etudiant_id LIMIT 1;

  -- Broadcast direction
  PERFORM fn_notify_broadcast(
    NEW.tenant_id,
    'Paiement reçu',
    'Paiement de ' || NEW.montant::text || ' FCFA reçu de ' || v_etudiant_nom || '.',
    'success',
    '/dashboard/ecole/scolarite'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiement_notify ON paiements_scolaires;
CREATE TRIGGER trg_paiement_notify
  AFTER INSERT ON paiements_scolaires
  FOR EACH ROW EXECUTE FUNCTION fn_paiement_scolaire_notify();

-- ── 8. Trigger : Stock faible → alerte admin ─────────────────

CREATE OR REPLACE FUNCTION fn_stock_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Déclencher si quantité passe sous le seuil minimum
  IF NEW.quantite < COALESCE(NEW.quantite_min, 5) AND
     COALESCE(OLD.quantite, 999) >= COALESCE(NEW.quantite_min, 5) THEN
    PERFORM fn_notify_broadcast(
      NEW.tenant_id,
      'Stock critique',
      'Article "' || NEW.nom || '" : stock faible (' || NEW.quantite || ' restants). Réapprovisionnement recommandé.',
      'error',
      '/dashboard/stock'
    );

    INSERT INTO scheduled_tasks (tenant_id, task_type, payload, scheduled_at)
    VALUES (
      NEW.tenant_id,
      'stock_reorder',
      jsonb_build_object('article_id', NEW.id, 'nom', NEW.nom, 'quantite', NEW.quantite),
      NOW() + INTERVAL '2 hours'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_alert ON stock_articles;
CREATE TRIGGER trg_stock_alert
  AFTER UPDATE ON stock_articles
  FOR EACH ROW EXECUTE FUNCTION fn_stock_alert();

-- ── 9. Fonction : vérifier contrats expirant dans 30 jours ──

CREATE OR REPLACE FUNCTION fn_check_expiring_contracts(p_tenant_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT := 0;
  v_contrat RECORD;
BEGIN
  FOR v_contrat IN
    SELECT c.id, c.type_contrat, e.nom, e.prenom, c.date_fin
    FROM contrats_employes c
    JOIN employes e ON e.id = c.employe_id AND e.tenant_id = p_tenant_id
    WHERE c.tenant_id = p_tenant_id
      AND c.statut = 'actif'
      AND c.date_fin BETWEEN NOW()::date AND NOW()::date + INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_tasks
        WHERE tenant_id = p_tenant_id
          AND task_type = 'contract_expiry_alert'
          AND payload->>'contrat_id' = c.id::text
          AND status IN ('pending', 'done')
      )
  LOOP
    PERFORM fn_notify_broadcast(
      p_tenant_id,
      'Contrat expirant',
      'Le contrat de ' || v_contrat.prenom || ' ' || v_contrat.nom ||
        ' (' || v_contrat.type_contrat || ') expire le ' ||
        TO_CHAR(v_contrat.date_fin, 'DD/MM/YYYY') || '.',
      'warning',
      '/dashboard/rh'
    );

    INSERT INTO scheduled_tasks (tenant_id, task_type, payload, status, executed_at)
    VALUES (
      p_tenant_id, 'contract_expiry_alert',
      jsonb_build_object('contrat_id', v_contrat.id),
      'done', NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 10. Fonction : vérifier factures impayées > 30 jours ────

CREATE OR REPLACE FUNCTION fn_check_overdue_invoices(p_tenant_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT := 0;
  v_facture RECORD;
BEGIN
  FOR v_facture IN
    SELECT id, invoice_number, client_nom, total, due_date
    FROM factures
    WHERE tenant_id = p_tenant_id
      AND statut IN ('envoyee', 'brouillon')
      AND due_date IS NOT NULL
      AND due_date < NOW()::date - INTERVAL '0 days'
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_tasks
        WHERE tenant_id = p_tenant_id
          AND task_type = 'invoice_overdue_alert'
          AND payload->>'facture_id' = id::text
          AND status = 'done'
          AND executed_at > NOW() - INTERVAL '3 days'
      )
    LIMIT 20
  LOOP
    PERFORM fn_notify_broadcast(
      p_tenant_id,
      'Facture en retard',
      'Facture #' || v_facture.invoice_number || ' — ' || v_facture.client_nom ||
        ' est en retard. Montant : ' || COALESCE(v_facture.total::text, '0') || ' FCFA.',
      'error',
      '/dashboard/facturation'
    );

    INSERT INTO scheduled_tasks (tenant_id, task_type, payload, status, executed_at)
    VALUES (
      p_tenant_id, 'invoice_overdue_alert',
      jsonb_build_object('facture_id', v_facture.id, 'invoice_number', v_facture.invoice_number),
      'done', NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 11. Fonction maître : exécuter tous les checks ───────────
-- Appelée par l'API /api/automation/run (cron ou à la demande)

CREATE OR REPLACE FUNCTION fn_run_automation_checks(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contracts_alerted INT;
  v_invoices_alerted  INT;
BEGIN
  v_contracts_alerted := fn_check_expiring_contracts(p_tenant_id);
  v_invoices_alerted  := fn_check_overdue_invoices(p_tenant_id);

  RETURN jsonb_build_object(
    'contracts_alerted', v_contracts_alerted,
    'invoices_alerted',  v_invoices_alerted,
    'checked_at',        NOW()
  );
END;
$$;

-- ── 12. Vue : résumé automation par tenant ───────────────────

CREATE OR REPLACE VIEW vue_automation_stats AS
SELECT
  st.tenant_id,
  COUNT(*) FILTER (WHERE st.status = 'pending')  AS tasks_pending,
  COUNT(*) FILTER (WHERE st.status = 'done')     AS tasks_done,
  COUNT(*) FILTER (WHERE st.status = 'error')    AS tasks_error,
  MAX(st.executed_at)                             AS last_execution
FROM scheduled_tasks st
GROUP BY st.tenant_id;
