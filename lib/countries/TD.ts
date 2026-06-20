/**
 * lib/countries/TD.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TCHAD — Configuration fiscale et sociale
 *
 * Sources : pays.ts (source interne) · DGI Tchad · CNPS Tchad
 *
 * data_confidence : 'estimated'
 * Données issues de pays.ts — à confirmer sur textes officiels DGI/CNPS Tchad
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const TD: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'TD',
  nom_pays:          'Tchad',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Ndjamena',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        60_000,   // SMIG Tchad estimé — à confirmer
  smig_source: 'SMIG Tchad estimé 60 000 FCFA — à confirmer DGT Tchad',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.18,
    taxes_additionnelles: [],
    taux_effectif_sur_ht: 0.18,
    seuil_assujettissement: 100_000_000,   // Seuil élevé (100M FCFA) — PME exemptées
    regime:               'mensuel',
    echeance_jour:        20,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CGI Tchad',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard: 0.35,   // IS Tchad estimé à 35%
    source: 'Estimé CGI Tchad — à confirmer (régime fiscal simplifié PME)',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.20,
    interets_non_residents:    0.15,
    prestations_non_residents: 0.15,
    source: 'Estimé CGI Tchad — à confirmer',
  },

  // ── IRPP (IS salaires) ─────────────────────────────────────────────────────
  irpp: {
    nom: 'IS (Impôt sur les Salaires) — Tchad',

    methode_base: 'annuelle_div12',

    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.10,   // 10% d'abattement professionnel
    },

    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // Barème IS salaires annuel Tchad (source pays.ts)
    tranches: [
      { min: 0,          max: 800_000,   taux: 0    },   // 0%
      { min: 800_001,    max: 2_000_000, taux: 0.10 },   // 10%
      { min: 2_000_001,  max: 6_000_000, taux: 0.20 },   // 20%
      { min: 6_000_001,  max: Infinity,  taux: 0.30 },   // 30%
    ],

    periodicite:   'mensuel',
    echeance_jour: 20,
    source: 'pays.ts (estimé) — ⚠️ Pays enclavé, régime simplifié PME à vérifier DGI Tchad',
  },

  // ── CNSS (CNPS) ────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Caisse Nationale de Prévoyance Sociale',
    acronyme: 'CNPS',

    branches: [
      {
        code:            'CNPS_SAL',
        libelle:         'Cotisations salariales (Vieillesse + AT + AF)',
        taux_salarie:    0.024,    // 2,4% salarié
        taux_patronal:   0,
        plafond_mensuel: null,     // Déplafonné
      },
      {
        code:            'CNPS_PAT',
        libelle:         'Cotisations patronales (Vieillesse + AT + AF)',
        taux_salarie:    0,
        taux_patronal:   0.156,    // 15,6% patronal
        plafond_mensuel: null,
      },
    ],

    medecine_travail_taux: 0.005,   // Médecine du travail estimée 0,5% — à confirmer

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CNPS Tchad : sal 2,4%, pat 15,6%, déplafonné',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Tchad — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Tchad — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI Tchad',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI Tchad',
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
      { seuil_heures_semaine: 40, majoration_pct: 0.15 },
      { seuil_heures_semaine: 48, majoration_pct: 0.50 },
    ],
    grilles: [],
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  features: {
    support_conventions_collectives: false,
    support_multi_filiales:          true,
    support_multi_agences:           true,
    support_ifrs:                    false,
    support_consolidation:           false,
    support_miaa_fiscal:             true,
    support_miaa_rh:                 true,
    support_declarations_cnss:       false,   // CNPS Tchad : fiabilité à confirmer
    support_declarations_fiscales:   false,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'estimated',
  loi_reference:        'CGI Tchad — source estimée pays.ts',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'TVA 18% · seuil élevé 100M FCFA — PME très majoritairement exemptées',
    'CNPS : sal 2,4% + pat 15,6% = 18% masse salariale déplafonné',
    'IS salaires 4 tranches 0→30% · abattement 10%',
    'Pays enclavé — régime fiscal simplifié pour PME',
    '⚠️ Toutes données ESTIMÉES — à confirmer sur textes officiels DGI Tchad',
  ],
}
