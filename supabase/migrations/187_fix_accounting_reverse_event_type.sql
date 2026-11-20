-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 187 — ACCOUNTING-REVERSE-001-FIX : fn_reverse_accounting_event
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Mission ACCOUNTING-REVERSE-001-FIX · docs/ACCOUNTING-REVERSE-001-IMPACT-AUDIT.md
--
-- CAUSE RACINE (démontrée par l'audit, confirmée par exécution PostgreSQL
-- réelle dans C6-185-FIX-VALIDATION.md §5 et reconfirmée ici) :
--   fn_reverse_accounting_event (migration 138) construit l'event_type de
--   l'extourne par :
--     'EXT-' || v_event.event_module || '-' || split_part(v_event.event_type, '-', 2)
--   Pour event_type='VTE-001' (event_module='VTE') → 'EXT-VTE-001'. Cette
--   chaîne viole structurellement chk_ae_event_type
--   (CHECK event_type ~ '^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$') : le motif
--   exige des CHIFFRES immédiatement après le premier groupe de lettres —
--   'EXT-VTE-001' a des LETTRES ('VTE') juste après 'EXT-'. Aucun module
--   substitué à la place de 'VTE' ne peut jamais satisfaire ce motif :
--   défaut universel, pas spécifique à VTE. fn_reverse_accounting_event n'a
--   donc JAMAIS réussi à se compléter pour aucun event_type depuis sa
--   création — confirmé par introspection production en lecture seule
--   (0 ligne accounting_events avec event_type LIKE 'EXT-%', 0 ligne avec
--   status='reversed', à ce jour).
--
-- IMPACT PRODUCTION RÉEL (pas seulement théorique) : app/dashboard/
-- facturation/page.tsx::del() appelle reverseFactureEvents() avant toute
-- suppression de facture, qui appelle cette fonction pour FAC-001/FAC-002 —
-- un appelant réel, branché sur une action utilisateur, existe déjà en
-- production. Aucune corruption n'est cependant démontrée à ce jour : 0
-- événement FAC-001/FAC-002 au statut 'processed' n'existe actuellement
-- (vérifié en lecture seule) pour les 6 factures réelles.
--
-- CORRECTION RETENUE — Option B de l'audit (§7/§8), PAS un relâchement de
-- chk_ae_event_type :
--   Remplacer la construction par : v_event.event_type || '-EXT'
--   Pour 'VTE-001' → 'VTE-001-EXT'. Vérifié contre le motif existant,
--   caractère par caractère : [A-Z]{2,10}='VTE', '-', [0-9]{3}='001',
--   groupe optionnel (-[A-Z0-9]+)?='-EXT' — CONFORME, sans modifier la
--   contrainte. Choisi plutôt que l'option A (relâcher la contrainte) ou C
--   (les deux) car c'est la modification la plus minimale qui respecte le
--   contrat déjà en place, conformément à la consigne explicite de cette
--   mission.
--
--   Aucune collision avec un event_type métier existant : recherche
--   exhaustive des 54 event_type définis dans accounting_event_rules à
--   travers toutes les migrations — aucun n'utilise de 3ᵉ segment après le
--   numéro à 3 chiffres (tous sont strictement 'MODULE-NNN'), donc aucun ne
--   se termine jamais par '-EXT'. Le suffixe est donc sans ambiguïté
--   possible avec un event_type métier réel.
--
--   Générique, sans branche spécifique à un module : la même ligne
--   fonctionne identiquement pour FAC-001, FAC-002, VTE-001, VTE-002, et
--   les 50 autres event_type du dépôt — aucune condition sur event_module.
--
--   event_module n'est plus utilisé par cette construction (il reste une
--   colonne normale de accounting_events, inchangée, juste plus lue à ce
--   point précis du corps de la fonction).
--
-- CE QUI N'EST PAS TOUCHÉ (vérifié par relecture du corps complet avant
-- d'écrire cette migration, pas supposé) :
--   - accounting_events, accounting_event_rules, accounting_event_log,
--     accounting_event_extournes : aucune colonne, aucune contrainte,
--     aucun index ajouté ou modifié — la relation original→extourne est
--     déjà entièrement portée par les colonnes existantes
--     (accounting_events.correction_of, accounting_events.reversed_by,
--     accounting_event_extournes.original_event_id UNIQUE) — aucun
--     nouveau mécanisme créé.
--   - L'idempotence du reverse reste exactement celle déjà en place :
--     le garde-fou "IF EXISTS (SELECT 1 FROM accounting_event_extournes
--     WHERE original_event_id = p_event_id) THEN RAISE EXCEPTION" (ligne
--     inchangée) s'exécute AVANT toute tentative d'INSERT — une 2ᵉ
--     extourne du même événement continue d'être refusée par ce même
--     garde-fou, maintenant atteint pour de vrai puisque la 1ʳᵉ tentative
--     peut désormais réussir.
--   - fn_ae_execute_event, emit_accounting_event, accounting_event_rules,
--     fn_stock_move, reversed_movement_id, les migrations 184/185/186, le
--     modèle des ventes, la fiscalité VTE : AUCUN NE RÉFÉRENCE cette
--     construction de chaîne — ils n'appellent ni ne sont appelés par
--     fn_reverse_accounting_event, et restent donc structurellement hors
--     de portée de ce correctif (vérifié par grep exhaustif avant
--     modification, pas supposé).
--   - Le reverse de stock de C6 (fn_stock_move/reversed_movement_id,
--     migration 186) est un mécanisme ENTIÈREMENT INDÉPENDANT (ne passe
--     jamais par accounting_events) — non concerné, non touché.
--
-- ⚠️ PRÉPARÉE, NON EXÉCUTÉE.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER (après revue et validation métier explicite)
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION fn_reverse_accounting_event(
  p_event_id   UUID,
  p_reason     TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  -- Revue d'application 2026-11-21 — SECURITY DEFINER appelée aussi depuis le
  -- navigateur (app/dashboard/facturation) : un utilisateur connecté ne peut
  -- extourner que les événements de son propre tenant. Les appels serveur
  -- (service_role, auth.uid() NULL) ne sont pas concernés.
  IF auth.uid() IS NOT NULL AND v_event.tenant_id IS DISTINCT FROM get_my_tenant_id() THEN
    RAISE EXCEPTION 'fn_reverse_accounting_event: événement % introuvable', p_event_id
      USING ERRCODE = 'insufficient_privilege';
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
  --
  -- ACCOUNTING-REVERSE-001-FIX : event_type = v_event.event_type || '-EXT'
  -- (ex. 'VTE-001-EXT'), au lieu de 'EXT-' || event_module || '-' || numéro
  -- (ex. 'EXT-VTE-001', qui viole chk_ae_event_type — voir en-tête de
  -- migration). event_module reste lu et transmis tel quel pour
  -- accounting_events.event_module (colonne inchangée, toujours renseignée
  -- depuis l'original).
  INSERT INTO accounting_events (
    tenant_id, event_type, event_module, source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata, status, correction_of, created_by
  )
  SELECT
    v_event.tenant_id,
    v_event.event_type || '-EXT',
    v_event.event_module, v_event.source_module, v_event.source_table, v_event.source_id,
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

COMMENT ON FUNCTION fn_reverse_accounting_event IS
  'Extourne un événement comptable processed (ACCOUNTING-REVERSE-001-FIX : event_type d''extourne = <original>-EXT, conforme à chk_ae_event_type, corrige le défaut universel de la version migration 138 qui n''a jamais pu se compléter pour aucun event_type).';

DO $$
BEGIN
  RAISE NOTICE 'Migration 187 OK — fn_reverse_accounting_event corrigée (event_type extourne = <original>-EXT, conforme chk_ae_event_type)';
END $$;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE (lecture seule, à exécuter après application)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_reverse_accounting_event';
-- Attendu : contient "|| '-EXT'", ne contient plus "'EXT-' ||".
--
-- -- Test fonctionnel réel (non exécuté ici, voir docs/ACCOUNTING-REVERSE-001-FIX-VALIDATION.md) :
-- -- extourner un événement processed de test, vérifier event_type='<original>-EXT',
-- -- vérifier status='reversed' sur l'original, vérifier le rejet d'une 2e extourne.

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- -- Restaurer le corps exact de la migration 138 (avec le défaut d'origine) :
-- CREATE OR REPLACE FUNCTION fn_reverse_accounting_event(
--   p_event_id UUID, p_reason TEXT, p_created_by UUID DEFAULT NULL
-- ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
-- -- ... corps identique à 138, avec
-- --   'EXT-' || v_event.event_module || '-' || split_part(v_event.event_type, '-', 2)
-- -- à la place de v_event.event_type || '-EXT'
-- -- (copier le corps complet depuis supabase/migrations/138_accounting_engine_infrastructure.sql
-- -- si un rollback devient nécessaire — jamais recommandé : cela réintroduit
-- -- un reverse qui ne fonctionne pour aucun event_type)
-- $$;
-- COMMIT;
