-- ============================================================
-- BACKFILL : Paie → journal_comptable + journal_entries
-- Pour ECAM CONGO (tenant c9651476-2fc4-407a-8a4e-778fa1332689)
-- Exécuter dans Supabase → SQL Editor
--
-- Ce script insère les écritures manquantes pour toutes les
-- fiches de paie déjà validées (statut = 'paye') qui n'ont
-- pas encore de ligne dans journal_comptable.
-- ============================================================

DO $$
DECLARE
  tid          UUID    := 'c9651476-2fc4-407a-8a4e-778fa1332689';
  p            RECORD;
  nom_agent    TEXT;
  libelle      TEXT;
  libelle_cnss TEXT;
  credit_acc   TEXT;
  brut_calc    INTEGER;
  cnss_montant INTEGER;
  pay_date     DATE;
  mois_labels  TEXT[]  := ARRAY[
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
BEGIN

  FOR p IN
    SELECT pe.*
    FROM   paie_ecole pe
    WHERE  pe.tenant_id = tid
      AND  pe.statut    = 'paye'
      -- Ne réinsérer que ce qui est absent de journal_comptable
      AND NOT EXISTS (
        SELECT 1
        FROM   journal_comptable jc
        WHERE  jc.tenant_id = tid
          AND  jc.source    = 'paie'
          AND  jc.source_id = pe.id::text
      )
    ORDER BY pe.created_at
  LOOP
    -- ── Résolution du nom de l'agent ──────────────────────────
    SELECT COALESCE(
      (SELECT e.prenom  || ' ' || e.nom  FROM employes    e  WHERE e.id  = p.employe_id LIMIT 1),
      (SELECT s.prenom  || ' ' || s.nom  FROM staff_ecole s  WHERE s.id  = p.employe_id LIMIT 1),
      (SELECT en.prenom || ' ' || en.nom FROM enseignants en WHERE en.id = p.employe_id LIMIT 1),
      'Agent inconnu'
    ) INTO nom_agent;

    pay_date     := p.created_at::date;
    libelle      := 'Salaire '        || mois_labels[p.mois] || ' ' || p.annee || ' — ' || nom_agent;
    libelle_cnss := 'CNSS patronale ' || mois_labels[p.mois] || ' ' || p.annee || ' — ' || nom_agent;

    -- ── Compte de crédit selon mode de paiement ──────────────
    credit_acc := CASE p.mode_paiement
      WHEN 'virement'     THEN '521000'
      WHEN 'cheque'       THEN '521000'
      WHEN 'especes'      THEN '571000'
      WHEN 'airtel_money' THEN '571100'
      WHEN 'mtn_momo'     THEN '571100'
      ELSE '521000'
    END;

    brut_calc    := p.salaire_base + COALESCE(p.primes, 0);
    cnss_montant := ROUND(brut_calc * 0.08);

    -- ── 1. journal_comptable — salaire ────────────────────────
    INSERT INTO journal_comptable (
      tenant_id, date, libelle, type,
      montant_ht, tva, ca, montant_ttc,
      categorie, debit_account, credit_account,
      source, source_id
    ) VALUES (
      tid, pay_date, libelle, 'depense',
      p.net, 0, 0, p.net,
      '641 — Rémunérations du personnel', '641000', credit_acc,
      'paie', p.id::text
    );

    -- ── 2. journal_comptable — CNSS patronale ─────────────────
    INSERT INTO journal_comptable (
      tenant_id, date, libelle, type,
      montant_ht, tva, ca, montant_ttc,
      categorie, debit_account, credit_account,
      source, source_id
    ) VALUES (
      tid, pay_date, libelle_cnss, 'depense',
      cnss_montant, 0, 0, cnss_montant,
      '644 — Charges sociales patronales', '644000', '431000',
      'paie', p.id::text
    );

    -- ── 3. journal_entries — salaire ──────────────────────────
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year
    ) VALUES (
      tid, pay_date, libelle,
      '641000', credit_acc, p.net,
      'paie', p.id::text, p.annee
    );

    -- ── 4. journal_entries — CNSS patronale ───────────────────
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year
    ) VALUES (
      tid, pay_date, libelle_cnss,
      '644000', '431000', cnss_montant,
      'paie', p.id::text, p.annee
    );

    RAISE NOTICE 'Backfill % — net: % FCFA / CNSS: % FCFA', nom_agent, p.net, cnss_montant;
  END LOOP;

  RAISE NOTICE '✓ Backfill terminé pour tenant %', tid;
END $$;

-- ── Vérification rapide ──────────────────────────────────────────────────────
SELECT
  type,
  categorie,
  COUNT(*)     AS nb_ecritures,
  SUM(montant_ttc) AS total_fcfa
FROM journal_comptable
WHERE tenant_id = 'c9651476-2fc4-407a-8a4e-778fa1332689'
  AND source = 'paie'
GROUP BY type, categorie
ORDER BY categorie;
