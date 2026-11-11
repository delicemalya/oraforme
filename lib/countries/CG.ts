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
 * IRPP Congo — reconstitué et validé contre bulletins réels ECAM Congo
 * (3 salariés, janvier 2024 — Mission P0 paie 2026-09-17) : base après CNSS
 * salarié, abattement 20%, division par le nombre de parts, barème 4 tranches
 * [0→38 667] 1% / [38 667→83 333] 10% / [83 333→250 000] 25% / [250 000→∞] 40%
 * par part, seuils mensuels = seuils annuels 464 000/1 000 000/3 000 000 ÷ 12
 * (methode_base = 'annuelle_div12'). Résultat vérifié exact à la FCFA près sur
 * les 3 bulletins (95 034,83 / 44 014,83 / 4 846,87). Le barème précédemment
 * codé ici (5 tranches avec une tranche 0% initiale, méthode mensuelle_directe)
 * ne reproduisait aucun de ces 3 bulletins — corrigé.
 *
 * CNSS/TUS Congo, juin 2026 (déclarations réelles CNSS/TUS, 20 salariés) :
 * PF 10,03% · AT/MP 2,25% · TUS CNSS 5,475%. Base CNSS/TUS = brut global −
 * indemnités (vérifié exact sur cas réel MOUTINOU MAYIMA J.P. : 887 213 −
 * 171 111 = 716 102). Composante « TUS DGI » (2,025% ou autre) NON DÉMONTRÉE
 * par aucun document primaire 2026 — non implémentée, voir taxes_abrogees.
 *
 * Plafonds CNSS 1 200 000 (VID/AF) et 600 000 (AT) : NON MODIFIÉS. Une
 * déclaration CNSS réelle de juin 2026 les ignore (base 716 102 non plafonnée
 * en pratique) alors qu'un bulletin interne de janvier 2024 plafonne
 * explicitement la ligne AF+AT à 600 000. Contradiction non résolue — voir
 * notes ci-dessous, marqué "À CONFIRMER".
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

    // Seuils exprimés en valeur annuelle par part, divisés par 12 par le moteur
    // (voir appliquerBareme() dans universal-tax-engine.ts). Vérifié exact
    // contre 3 bulletins réels ECAM Congo janvier 2024 — voir note en tête de
    // fichier. Remplace l'ancienne valeur 'mensuelle_directe', qui appliquait
    // les seuils sans division et ne reproduisait aucun bulletin réel.
    methode_base: 'annuelle_div12',

    // Abattement professionnel 20% sur (brut - CNSS salarié) — vérifié exact
    // sur 3 bulletins réels ECAM Congo janvier 2024 (formule confirmée :
    // base_imposable = (brut_imposable - cnss_salarie) × 0,80).
    abattement: {
      type:   'pct_net_cnss',
      valeur: 0.20,
    },

    quotient_familial: {
      actif:            true,
      parts_base:       1,     // 1 part (célibataire, 0 enfant)
      parts_marie:      1,     // +1 part si marié(e)
      parts_par_enfant: 0.5,   // +0,5 par enfant à charge
    },

    // Barème IRPP mensuel par part — 4 tranches, vérifiées exactes contre 3
    // bulletins réels ECAM Congo janvier 2024 (MOUTINOU MAYIMA J.P. 95 034,83 ·
    // ONDOUMA ASSIANGOULI J.G.M. 44 014,83 · IMANA Claude Christian 4 846,87).
    // Seuils = 464 000/1 000 000/3 000 000 ÷ 12 (méthode annuelle_div12) =
    // 38 667/83 333/250 000 par part et par mois. Aucune tranche 0% observée
    // dans les 3 bulletins : la première tranche taxe dès le premier FCFA à 1%.
    // La tranche 40% (au-delà de 250 000/part/mois) provient du modèle du
    // document source mais n'a été déclenchée par aucun des 3 bulletins testés.
    tranches: [
      { min: 0,         max: 464_000,   taux: 0.01, montant_fixe: null },  // 1%
      { min: 464_001,   max: 1_000_000, taux: 0.10, montant_fixe: null },  // 10%
      { min: 1_000_001, max: 3_000_000, taux: 0.25, montant_fixe: null },  // 25%
      { min: 3_000_001, max: Infinity,  taux: 0.40, montant_fixe: null },  // 40% — non observé dans les fixtures
    ],

    // Plancher d'IRPP pour salariés gagnant moins du SMIG — Art. 116G CGI Congo
    minimum_annuel: 1_200,   // 1 200 F/an = 100 F/mois quand brut < SMIG

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
        // PF 10,03% — vérifié exact contre CNSS_Cotisation_Fevrier_2026.docx
        // (20 salariés ECAM Congo) et déclaration CNSS juin 2026. Remplace
        // 10,035%, non observé dans aucun document réel.
        code:            'AF',
        libelle:         'Allocations Familiales (PF)',
        taux_salarie:    0,
        taux_patronal:   0.1003,        // 10,03% — plafonné 1 200 000 FCFA/mois
        // ⚠️ PLAFOND À CONFIRMER — voir note en tête de fichier : une
        // déclaration CNSS juin 2026 réelle NE plafonne PAS cette branche à
        // 1 200 000 en pratique (base observée 716 102, non plafonnée), alors
        // qu'un bulletin interne janvier 2024 la plafonne explicitement à
        // 600 000 (combinée avec AT). Valeur conservée sans modification tant
        // que la contradiction documentaire n'est pas tranchée juridiquement.
        plafond_mensuel: 1_200_000,
      },
      {
        code:            'AT',
        libelle:         'Accidents du Travail / Maladie Professionnelle',
        taux_salarie:    0,
        taux_patronal:   0.0225,        // 2,25% — plafonné 600 000 FCFA/mois
        // ⚠️ PLAFOND À CONFIRMER — même contradiction documentaire que AF ci-dessus.
        plafond_mensuel: 600_000,
      },
      {
        // TUS CNSS 5,475% — vérifié exact sur 20/20 lignes de la déclaration
        // CNSS/TUS réelle de juin 2026 (Model Declaration Mensuelle CNSS TUS).
        // Remplace 3%, non observé dans aucun document 2026. Une composante
        // distincte « TUS DGI » a existé par le passé (voir taxes_abrogees
        // ci-dessous) mais AUCUN document primaire 2026 ne prouve son taux ni
        // son maintien — elle n'est délibérément PAS ajoutée ici tant qu'aucune
        // preuve primaire n'est produite (STATUT = NON DÉTERMINÉ).
        code:            'TUS',
        libelle:         'Taxe Unique sur les Salaires (part CNSS)',
        taux_salarie:    0,
        taux_patronal:   0.05475,       // 5,475% — DÉPLAFONNÉ
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

  // ── Patente ────────────────────────────────────────────────────────────────
  // Barème déplacé depuis lib/declarations/patente.ts, valeur pour valeur.
  // Un module de déclaration ne doit pas détenir un barème : il le lit.
  //
  // ⚠️ Une seconde table, contradictoire, subsiste dans lib/fiscalite-congo.ts
  // (8 tranches, minimum de perception 97 500 F, annoncée « inchangée LF 2026 »).
  // Elle n'alimente aucun document et n'est donc pas la source retenue ici. Son
  // retrait relève de l'arbitrage des moteurs concurrents, pas de ce ticket.
  patente: {
    tranches: [
      { seuil_max:                1_000_000, type: 'forfait', montant: 10_000 },
      { seuil_min:     1_000_001, seuil_max:      20_000_000, taux: 0.0975  },
      { seuil_min:    20_000_001, seuil_max:      40_000_000, taux: 0.0065  },
      { seuil_min:    40_000_001, seuil_max:     100_000_000, taux: 0.0045  },
      { seuil_min:   100_000_001, seuil_max:     300_000_000, taux: 0.0020  },
      { seuil_min:   300_000_001, seuil_max:     500_000_000, taux: 0.0045  },
      { seuil_min:   500_000_001, seuil_max:   1_000_000_000, taux: 0.0014  },
      { seuil_min: 1_000_000_001, seuil_max:   3_000_000_000, taux: 0.00135 },
      { seuil_min: 3_000_000_001, seuil_max:  20_000_000_000, taux: 0.00125 },
      { seuil_min: 20_000_000_001,                            taux: 0.00045 },
    ],
    minimum_perception:         10_000,
    taux_centimes_additionnels: 0.05,
    taux_camu:                  0.005,
    taux_reduction_petroliere:  0.50,
    echeance:                   'avant le 31 mars de chaque année',
    source:                     'LF 2026 (loi n°42-2025 du 31 décembre 2025) — Art. 122 CGI Congo',
  },

  // ── Taxes abrogées ─────────────────────────────────────────────────────────
  // Une TUS fiscale distincte (4,5 % des salaires bruts, collectée par
  // l'administration fiscale/DGI) apparaît réellement dans des documents
  // internes ECAM Congo 2022/2023 (récapitulatifs de charges fiscales et
  // sociales), aux côtés d'une ligne « TUS recouvrée par la CNSS à 3 % »
  // — total 7,5 %. Ce code affirmait sa suppression par la LF 2026 ; AUCUN
  // document primaire 2026 fourni ne confirme ni le taux exact que porterait
  // une composante DGI en 2026, ni sa suppression effective (STATUT = NON
  // DÉTERMINÉ, Mission P0 paie 2026-09-17). Elle n'est PAS implémentée dans
  // la branche 'TUS' ci-dessus, qui ne porte que le taux CNSS 5,475% observé
  // sur la déclaration CNSS/TUS réelle de juin 2026. Conservée datée pour
  // qu'une déclaration portant sur une période où elle était incontestablement
  // en vigueur (avant 2026) reste calculable si un jour rejouée.
  taxes_abrogees: [
    {
      code:                  'TUS_FISCALE',
      libelle:               'Taxe Unique sur les Salaires — part fiscale (DGI) — statut 2026 non déterminé',
      base:                  'salaires_bruts',
      taux_avant_abrogation: 0.045,
      abrogee_le:            '2026-01-01',
      base_legale:           'LF 2026 (loi n°42-2025 du 31 décembre 2025) — suppression annoncée de la TUS fiscale, statut non confirmé par document primaire 2026 — voir commentaire ci-dessus',
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
    'CNSS salarié 4% VID (plaf. 1 200 000) · patronal VID 8% + PF 10,03% + AT/MP 2,25% + TUS 5,475% déplafonné',
    'IRPP : base après CNSS salarié, abattement 20%, division par le nombre de parts, barème 4 tranches par part — vérifié exact sur 3 bulletins réels ECAM Congo janvier 2024 (Mission P0 paie 2026-09-17)',
    'Plancher IRPP : 1 200 F/an si brut < SMIG (minimum_annuel, inchangé)',
    'Base CNSS/TUS = brut global − indemnités (vérifié exact, déclaration CNSS/TUS juin 2026, cas MOUTINOU MAYIMA J.P. : 887 213 − 171 111 = 716 102) — voir genererResumeFiscalMensuel()',
    'Mesure LF 2026 : État prend en charge IRPP + 50% patronal CNSS (25 000 premiers déclarants) — non activée',
    '⚠️ TUS DGI (composante fiscale distincte du TUS CNSS) : STATUT NON DÉTERMINÉ — aucun document primaire 2026 disponible ne la prouve ; non implémentée — voir taxes_abrogees',
    '⚠️ Plafonds CNSS 1 200 000 (VID/AF) et 600 000 (AT) : À CONFIRMER — contradiction non résolue entre une déclaration CNSS réelle juin 2026 (non plafonnée en pratique) et un bulletin interne janvier 2024 (plafonné) — voir commentaires sur les branches AF/AT ci-dessus. Valeurs conservées sans modification.',
    '⚠️ Plafonds exonération transport/logement : non documentés — À confirmer DGI Congo',
    '⚠️ TOL 1 000 F : article CGI exact à confirmer',
  ],
}
