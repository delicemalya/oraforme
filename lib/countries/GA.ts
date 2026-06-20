/**
 * lib/countries/GA.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GABON — Configuration fiscale et sociale
 *
 * Sources : pays.ts (source interne) · DGI Gabon · CNSS Gabon
 *
 * data_confidence : 'estimated'
 * Données issues de pays.ts — à vérifier sur textes officiels DGI Gabon LF 2025/2026
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const GA: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'GA',
  nom_pays:          'Gabon',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Libreville',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        150_000,
  smig_source: 'SMIG Gabon 150 000 FCFA/mois (source pays.ts — à confirmer)',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.18,
    taux_reduit:          0.05,   // TVA taux réduit 5% (Central Africa Tax Guide 2023)
    taxes_additionnelles: [],
    taux_effectif_sur_ht: 0.18,
    seuil_assujettissement: 60_000_000,
    regime:               'mensuel',
    echeance_jour:        15,    // DGI Gabon : déclaration avant le 15 du mois suivant
    echeance_mois_suivant: true,
    source: 'Central Africa Tax Guide 2023 — DGI Gabon · TVA 18% taux normal · 5% taux réduit',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard:   0.35,          // IS 35% — Central Africa Tax Guide 2023 (DGI Gabon)
    taux_minimum_ca: 0.011,         // Minimum de perception : 1,1% du CA HT
    // Plancher absolu : 600 000 XAF (max(1,1% CA, 600k) — 600k non modélisé dans moteur)
    // Acomptes : 1/4 IS N-1 avant 30/11 · 1/3 IS N-1 avant 30/01 · solde avant 30/04
    source: 'Central Africa Tax Guide 2023 — DGI Gabon · IS 35% · minimum max(1,1% CA, 600 000 XAF)',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.20,   // 20% (10% sous conditions — non modélisé)
    interets_non_residents:    0.15,   // 15%
    redevances_non_residents:  0.20,   // 20%
    prestations_non_residents: 0.20,   // 20% prestataires étrangers (Central Africa Tax Guide 2023)
    // prestataires locaux non assujettis TVA : 9,5% — non modélisé dans champ standard
    source: 'Central Africa Tax Guide 2023 — DGI Gabon (à confirmer LF 2026)',
  },

  // ── IRPP ───────────────────────────────────────────────────────────────────
  irpp: {
    nom: 'IRPP (Impôt sur le Revenu des Personnes Physiques)',

    methode_base: 'annuelle_div12',

    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.20,   // 20% d'abattement professionnel
    },

    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // 8 tranches IRPP annuelles Gabon (source pays.ts)
    tranches: [
      { min: 0,           max: 1_500_000,  taux: 0    },   // 0%
      { min: 1_500_001,   max: 1_920_000,  taux: 0.05 },   // 5%
      { min: 1_920_001,   max: 2_700_000,  taux: 0.10 },   // 10%
      { min: 2_700_001,   max: 3_600_000,  taux: 0.15 },   // 15%
      { min: 3_600_001,   max: 5_160_000,  taux: 0.20 },   // 20%
      { min: 5_160_001,   max: 7_500_000,  taux: 0.25 },   // 25%
      { min: 7_500_001,   max: 11_000_000, taux: 0.30 },   // 30%
      { min: 11_000_001,  max: Infinity,   taux: 0.35 },   // 35%
    ],

    periodicite:   'mensuel',
    echeance_jour: 20,
    source: 'pays.ts (estimé) — ⚠️ À confirmer DGI Gabon LF 2026',
  },

  // ── CNSS ───────────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Caisse Nationale de Sécurité Sociale',
    acronyme: 'CNSS',

    // Branches simplifiées — décomposition interne non documentée
    branches: [
      {
        code:            'CNSS_SAL',
        libelle:         'Cotisations salariales (Retraite+AT+AF)',
        taux_salarie:    0.025,         // 2,5% salarié
        taux_patronal:   0,
        plafond_mensuel: 1_500_000,
      },
      {
        code:            'CNSS_PAT',
        libelle:         'Cotisations patronales (Retraite+AT+AF)',
        taux_salarie:    0,
        taux_patronal:   0.201,         // 20,1% patronal — parmi les plus élevés CEMAC
        plafond_mensuel: 1_500_000,
      },
    ],

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CNSS Gabon : sal 2,5%, pat 20,1%, plafond 1,5M',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Gabon — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Gabon — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI Gabon',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI Gabon',
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
      { seuil_heures_semaine: 40, majoration_pct: 0.20 },
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
    support_consolidation:           true,
    support_miaa_fiscal:             true,
    support_miaa_rh:                 true,
    support_declarations_cnss:       true,
    support_declarations_fiscales:   true,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'to_verify',
  loi_reference:        'Central Africa Tax Guide 2023 · DGI Gabon — LF 2026 à confirmer',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'TVA 18% (normal) + taux réduit 5% · seuil 60M FCFA/an · déclaration avant le 15',
    'CNSS patronal 20,1% — parmi les plus élevés CEMAC · plafond 1,5M FCFA',
    'IRPP 8 tranches 0→35% · abattement 20% · seuil 0% jusqu\'à 1,5M annuel',
    'IS 35% · minimum max(1,1% CA, 600 000 XAF) · exonération 2 premières années',
    'Acomptes IS : 1/4 IS N-1 avant 30/11 · 1/3 IS N-1 avant 30/01 · solde avant 30/04',
    'Retenues source : dividendes 20% (10% sous conditions) · prestataires étrangers 20%',
    'SMIG 150 000 FCFA/mois',
    '⚠️ IS/TVA/retenues partiellement vérifiés via Central Africa Tax Guide 2023 — IRPP/CNSS source pays.ts',
    '⚠️ Confirmer LF Gabon 2026 avant mise en production (DGI Gabon)',
  ],
}
