/**
 * lib/countries/CD.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * RD CONGO (KINSHASA) — Configuration fiscale et sociale
 *
 * Sources : Loi de Finances RDC N°25/060 du 29/12/2025 (LF 2026) — DGRAD
 *           INSS RDC · Code des Impôts RDC
 *
 * data_confidence : 'to_verify'
 * IPR 10 tranches vérifiées LF N°25/060 — INSS à confirmer INSS RDC 2026
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const CD: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'CD',
  nom_pays:          'RD Congo (Kinshasa)',
  devise:            'CDF',
  symbole_devise:    'FC',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Kinshasa',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FC',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'autre',

  // ── Social ─────────────────────────────────────────────────────────────────
  // SMIG RDC : 11 246 CDF/jour (révision 2018) → ~225 000 CDF/mois (22 jours)
  smig:        225_000,
  smig_source: 'SMIG RDC 11 246 CDF/jour (révision 2018) — à confirmer 2026',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.16,
    taxes_additionnelles: [],
    taux_effectif_sur_ht: 0.16,
    seuil_assujettissement: 80_000_000,   // 80M CDF/an
    regime:               'mensuel',
    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'pays.ts · DGRAD RDC (estimé) — à confirmer LF 2026',
  },

  // ── IS (IBP) ───────────────────────────────────────────────────────────────
  is: {
    taux_standard:   0.30,    // IBP 30% sur bénéfice net
    taux_minimum_ca: 0.01,    // Taxe minimale 1% du CA — LF N°25/060
    // Planchers par taille (GE 2 500 000 FC / ME 750 000 / PE 30 000) — documentés, non modélisés ici
    source: 'Code des Impôts RDC — IBP 30% · LF N°25/060 Art. IBP — taxe minimale 1% CA',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.20,
    interets_non_residents:    0.20,
    prestations_non_residents: 0.14,
    source: 'Estimé Code fiscal RDC — à confirmer DGRAD',
  },

  // ── IRPP (IPR) ─────────────────────────────────────────────────────────────
  irpp: {
    nom: 'IPR (Impôt Professionnel sur les Revenus)',

    // Barème ANNUEL en CDF — moteur annualise brut mensuel × 12 puis divise impôt / 12
    methode_base: 'annuelle_div12',

    abattement: {
      type:   'aucun',
      valeur: 0,
    },

    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // Barème IPR ANNUEL — 10 tranches LF N°25/060 du 29/12/2025 (DGRAD RDC)
    // Seuils ANNUELS en CDF · moteur applique annuelle_div12 (tMin = seuil/12)
    // Seuil exonération = 524 160 CDF/an ≈ 43 680 CDF/mois
    tranches: [
      { min: 0,          max: 524_160,    taux: 0.000 },   // 0%   ≤ 524 160/an
      { min: 524_160,    max: 1_428_000,  taux: 0.150 },   // 15%
      { min: 1_428_000,  max: 2_700_000,  taux: 0.200 },   // 20%
      { min: 2_700_000,  max: 4_620_000,  taux: 0.225 },   // 22,5%
      { min: 4_620_000,  max: 7_260_000,  taux: 0.250 },   // 25%
      { min: 7_260_000,  max: 10_260_000, taux: 0.300 },   // 30%
      { min: 10_260_000, max: 13_908_000, taux: 0.325 },   // 32,5%
      { min: 13_908_000, max: 16_824_000, taux: 0.350 },   // 35%
      { min: 16_824_000, max: 22_956_000, taux: 0.375 },   // 37,5%
      { min: 22_956_000, max: Infinity,   taux: 0.400 },   // 40%
    ],

    periodicite:   'mensuel',
    echeance_jour: 15,
    source: 'Loi de Finances RDC N°25/060 du 29/12/2025 — Réforme IRPP→IPR · DGRAD',
  },

  // ── CNSS (INSS) ────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Institut National de Sécurité Sociale',
    acronyme: 'INSS',

    branches: [
      {
        code:            'INSS_SAL',
        libelle:         'INSS (Retraite + AT + Invalidité) — part salarié',
        taux_salarie:    0.035,    // 3,5% salarié
        taux_patronal:   0,
        plafond_mensuel: null,     // Déplafonné
      },
      {
        code:            'INSS_PAT',
        libelle:         'INSS (Retraite + AT + Invalidité) — part patronale',
        taux_salarie:    0,
        taux_patronal:   0.13,     // 13% patronal
        plafond_mensuel: null,     // Déplafonné
      },
    ],

    echeance_jour:        10,
    echeance_mois_suivant: true,
    source: 'pays.ts · INSS RDC — sal 3,5%, pat 13%, déplafonné',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'Code fiscal RDC — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'Code fiscal RDC — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté Code fiscal RDC',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté Code fiscal RDC',
    },
    autres: [],
  },

  // ── Taxes fixes ────────────────────────────────────────────────────────────
  taxes_fixes: [],

  // ── Conventions collectives ─────────────────────────────────────────────────
  conventions: {
    actif: false,
    prime_anciennete: {
      taux_par_tranche:  0.05,
      duree_tranche_ans: 3,
      plafond_pct:       0.25,
    },
    heures_sup: [
      { seuil_heures_semaine: 45, majoration_pct: 0.30 },
      { seuil_heures_semaine: 48, majoration_pct: 0.60 },
    ],
    grilles: [],
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  features: {
    support_conventions_collectives: false,
    support_multi_filiales:          true,
    support_multi_agences:           true,
    support_ifrs:                    false,
    support_consolidation:           true,
    support_miaa_fiscal:             true,
    support_miaa_rh:                 true,
    support_declarations_cnss:       true,
    support_declarations_fiscales:   true,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'to_verify',
  loi_reference:        'Loi de Finances RDC N°25/060 du 29/12/2025 — DGRAD · Code des Impôts RDC',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'Devise : CDF (Franc Congolais) — ≠ FCFA Congo-Brazzaville (CG)',
    'TVA 16% · seuil 80M CDF/an (LF N°25/060)',
    'INSS déplafonné : sal 3,5% + pat 13% = 16,5% masse salariale totale (à confirmer INSS 2026)',
    'IPR 10 tranches annuelles 0→40% (LF N°25/060) · seuil exonération 524 160 CDF/an (≈ 43 680/mois)',
    'IBP 30% (=IS) · taxe minimale 1% CA · planchers: GE 2 500 000 / ME 750 000 / PE 30 000 FC',
    'Réforme 2026 : IRPP renommé IPR, IS renommé IBP — mêmes assiettes',
    'IERE 25% sur rémunérations des expatriés (non modélisé — à activer si expatriés)',
    '⚠️ SMIG : 11 246 CDF/jour (révision 2018) — très probablement revu depuis 2018',
  ],
}
