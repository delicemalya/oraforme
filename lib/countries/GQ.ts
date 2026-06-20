/**
 * lib/countries/GQ.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GUINÉE ÉQUATORIALE — Configuration fiscale et sociale
 *
 * Sources : pays.ts (source interne) · DGI GQ · INSESO
 *
 * data_confidence : 'estimated'
 * Pays bilingue FR/ES — fiscalité hybride. Données issues de pays.ts.
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const GQ: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'GQ',
  nom_pays:          'Guinée Équatoriale',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',   // Bilingue FR/ES — français dominant dans commerce
  fuseau_horaire:    'Africa/Malabo',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        50_000,   // SMIG GQ estimé — à confirmer
  smig_source: 'SMIG Guinée Équatoriale estimé 50 000 FCFA — à confirmer DGT GQ',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.15,   // TVA 15% — taux réduit de la zone CEMAC
    taxes_additionnelles: [],
    taux_effectif_sur_ht: 0.15,
    seuil_assujettissement: 30_000_000,
    regime:               'mensuel',
    echeance_jour:        20,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — CGI Guinée Équatoriale',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard: 0.35,   // IS GQ estimé
    source: 'Estimé CGI GQ — à confirmer DGI',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.25,
    interets_non_residents:    0.15,
    prestations_non_residents: 0.15,
    source: 'Estimé CGI GQ — à confirmer',
  },

  // ── IRPP (IRPF) ────────────────────────────────────────────────────────────
  irpp: {
    nom: 'IRPF (Impuesto sobre la Renta Personal / Impôt sur le Revenu Personnel)',

    methode_base: 'annuelle_div12',

    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.10,   // 10% d'abattement professionnel (estimé)
    },

    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // Barème IRPF annuel GQ (source pays.ts — 4 tranches)
    tranches: [
      { min: 0,          max: 1_000_000, taux: 0    },   // 0% — large tranche exonérée
      { min: 1_000_001,  max: 3_000_000, taux: 0.10 },   // 10%
      { min: 3_000_001,  max: 6_000_000, taux: 0.20 },   // 20%
      { min: 6_000_001,  max: Infinity,  taux: 0.25 },   // 25%
    ],

    periodicite:   'mensuel',
    echeance_jour: 20,
    source: 'pays.ts (estimé) — ⚠️ Fiscalité hybride FR/ES à vérifier DGI GQ',
  },

  // ── CNSS (INSESO) ──────────────────────────────────────────────────────────
  cnss: {
    nom:      'Instituto Nacional de Seguridad Social',
    acronyme: 'INSESO',

    branches: [
      {
        code:            'INSESO_SAL',
        libelle:         'INSESO — Retraite/AT/Santé/Maternité (part salarié)',
        taux_salarie:    0.045,    // 4,5% salarié — l'un des plus élevés CEMAC pour le salarié
        taux_patronal:   0,
        plafond_mensuel: null,     // Déplafonné (non documenté)
      },
      {
        code:            'INSESO_PAT',
        libelle:         'INSESO — Retraite/AT/Santé/Maternité (part patronale)',
        taux_salarie:    0,
        taux_patronal:   0.215,    // 21,5% patronal — le plus élevé CEMAC
        plafond_mensuel: null,
      },
    ],

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'pays.ts (estimé) — INSESO GQ : sal 4,5%, pat 21,5%, déplafonné',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI GQ — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI GQ — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI GQ',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI GQ',
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
      { seuil_heures_semaine: 40, majoration_pct: 0.25 },
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
    support_declarations_cnss:       false,   // INSESO GQ : documentation insuffisante
    support_declarations_fiscales:   false,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'estimated',
  loi_reference:        'CGI Guinée Équatoriale — source estimée pays.ts (bilingue FR/ES)',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'TVA 15% — taux le plus bas de la zone CEMAC',
    'INSESO patronal 21,5% — LE PLUS ÉLEVÉ de la zone CEMAC',
    'INSESO salarié 4,5% — également parmi les plus élevés CEMAC',
    'IRPF 4 tranches 0→25% · tranche 0% étendue jusqu\'à 1M FCFA annuel',
    'Pays bilingue FR/ES · secteur pétrolier dominant · réglementation hybride',
    '⚠️ Toutes données ESTIMÉES — documentation limitée en français sur CGI GQ',
  ],
}
