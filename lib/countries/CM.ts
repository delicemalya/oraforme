/**
 * lib/countries/CM.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMEROUN — Configuration fiscale et sociale
 *
 * Sources : Central Africa Tax Guide 2023 · CGI Cameroun Art. 17, 17bis, 17quater
 *           fiscalite-cameroun.ts (source interne vérifiée)
 *           pays.ts (source interne — divergences notées)
 *
 * data_confidence : 'to_verify'
 * ⚠️ Divergences entre sources internes sur IRPP tranches et charges patronales
 * ⚠️ LF 2026 Cameroun à vérifier avant mise en production
 *
 * Dernière mise à jour : 2026-06-20
 */

import type { CountryConfig } from './types'

export const CM: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'CM',
  nom_pays:          'Cameroun',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Douala',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        36_270,     // SMIG Cameroun 2023 (à confirmer)
  smig_source: 'SMIG Cameroun — Décret 2023 (à confirmer)',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:          0.1925,  // 19,25% — taux officiel LF Cameroun (17,5% + CAC 10% sur TVA intégré)
    taxes_additionnelles: [],      // CAC intégré dans taux_normal — évite double-calcul dans les moteurs
    taux_effectif_sur_ht: 0.1925,
    seuil_assujettissement: 50_000_000,
    regime:               'mensuel',
    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'LF Cameroun — TVA 19,25% (CGI Art. 137 : 17,5% + CAC 10% sur TVA) — Central Africa Tax Guide 2023',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard:    0.30,
    taxes_additionnelles: [
      {
        code:    'CAC_IS',
        libelle: 'Centimes Additionnels Communaux sur IS (10%)',
        taux:    0.10,
        base:    'is_calcule',   // CAC = 10% de l'IS calculé → IS effectif = 30% × 1,10 = 33%
      },
    ],
    source: 'CGI Cameroun — IS 30% + CAC 10% = 33% effectif',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.15,
    interets_non_residents:    0.15,
    redevances_non_residents:  0.15,
    prestations_non_residents: 0.15,
    source: 'CGI Cameroun — retenues source estimées, à confirmer',
  },

  // ── IRPP ───────────────────────────────────────────────────────────────────
  irpp: {
    nom: 'IRPP (Impôt sur le Revenu des Personnes Physiques)',

    // Seuils annuels — méthode de base à confirmer pour Cameroun
    methode_base: 'annuelle_div12',

    // Abattement professionnel 30% sur revenu imposable
    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.30,
    },

    // Quotient familial non documenté dans CGI Cameroun — utilise déductions forfaitaires
    quotient_familial: {
      actif:            false,
      parts_base:       1,
      parts_marie:      0,
      parts_par_enfant: 0,
    },

    // Barème IRPP Cameroun — Source : fiscalite-cameroun.ts (Central Africa Tax Guide 2023)
    // ⚠️ Discordance avec pays.ts (5 tranches vs 4) — source fiscalite-cameroun.ts retenue (plus récente)
    tranches: [
      { min: 0,          max: 2_000_000, taux: 0.10 },   // 10%
      { min: 2_000_001,  max: 3_000_000, taux: 0.15 },   // 15%
      { min: 3_000_001,  max: 5_000_000, taux: 0.25 },   // 25%
      { min: 5_000_001,  max: Infinity,  taux: 0.35 },   // 35%
    ],

    centimes_additionnels: 0.10,   // CAC 10% sur IRPP calculé

    periodicite:   'mensuel',
    echeance_jour: 15,
    source: 'Central Africa Tax Guide 2023 · CGI Cameroun Art. 17 — ⚠️ À confirmer LF 2026',
  },

  // ── CNSS ───────────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Caisse Nationale de Prévoyance Sociale',
    acronyme: 'CNPS',

    // Branches CNPS + prélèvements para-fiscaux obligatoires
    branches: [
      {
        code:            'CNPS_SAL',
        libelle:         'CNPS — Vieillesse/AT/AF (part salarié)',
        taux_salarie:    0.042,         // 4,2% — plafonné 750 000 FCFA/mois
        taux_patronal:   0,
        plafond_mensuel: 750_000,
      },
      {
        code:            'CNPS_PAT',
        libelle:         'CNPS — Vieillesse/AT/AF (part patronale)',
        taux_salarie:    0,
        taux_patronal:   0.112,         // 11,2% VID+AT+AF — plafonné 750 000 FCFA/mois
        plafond_mensuel: 750_000,
      },
      {
        code:            'CFC_SAL',
        libelle:         'Crédit Foncier du Cameroun (part salarié)',
        taux_salarie:    0.01,          // 1% — déplafonné
        taux_patronal:   0,
        plafond_mensuel: null,
      },
      {
        code:            'CFC_PAT',
        libelle:         'Crédit Foncier du Cameroun (part patronale)',
        taux_salarie:    0,
        taux_patronal:   0.015,         // 1,5% — déplafonné
        plafond_mensuel: null,
      },
      {
        code:            'FNE',
        libelle:         'Fonds National de l\'Emploi',
        taux_salarie:    0,
        taux_patronal:   0.01,          // 1% patronal — déplafonné (⚠️ pays.ts dit 3%)
        plafond_mensuel: null,
      },
    ],

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'CNPS Cameroun + DGI Cameroun — Central Africa Tax Guide 2023',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Cameroun — à préciser',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,
      base_legale:     'CGI Cameroun — à préciser',
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI Cameroun',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI Cameroun',
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
      duree_tranche_ans: 2,
      plafond_pct:       0.30,
    },
    heures_sup: [
      { seuil_heures_semaine: 40, majoration_pct: 0.20 },
      { seuil_heures_semaine: 48, majoration_pct: 0.40 },
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
  loi_reference:        'CGI Cameroun 2023 · LF 2026 à confirmer',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'TVA 19,25% (taux officiel LF Cameroun = 17,5% + CAC 10% sur TVA intégré dans taux_normal)',
    'CNPS sal 4,2% + CFC 1% = 5,2% · pat CNPS 11,2% + CFC 1,5% + FNE 1% = 13,7%',
    '⚠️ Discordance pays.ts (pat 17,2%) vs sources CNPS (13,7%) — à vérifier',
    'IRPP : 4 tranches 10→35% + CAC 10% sur IRPP · abattement 30%',
    '⚠️ Discordance tranches IRPP : pays.ts (5 tranches) vs fiscalite-cameroun.ts (4 tranches) — tranches à 4 retenues',
    '⚠️ LF 2026 Cameroun : vérifier modifications IRPP/TVA avant mise en production',
    'SMIG Cameroun 2023 : 36 270 FCFA — à confirmer 2026',
  ],
}
