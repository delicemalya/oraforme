/**
 * lib/countries/CF.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * RÉPUBLIQUE CENTRAFRICAINE — Configuration fiscale et sociale
 *
 * Sources : pays.ts (source interne) · DGI RCA · CNSS RCA
 *
 * data_confidence : 'estimated'
 * Données issues de pays.ts — contexte institutionnel fragile, à confirmer
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const CF: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'CF',
  nom_pays:          'République Centrafricaine',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Bangui',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        26_000,   // SMIG RCA estimé — à confirmer
  smig_source: 'SMIG RCA estimé — à confirmer DGT (Direction du Travail) RCA',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.19,
    taxes_additionnelles: [],
    taux_effectif_sur_ht: 0.19,
    seuil_assujettissement: 30_000_000,
    regime:               'mensuel',
    echeance_jour:        20,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CGI RCA',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard: 0.30,   // IS estimé
    source: 'Estimé CGI RCA — à confirmer',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.20,
    interets_non_residents:    0.15,
    prestations_non_residents: 0.15,
    source: 'Estimé — à confirmer DGI RCA',
  },

  // ── IRPP (ITS) ─────────────────────────────────────────────────────────────
  irpp: {
    nom: 'ITS (Impôt sur les Traitements et Salaires)',

    methode_base: 'annuelle_div12',

    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.15,   // 15% d'abattement professionnel
    },

    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // Barème ITS annuel RCA (source pays.ts)
    tranches: [
      { min: 0,          max: 600_000,   taux: 0    },   // 0%
      { min: 600_001,    max: 2_000_000, taux: 0.10 },   // 10%
      { min: 2_000_001,  max: 5_000_000, taux: 0.20 },   // 20%
      { min: 5_000_001,  max: Infinity,  taux: 0.30 },   // 30%
    ],

    periodicite:   'mensuel',
    echeance_jour: 20,
    source: 'pays.ts (estimé) — ⚠️ Contexte institutionnel fragile, à confirmer DGI RCA',
  },

  // ── CNSS ───────────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Caisse Nationale de Sécurité Sociale',
    acronyme: 'CNSS',

    branches: [
      {
        code:            'CNSS_SAL',
        libelle:         'Cotisations salariales (Retraite + AT + Maternité)',
        taux_salarie:    0.03,      // 3% salarié
        taux_patronal:   0,
        plafond_mensuel: null,      // Déplafonné (non documenté)
      },
      {
        code:            'CNSS_PAT',
        libelle:         'Cotisations patronales (Retraite + AT + Maternité)',
        taux_salarie:    0,
        taux_patronal:   0.14,      // 14% patronal
        plafond_mensuel: null,
      },
    ],

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CNSS RCA : sal 3%, pat 14%, déplafonné',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI RCA — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI RCA — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI RCA',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI RCA',
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
    support_consolidation:           false,   // Contexte institutionnel limité
    support_miaa_fiscal:             true,
    support_miaa_rh:                 true,
    support_declarations_cnss:       false,   // CNSS RCA : fiabilité institutionnelle à confirmer
    support_declarations_fiscales:   false,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'estimated',
  loi_reference:        'CGI RCA — source estimée pays.ts',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'TVA 19% — l\'un des taux les plus élevés de la zone CEMAC',
    'CNSS : sal 3% + pat 14% = 17% déplafonné',
    'ITS 4 tranches 0→30% · abattement 15%',
    '⚠️ Toutes données ESTIMÉES — contexte institutionnel fragile en RCA',
    '⚠️ Seuil assujettissement TVA 30M FCFA (parmi les plus bas CEMAC)',
    '⚠️ SMIG et plafonds CNSS non confirmés — à vérifier sur textes officiels RCA',
  ],
}
