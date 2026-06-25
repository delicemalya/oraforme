-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 136 — Moteur paie unique OHADA : trigger + V3 + V4 + JC + Option Alpha
-- Objectif : créer trg_bulletins_paie (absent depuis mig 046) et compléter
--            fn_bulletins_paie_to_journal avec V3 (CNSS salariale), V4 (IRPP),
--            JC (journal_comptable) et Option Alpha (saut generee→payee direct).
--            Supprime définitivement le besoin des chemins Path A (route.ts) et
--            Path B (page.tsx) qui sont supprimés en TypeScript simultanément.
-- Prérequis : migrations 134 (fn existante V1+V2+P1+TX) et 135 (fn_ohada_cash_account)
-- Tenant de référence : AMD Finance — 64c244e5-02fd-4cf7-a56f-b0bdd48fdc09
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION AVANT — EXÉCUTER VIA MCP POSTGRES AVANT LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Confirmer absence du trigger (doit retourner 0 ligne)
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bulletins_paie';

-- 2. Confirmer présence de la fonction (doit retourner 1 ligne)
-- SELECT proname FROM pg_proc WHERE proname = 'fn_bulletins_paie_to_journal';

-- 3. Confirmer présence de fn_ohada_cash_account (doit retourner 1 ligne)
-- SELECT proname FROM pg_proc WHERE proname = 'fn_ohada_cash_account';

-- 4. Snapshot comptages JE par source paie (référence avant migration)
-- SELECT source, COUNT(*) AS nb, SUM(montant) AS total
-- FROM journal_entries
-- WHERE source IN ('paie_accrual','paie_cnss','paie_cnss_sal','paie_irpp','paie_paiement','paie')
-- GROUP BY source ORDER BY source;

-- 5. Snapshot bulletins par statut (doit montrer 4 generee pour AMD Finance)
-- SELECT statut, COUNT(*) AS nb
-- FROM bulletins_paie
-- WHERE tenant_id = '64c244e5-02fd-4cf7-a56f-b0bdd48fdc09'
-- GROUP BY statut;

-- 6. Vérifier zéro paie_cnss_sal et paie_irpp existants (nouvelles sources — doit = 0)
-- SELECT COUNT(*) FROM journal_entries
-- WHERE source IN ('paie_cnss_sal','paie_irpp');

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION — À EXÉCUTER
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fonction améliorée : V1 + V2 + V3 + V4 + JC + Option Alpha + P1 + TX
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_bulletins_paie_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year    INT;
  v_credit  TEXT;
  v_libelle TEXT;
  v_net     NUMERIC(14,2);
  v_date    DATE;
BEGIN

  -- ══ BLOC A — Constatation comptable à la VALIDATION ════════════════════════
  -- Déclenché uniquement sur transition → 'validee'
  -- Guard IS DISTINCT FROM : empêche re-exécution si statut inchangé
  IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN

    -- Guard NOT EXISTS : empêche tout doublon si ce bloc a déjà été exécuté
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source    = 'paie_accrual'
        AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := MAKE_DATE(NEW.annee::INT, NEW.mois::INT, 1);
      v_year    := NEW.annee::INT;
      v_libelle := 'Bulletin paie ' || NEW.mois || '/' || NEW.annee;

      -- V1 : Salaire brut — Débit 661 / Crédit 421 (SYSCOHADA — rémunérations directes)
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle,
         debit_account, credit_account, montant,
         source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — salaire brut',
         '661', '421', COALESCE(NEW.brut, 0),
         'paie_accrual', NEW.id, v_year);

      -- V2 : CNSS patronal — Débit 664 / Crédit 431 (charges sociales patronales)
      IF COALESCE(NEW.cnss_patronal, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS patronal',
           '664', '431', NEW.cnss_patronal,
           'paie_cnss', NEW.id, v_year);
      END IF;

      -- V3 : CNSS salariale (retenue) — Débit 421 / Crédit 431
      -- Réduit la dette 421 du montant retenu sur le salaire du salarié
      IF COALESCE(NEW.cnss_salarie, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS salariale (retenue)',
           '421', '431', NEW.cnss_salarie,
           'paie_cnss_sal', NEW.id, v_year);
      END IF;

      -- V4 : IRPP retenu à la source — Débit 421 / Crédit 447
      -- Réduit la dette 421 du montant d'impôt retenu pour le compte de l'État
      IF COALESCE(NEW.irpp, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — IRPP retenu à la source',
           '421', '447', NEW.irpp,
           'paie_irpp', NEW.id, v_year);
      END IF;

      -- JC : Ligne synthèse journal_comptable (1 ligne par bulletin validé)
      INSERT INTO journal_comptable
        (tenant_id, date, libelle,
         type, montant_ht, tva, ca, montant_ttc,
         source, source_id)
      VALUES
        (NEW.tenant_id, v_date, v_libelle,
         'depense', COALESCE(NEW.brut, 0), 0, 0, COALESCE(NEW.brut, 0),
         'paie_accrual', NEW.id);

    END IF; -- fin NOT EXISTS paie_accrual
  END IF;   -- fin BLOC A


  -- ══ BLOC B — Paiement net et trésorerie ════════════════════════════════════
  -- Déclenché uniquement sur transition → 'payee'
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN

    -- ── Option Alpha : compensation du saut direct generee → payee ────────────
    -- Si le bulletin passe à 'payee' sans être passé par 'validee',
    -- les écritures accrual (V1-V4+JC) n'existent pas encore — les créer ici.
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source    = 'paie_accrual'
        AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := MAKE_DATE(NEW.annee::INT, NEW.mois::INT, 1);
      v_year    := NEW.annee::INT;
      v_libelle := 'Bulletin paie ' || NEW.mois || '/' || NEW.annee;

      -- V1 (Alpha) : Salaire brut — 661 / 421
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle,
         debit_account, credit_account, montant,
         source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — salaire brut',
         '661', '421', COALESCE(NEW.brut, 0),
         'paie_accrual', NEW.id, v_year);

      -- V2 (Alpha) : CNSS patronal — 664 / 431
      IF COALESCE(NEW.cnss_patronal, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS patronal',
           '664', '431', NEW.cnss_patronal,
           'paie_cnss', NEW.id, v_year);
      END IF;

      -- V3 (Alpha) : CNSS salariale — 421 / 431
      IF COALESCE(NEW.cnss_salarie, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — CNSS salariale (retenue)',
           '421', '431', NEW.cnss_salarie,
           'paie_cnss_sal', NEW.id, v_year);
      END IF;

      -- V4 (Alpha) : IRPP — 421 / 447
      IF COALESCE(NEW.irpp, 0) > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle,
           debit_account, credit_account, montant,
           source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, v_date, v_libelle || ' — IRPP retenu à la source',
           '421', '447', NEW.irpp,
           'paie_irpp', NEW.id, v_year);
      END IF;

      -- JC (Alpha) : synthèse journal_comptable
      INSERT INTO journal_comptable
        (tenant_id, date, libelle,
         type, montant_ht, tva, ca, montant_ttc,
         source, source_id)
      VALUES
        (NEW.tenant_id, v_date, v_libelle,
         'depense', COALESCE(NEW.brut, 0), 0, 0, COALESCE(NEW.brut, 0),
         'paie_accrual', NEW.id);

    END IF; -- fin Option Alpha


    -- ── P1 + TX : versement net au salarié ───────────────────────────────────
    -- Guard NOT EXISTS séparé : paie_paiement est indépendant de paie_accrual
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source    = 'paie_paiement'
        AND source_id = NEW.id
        AND tenant_id = NEW.tenant_id
    ) THEN
      v_date    := MAKE_DATE(NEW.annee::INT, NEW.mois::INT, 1);
      v_year    := NEW.annee::INT;
      v_libelle := 'Virement salaires ' || NEW.mois || '/' || NEW.annee;
      v_credit  := fn_ohada_cash_account(COALESCE(NEW.mode_paiement, 'virement'));
      -- net = brut - cnss_salarie - irpp → 421 se solde à zéro sur le cycle complet
      v_net     := GREATEST(
        COALESCE(NEW.brut, 0) - COALESCE(NEW.cnss_salarie, 0) - COALESCE(NEW.irpp, 0),
        0
      );

      -- P1 : Net versé — Débit 421 / Crédit Trésorerie (521/571/5711/5712)
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle,
         debit_account, credit_account, montant,
         source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle,
         '421', v_credit, v_net,
         'paie_paiement', NEW.id, v_year);

      -- TX : Mouvement trésorerie (alimente Finance Dashboard et RPCs)
      INSERT INTO transactions
        (tenant_id, type, categorie, description, montant, date,
         mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
      VALUES
        (NEW.tenant_id, 'sortie', 'Paie', v_libelle, v_net, v_date,
         COALESCE(NEW.mode_paiement, 'virement'), 'paie', NEW.id,
         '421', v_credit, v_year);

    END IF; -- fin NOT EXISTS paie_paiement
  END IF;   -- fin BLOC B

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger unique — création définitive
--    DROP IF EXISTS : nettoyage préventif (mig 046 avait tenté sans BEGIN/COMMIT)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;

CREATE TRIGGER trg_bulletins_paie
  AFTER UPDATE OF statut
  ON bulletins_paie
  FOR EACH ROW
  EXECUTE FUNCTION fn_bulletins_paie_to_journal();

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUÊTES DE VÉRIFICATION APRÈS — EXÉCUTER VIA MCP POSTGRES APRÈS LA MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Trigger créé et actif (doit retourner 1 ligne, tgenabled = 'O')
-- SELECT tgname, tgenabled, tgtype
-- FROM pg_trigger
-- WHERE tgname = 'trg_bulletins_paie';

-- 2. Fonction mise à jour — confirmer présence de paie_cnss_sal dans le corps
-- SELECT CASE WHEN prosrc LIKE '%paie_cnss_sal%' THEN 'OK — V3 présent'
--             ELSE 'ERREUR — V3 absent' END AS v3_check
-- FROM pg_proc WHERE proname = 'fn_bulletins_paie_to_journal';

-- 3. Test fonctionnel fn_ohada_cash_account (doit retourner '521')
-- SELECT fn_ohada_cash_account('virement') AS compte_virement;

-- 4. Snapshot après — comparer avec snapshot avant (doit être identique)
-- SELECT source, COUNT(*) AS nb, SUM(montant) AS total
-- FROM journal_entries
-- WHERE source IN ('paie_accrual','paie_cnss','paie_cnss_sal','paie_irpp','paie_paiement','paie')
-- GROUP BY source ORDER BY source;

-- 5. Vérifier bulletins AMD Finance inchangés (toujours 4 à 'generee')
-- SELECT statut, COUNT(*) AS nb
-- FROM bulletins_paie
-- WHERE tenant_id = '64c244e5-02fd-4cf7-a56f-b0bdd48fdc09'
-- GROUP BY statut;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST OPTION ALPHA — À EXÉCUTER MANUELLEMENT EN DEV/STAGING (PAS EN PRODUCTION)
-- ══════════════════════════════════════════════════════════════════════════════

-- Étape A : Créer un bulletin test à 'generee'
-- INSERT INTO bulletins_paie
--   (tenant_id, employe_id, mois, annee, brut, cnss_salarie, cnss_patronal, irpp, net,
--    mode_paiement, statut)
-- VALUES
--   ('64c244e5-02fd-4cf7-a56f-b0bdd48fdc09',
--    (SELECT id FROM employes WHERE tenant_id='64c244e5-02fd-4cf7-a56f-b0bdd48fdc09' LIMIT 1),
--    6, 2026, 300000, 12000, 24000, 18000, 270000, 'virement', 'generee')
-- RETURNING id;  -- noter l'UUID → <BULLETIN_TEST_ID>

-- Étape B : Saut direct generee → payee (Option Alpha)
-- UPDATE bulletins_paie SET statut='payee' WHERE id='<BULLETIN_TEST_ID>';

-- Étape C : Vérifier les 5 JE créés (V1+V2+V3+V4+P1)
-- SELECT source, debit_account, credit_account, montant
-- FROM journal_entries
-- WHERE source_id = '<BULLETIN_TEST_ID>'
-- ORDER BY source;
-- Attendu : paie_accrual(661/421=300000), paie_cnss(664/431=24000),
--           paie_cnss_sal(421/431=12000), paie_irpp(421/447=18000),
--           paie_paiement(421/521=270000)

-- Étape D : Vérifier JC
-- SELECT source, montant_ht FROM journal_comptable WHERE source_id='<BULLETIN_TEST_ID>';
-- Attendu : paie_accrual, 300000

-- Étape E : Vérifier TX
-- SELECT source, montant, type FROM transactions WHERE source_id='<BULLETIN_TEST_ID>';
-- Attendu : paie, 270000, sortie

-- Étape F : Vérifier 421 soldé à zéro
-- SELECT
--   SUM(CASE WHEN credit_account='421' THEN montant ELSE 0 END) AS credits_421,
--   SUM(CASE WHEN debit_account='421' THEN montant ELSE 0 END) AS debits_421,
--   SUM(CASE WHEN credit_account='421' THEN montant ELSE 0 END)
--   - SUM(CASE WHEN debit_account='421' THEN montant ELSE 0 END) AS solde_421
-- FROM journal_entries
-- WHERE source_id='<BULLETIN_TEST_ID>';
-- Attendu : credits_421=300000, debits_421=300000, solde_421=0

-- Étape G : Nettoyer le bulletin test
-- DELETE FROM journal_entries WHERE source_id='<BULLETIN_TEST_ID>';
-- DELETE FROM journal_comptable WHERE source_id='<BULLETIN_TEST_ID>';
-- DELETE FROM transactions WHERE source_id='<BULLETIN_TEST_ID>';
-- DELETE FROM bulletins_paie WHERE id='<BULLETIN_TEST_ID>';

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — NE PAS EXÉCUTER (sauf incident confirmé après analyse)
-- ══════════════════════════════════════════════════════════════════════════════

-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;
--   -- Restaurer fn_bulletins_paie_to_journal version migration 134 (V1+V2+P1+TX sans trigger) :
--   CREATE OR REPLACE FUNCTION fn_bulletins_paie_to_journal()
--   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $ROLLBACK$
--   DECLARE
--     v_year INT; v_credit TEXT; v_libelle TEXT; v_net NUMERIC(14,2); v_date DATE;
--   BEGIN
--     IF (OLD.statut IS DISTINCT FROM 'validee') AND NEW.statut = 'validee' THEN
--       IF NOT EXISTS (SELECT 1 FROM journal_entries
--                      WHERE source='paie_accrual' AND source_id=NEW.id AND tenant_id=NEW.tenant_id) THEN
--         v_date:=COALESCE(NEW.date_paiement,CURRENT_DATE); v_year:=EXTRACT(YEAR FROM v_date)::INT;
--         v_libelle:='Bulletin paie '||NEW.mois||'/'||NEW.annee;
--         INSERT INTO journal_entries(tenant_id,date_operation,libelle,debit_account,credit_account,montant,source,source_id,fiscal_year)
--         VALUES(NEW.tenant_id,v_date,v_libelle||' — salaire brut','661','421',COALESCE(NEW.brut,0),'paie_accrual',NEW.id,v_year);
--         IF COALESCE(NEW.cnss_patronal,0)>0 THEN
--           INSERT INTO journal_entries(tenant_id,date_operation,libelle,debit_account,credit_account,montant,source,source_id,fiscal_year)
--           VALUES(NEW.tenant_id,v_date,v_libelle||' — CNSS patronal','664','431',NEW.cnss_patronal,'paie_cnss',NEW.id,v_year);
--         END IF;
--       END IF;
--     END IF;
--     IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN
--       IF NOT EXISTS (SELECT 1 FROM journal_entries
--                      WHERE source='paie_paiement' AND source_id=NEW.id AND tenant_id=NEW.tenant_id) THEN
--         v_date:=COALESCE(NEW.date_paiement,CURRENT_DATE); v_year:=EXTRACT(YEAR FROM v_date)::INT;
--         v_libelle:='Virement salaires '||NEW.mois||'/'||NEW.annee;
--         v_credit:=fn_ohada_cash_account(COALESCE(NEW.mode_paiement,'virement'));
--         v_net:=GREATEST(COALESCE(NEW.brut,0)-COALESCE(NEW.cnss_salarie,0)-COALESCE(NEW.irpp,0),0);
--         INSERT INTO journal_entries(tenant_id,date_operation,libelle,debit_account,credit_account,montant,source,source_id,fiscal_year)
--         VALUES(NEW.tenant_id,v_date,v_libelle,'421',v_credit,v_net,'paie_paiement',NEW.id,v_year);
--         INSERT INTO transactions(tenant_id,type,categorie,description,montant,date,mode_paiement,source,source_id,debit_account,credit_account,fiscal_year)
--         VALUES(NEW.tenant_id,'sortie','Paie',v_libelle,v_net,v_date,COALESCE(NEW.mode_paiement,'virement'),'paie',NEW.id,'421',v_credit,v_year);
--       END IF;
--     END IF;
--     RETURN NEW;
--   END;
--   $ROLLBACK$;
-- COMMIT;
-- NOTE : après rollback, réactiver Path A et Path B dans TypeScript via git revert.
