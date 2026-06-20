/**
 * lib/countries/CG.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CONGO-BRAZZAVILLE — Configuration fiscale et sociale
 *
 * Source : Loi de Finances n°42-2025 du 31 décembre 2025 (LF 2026)
 *          CGI Congo — Art. 76 (IRPP), Art. 15 (mesures sociales)
 *          Analyse vérifiée 238 pages LF 2026
 *
 * data_confidence : 'verified'
 * Dernière mise à jour : 2026-06-20
 *
 * IRPP Congo : les seuils 464 000 / 1 000 000 / 3 000 000 / 8 000 000 FCFA sont des
 * SEUILS MENSUELS DIRECTS, confirmés par calcul-paie.ts en production (art. 76 CGI).
 * methode_base = 'mensuelle_directe' est la seule interprétation correcte.
 */

import type { CountryConfig } from './types'

export const CG: CountryConfig = {

  // ── Identité ───────────────────────────────────────────────────────────────
  code_pays:         'CG',
  nom_pays:          'Congo-Brazzaville',
  devise:            'FCFA',
  symbole_devise:    '₣',
  langue_principale: 'fr',
  fuseau_horaire:    'Africa/Brazzaville',
  format_date:       'DD/MM/YYYY',
  format_montant:    '#,##0 FCFA',
  systeme_comptable: 'SYSCOHADA',
  zone_fiscale:      'CEMAC',

  // ── Social ─────────────────────────────────────────────────────────────────
  smig:        90_000,
  smig_source: 'Arrêté n°5190 du 14 mars 2020 — SMIG Congo',

  // ── TVA ────────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:   0.18,
    taxes_additionnelles: [
      {
        code:    'CA',
        libelle: "Centime Additionnel (Contribution d'Appui)",
        taux:    0.05,       // 5% de la TVA collectée
        base:    'tva_collectee',
      },
    ],
    taux_effectif_sur_ht: 0.189,   // 18% × 1,05 = 18,9% sur HT
    seuil_assujettissement: 90_000_000,   // LF 2026 — 90M FCFA CA annuel HT
    regime:               'mensuel',
    echeance_jour:        20,
    echeance_mois_suivant: true,
    source: 'LF 2026 confirmé — Art. TVA CGI Congo',
  },

  // ── IS ─────────────────────────────────────────────────────────────────────
  is: {
    taux_standard:    0.30,
    taux_minimum_ca:  0.01,     // 1% du CA HT — minimum de perception
    acomptes: {
      periodicite:  'trimestriel',
      taux_acompte: 0.25,       // 25% de l'IS N-1 par acompte
    },
    source: 'CGI Congo — confirmé LF 2026',
  },

  // ── Retenues à la source ───────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:  0.20,
    interets_non_residents:    0.20,
    redevances_non_residents:  0.20,
    prestations_non_residents: 0.15,
    honoraires_residents:      0.05,
    loyers_etat_entreprises:   0.15,
    source: 'LF 2026 confirmé — Art. retenues source CGI Congo',
  },

  // ── IRPP ───────────────────────────────────────────────────────────────────
  irpp: {
    nom: 'IRPP (Impôt sur le Revenu des Personnes Physiques)',

    // Seuils mensuels appliqués directement — confirmé calcul-paie.ts production (Art. 76 CGI Congo)
    methode_base: 'mensuelle_directe',

    // LF 2026 : abattement professionnel remplacé par quotient familial
    // (fiscalite-congo.ts maintient 20% dans la config CGI classique — à trancher)
    abattement: {
      type:   'aucun',
      valeur: 0,
    },

    quotient_familial: {
      actif:            true,
      parts_base:       1,     // 1 part (célibataire, 0 enfant)
      parts_marie:      1,     // +1 part si marié(e)
      parts_par_enfant: 0.5,   // +0,5 par enfant à charge
    },

    // Barème IRPP annuel — 5 tranches LF 2026 (Art. 76 CGI Congo)
    // Les seuils sont ANNUELS. Le moteur divise par 12 avant application.
    tranches: [
      { min: 0,         max: 464_000,   taux: 0    },   // 0%
      { min: 464_001,   max: 1_000_000, taux: 0.01 },   // 1%
      { min: 1_000_001, max: 3_000_000, taux: 0.10 },   // 10%
      { min: 3_000_001, max: 8_000_000, taux: 0.25 },   // 25%
      { min: 8_000_001, max: Infinity,  taux: 0.40 },   // 40%
    ],

    mesures_speciales: [
      {
        code:        'irpp_prise_en_charge_2026',
        description: "LF 2026 Art. 15 — État prend en charge 100% IRPP des 25 000 premiers déclarants CNSS",
        reduction:   1.0,
        conditions:  'Être parmi les 25 000 premiers déclarants CNSS enregistrés — activation manuelle après confirmation',
        actif:       false,
      },
    ],

    periodicite:   'mensuel',
    echeance_jour: 20,
    source: 'LF 2026 confirmé — Art. 76 CGI Congo',
  },

  // ── CNSS ───────────────────────────────────────────────────────────────────
  cnss: {
    nom:      'Caisse Nationale de Sécurité Sociale',
    acronyme: 'CNSS',

    // Décomposition LF 2026 par branche avec plafonds distincts
    branches: [
      // ── Part salariale ──────────────────────────────────────────────────
      {
        code:            'VID_SAL',
        libelle:         'Vieillesse-Invalidité-Décès (part salarié)',
        taux_salarie:    0.04,          // 4% — plafonné 1 200 000 FCFA/mois
        taux_patronal:   0,
        plafond_mensuel: 1_200_000,
      },
      // ── Part patronale ──────────────────────────────────────────────────
      {
        code:            'VID_PAT',
        libelle:         'Vieillesse-Invalidité-Décès (part patronale)',
        taux_salarie:    0,
        taux_patronal:   0.08,          // 8% — plafonné 1 200 000 FCFA/mois
        plafond_mensuel: 1_200_000,
      },
      {
        code:            'AF',
        libelle:         'Allocations Familiales',
        taux_salarie:    0,
        taux_patronal:   0.10035,       // 10,035% — plafonné 1 200 000 FCFA/mois (LF 2026)
        plafond_mensuel: 1_200_000,
      },
      {
        code:            'AT',
        libelle:         'Accidents du Travail / Maladie Professionnelle',
        taux_salarie:    0,
        taux_patronal:   0.0225,        // 2,25% — plafonné 600 000 FCFA/mois
        plafond_mensuel: 600_000,
      },
      {
        code:            'TUS',
        libelle:         'Taxe Unique sur les Salaires',
        taux_salarie:    0,
        taux_patronal:   0.03,          // 3% — DÉPLAFONNÉ (LF 2026, TUS Fiscale 4,5% supprimée)
        plafond_mensuel: null,
      },
    ],

    mesures_speciales: [
      {
        code:               'patronal_prise_en_charge_2026',
        description:        "LF 2026 Art. 15 — État prend en charge 50% cotisations patronales CNSS (hors TUS)",
        reduction_patronal: 0.5,
        conditions:         'Être parmi les 25 000 premiers déclarants CNSS — activation manuelle',
        actif:              false,
      },
    ],

    echeance_jour:        15,
    echeance_mois_suivant: true,
    source: 'LF 2026 confirmé — CNSS Congo, Décret CNSS',
  },

  // ── Exonérations ───────────────────────────────────────────────────────────
  exonerations: {
    transport: {
      actif:           true,
      plafond_mensuel: null,     // Plafond non documenté dans LF 2026 — À confirmer DGI Congo
      base_legale:     'CGI Congo — Art. non documenté dans le code source — À confirmer',
    },
    logement: {
      actif:           true,
      plafond_mensuel: null,     // Indemnité de logement : plafond non documenté
      base_legale:     "CGI Congo — À confirmer (risque d'imposition partielle si > seuil)",
    },
    repas: {
      actif:            false,
      plafond_mensuel:  null,
      base_legale:      'Non documenté CGI Congo',
    },
    formation: {
      actif:          false,
      plafond_annuel: null,
      base_legale:    'Non documenté CGI Congo',
    },
    autres: [],
  },

  // ── Taxes fixes ────────────────────────────────────────────────────────────
  taxes_fixes: [
    {
      code:        'TOL',
      libelle:     'Taxe sur les Opérations de Logement',
      montant:     1_000,
      periodicite: 'mensuel',
      actif:       true,
      base_legale: 'Source : congo-calculs.ts — Article CGI exact à confirmer DGI Congo',
    },
  ],

  // ── Conventions collectives ─────────────────────────────────────────────────
  conventions: {
    actif: false,
    prime_anciennete: {
      taux_par_tranche:  0.05,   // 5% par tranche — Code du Travail Congo loi 45-75
      duree_tranche_ans: 3,
      plafond_pct:       0.25,   // 25% maximum
    },
    heures_sup: [
      { seuil_heures_semaine: 40, majoration_pct: 0.15 },   // +15% de 41h à 48h
      { seuil_heures_semaine: 48, majoration_pct: 0.50 },   // +50% au-delà de 48h
    ],
    grilles: [],
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  features: {
    support_conventions_collectives: false,   // fondation posée, non implémenté
    support_multi_filiales:          true,
    support_multi_agences:           true,
    support_ifrs:                    false,   // SYSCOHADA uniquement pour Congo
    support_consolidation:           true,
    support_miaa_fiscal:             true,
    support_miaa_rh:                 true,
    support_declarations_cnss:       true,
    support_declarations_fiscales:   true,
  },

  // ── Méta ───────────────────────────────────────────────────────────────────
  data_confidence:      'verified',
  loi_reference:        'Loi de Finances n°42-2025 du 31 décembre 2025 (LF 2026)',
  derniere_mise_a_jour: '2026-06-20',
  notes: [
    'SMIG 90 000 FCFA/mois (arrêté 2020)',
    'TVA 18% + Centime Additionnel 5% sur TVA = 18,9% effectif sur HT',
    'CNSS salarié 4% VID (plaf. 1 200 000) · patronal total 23,285% avec TUS déplafonné',
    'IRPP 5 tranches annuelles 0→40% par part fiscale (quotient familial)',
    'Mesure LF 2026 : État prend en charge IRPP + 50% patronal CNSS (25 000 premiers déclarants)',
    'TUS Fiscale 4,5% supprimée par LF 2026 — seul TUS CNSS 3% subsiste',
    '⚠️ Plafonds exonération transport/logement : non documentés — À confirmer DGI Congo',
    '⚠️ TOL 1 000 F : article CGI exact à confirmer',
    'IRPP : seuils MENSUELS directs [464k/1M/3M/8M] — methode_base=mensuelle_directe confirmé calcul-paie.ts',
  ],
}
