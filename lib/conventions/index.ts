/**
 * lib/conventions/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRE CENTRAL — Conventions collectives pilotes Oraforme
 *
 * Ce fichier enregistre automatiquement les conventions pilotes au chargement.
 * Pour ajouter un pays ou un secteur : créer la convention et appeler registerConvention().
 *
 * CONVENTIONS PILOTES ENREGISTRÉES :
 *  1. CG:COMMERCE   — Congo-Brazzaville Commerce (pilote)
 *  2. CG:BTP        — Congo-Brazzaville BTP (pilote — règles plus favorables)
 *  3. CM:COMMERCE   — Cameroun Commerce (pilote)
 *
 * Ces conventions pilotes valident l'architecture multi-pays, multi-secteur.
 * Les données réelles seront chargées en Phase 2.2 après validation DGI.
 *
 * MULTI-FILIALES :
 *  Une filiale du groupe peut charger une convention différente en passant
 *  (codePays, codeSecteur) à getConvention(). Aucune modification du moteur requise.
 *
 * @module conventions
 * @since 2026-06-20
 */

import { registerConventions } from './convention-engine'
import type { Convention } from './types'

// ─── PILOTE 1 : Congo-Brazzaville — Commerce ─────────────────────────────────
// Architecture : 3 familles, 5 catégories, 3 échelons chacune
// Salaires : SMIG × (coefficient / 100)
// Ancienneté : 5%/3ans, plaf 25% (= Code du Travail)
// HS         : +15%/>40h, +50%/>48h (= Code du Travail)
// Primes      : Transport 15 000 F + Prime panier 1 000 F/jour

const CG_COMMERCE_PILOTE: Convention = {
  code:                  'CG_COMMERCE_PILOTE',
  code_pays:             'CG',
  code_secteur:          'COMMERCE',
  libelle:               'Convention Collective — Commerce Congo-Brazzaville (Pilote)',
  description:           'Convention pilote pour validation architecture. Données non vérifiées par les partenaires sociaux.',
  date_signature:        'PILOTE',
  date_entree_vigueur:   '2026-01-01',
  parties_signataires:   ['[À compléter : PATRONAT CG]', '[À compléter : SYNDICATS CG]'],

  sous_secteurs: [
    { code: 'COMMERCE_DETAIL',   libelle: 'Commerce de détail' },
    { code: 'COMMERCE_GROS',     libelle: 'Commerce de gros' },
    { code: 'IMPORT_EXPORT',     libelle: 'Import / Export' },
    { code: 'GRANDE_DISTRIBUTION', libelle: 'Grande distribution' },
  ],

  grille_salariale: {
    code_pays:                 'CG',
    code_secteur:              'COMMERCE',
    annee_validite:            2026,
    coefficient_base:          100,
    calcul_depuis_coefficient: true,   // salaire = SMIG × coeff / 100

    familles: [
      // ── Famille 1 : Personnel d'Exécution ──────────────────────────────────
      {
        code:    'EXEC',
        libelle: "Personnel d'Exécution",
        categories: [
          {
            code:    'I',
            libelle: 'Catégorie I — Agents sans qualification spéciale',
            niveau:  1,
            description: 'Manœuvres, agents de nettoyage, gardiens, agents polyvalents sans formation',
            echelons: [
              { code: 'A', libelle: 'Échelon A — Débutant (0-2 ans)',   coefficient: 100, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Échelon B — Confirmé (2-5 ans)',   coefficient: 110, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Échelon C — Senior (> 5 ans)',     coefficient: 120, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
          {
            code:    'II',
            libelle: 'Catégorie II — Agents qualifiés',
            niveau:  2,
            description: 'Vendeurs, caissiers, magasiniers avec CAP ou 2 ans d\'expérience',
            echelons: [
              { code: 'A', libelle: 'Échelon A — Débutant',   coefficient: 150, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Échelon B — Confirmé',   coefficient: 165, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Échelon C — Senior',     coefficient: 180, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [
              {
                code:        'P_CAISSE',
                libelle:     'Prime de responsabilité caisse',
                type:        'fixe',
                montant:     10_000,
                imposable:   true,
                periodicite: 'mensuel',
                conditions:  'si tenu de caisse',
                obligatoire: false,
              },
            ],
          },
        ],
      },

      // ── Famille 2 : Agents de Maîtrise ─────────────────────────────────────
      {
        code:    'MAITRISE',
        libelle: 'Agents de Maîtrise',
        categories: [
          {
            code:    'III',
            libelle: 'Catégorie III — Agents de maîtrise',
            niveau:  3,
            description: 'Chefs de rayon, chefs de caisse, responsables logistique Bac ou équivalent',
            echelons: [
              { code: 'A', libelle: 'Échelon A — Débutant', coefficient: 200, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Échelon B — Confirmé', coefficient: 225, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Échelon C — Senior',   coefficient: 250, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
        ],
      },

      // ── Famille 3 : Cadres ──────────────────────────────────────────────────
      {
        code:    'CADRES',
        libelle: 'Cadres',
        categories: [
          {
            code:    'IV',
            libelle: 'Catégorie IV — Cadres moyens',
            niveau:  4,
            description: 'Responsables de département, directeurs adjoints Bac+3 à Bac+5',
            echelons: [
              { code: 'A', libelle: 'Échelon A — Cadre débutant (Bac+3)', coefficient: 300, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Échelon B — Cadre confirmé (Bac+4)', coefficient: 340, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Échelon C — Cadre senior (Bac+5+)',  coefficient: 380, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
          {
            code:    'V',
            libelle: 'Catégorie V — Cadres supérieurs',
            niveau:  5,
            description: 'Directeurs de filiale, DG adjoint, directeurs régionaux Bac+5 + exp. significative',
            echelons: [
              { code: 'A', libelle: 'Directeur de service',  coefficient: 450, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Directeur de division', coefficient: 550, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Directeur général adj.', coefficient: 700, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
        ],
      },
    ],
  },

  primes_globales: [
    {
      code:        'P_TRANS_CONV',
      libelle:     'Prime de transport conventionnelle',
      type:        'fixe',
      montant:     15_000,
      imposable:   false,
      periodicite: 'mensuel',
      obligatoire: true,
      base_legale: 'Convention Commerce CG — Art. [à préciser]',
    },
    {
      code:        'P_PANIER',
      libelle:     'Prime de panier (indemnité repas)',
      type:        'par_jour',
      montant:     1_000,
      imposable:   false,
      periodicite: 'mensuel',
      conditions:  'si journée ≥ 8 heures',
      obligatoire: false,
    },
  ],

  regle_anciennete: {
    methode:              'taux_par_tranche',
    taux_par_tranche:     0.05,
    duree_tranche_ans:    3,
    plafond_pct:          0.25,
    base_calcul:          'salaire_base',
    plus_favorable_que_legal: false,   // identique au Code du Travail CG
    base_legale:          'Code du Travail Congo — loi 45-75',
  },

  regle_heures_sup: {
    tranches: [
      { seuil_heures_semaine: 40, majoration_pct: 0.15, description: '+15% au-delà de 40h/semaine' },
      { seuil_heures_semaine: 48, majoration_pct: 0.50, description: '+50% au-delà de 48h/semaine' },
    ],
    plus_favorable_que_legal: false,   // identique au Code du Travail CG
    base_legale:              'Code du Travail Congo',
  },

  avantages: [
    {
      code:        'CONG_ANNUEL',
      libelle:     'Congés annuels',
      description: '30 jours ouvrables par an (2,5 jours/mois)',
      type:        'temps',
      valeur:      30,
      unite:       'jours',
      conditions:  'après 12 mois de service',
      obligatoire: true,
      base_legale: 'Code du Travail Congo',
    },
    {
      code:        'CONG_MATERN',
      libelle:     'Congé maternité',
      description: '15 semaines payées à 100%',
      type:        'temps',
      valeur:      15,
      unite:       'semaines',
      conditions:  '',
      obligatoire: true,
      base_legale: 'Code du Travail Congo — Art. 118',
    },
  ],

  notes: [
    '⚠️ DONNÉES PILOTES — Non validées par les partenaires sociaux Congo',
    'Salaires calculés depuis SMIG × coefficient / 100',
    'SMIG Congo 2026 : 90 000 FCFA (Arrêté 2020 — à confirmer)',
    'Prime transport 15 000 FCFA/mois — montant à confirmer avec PATRONAT',
    'Grille coefficients : 100 → 700 (ratio 1× à 7× SMIG)',
  ],

  data_confidence: 'pilote',
}

// ─── PILOTE 2 : Congo-Brazzaville — BTP ──────────────────────────────────────
// Spécificités :
//   - Ancienneté 3%/AN (meilleure que Code Travail 5%/3ans)
//   - HS +20%/>40h, +60%/>48h (meilleure que Code Travail)
//   - Prime de risque chantier 15% salaire base
//   - Prime d'éloignement (si chantier hors Brazzaville)

const CG_BTP_PILOTE: Convention = {
  code:                  'CG_BTP_PILOTE',
  code_pays:             'CG',
  code_secteur:          'BTP',
  libelle:               'Convention Collective — Bâtiment et Travaux Publics Congo (Pilote)',
  description:           'Convention pilote BTP CG avec règles plus favorables que le Code du Travail.',
  date_signature:        'PILOTE',
  date_entree_vigueur:   '2026-01-01',
  parties_signataires:   ['[À compléter : FEPACI Congo]', '[À compléter : Syndicat BTP Congo]'],

  sous_secteurs: [
    { code: 'BATIMENT',  libelle: 'Bâtiment' },
    { code: 'TP',        libelle: 'Travaux Publics' },
    { code: 'GENIE_CIV', libelle: 'Génie Civil' },
    { code: 'MINES_BTP', libelle: 'Mines et BTP associé' },
  ],

  grille_salariale: {
    code_pays:                 'CG',
    code_secteur:              'BTP',
    annee_validite:            2026,
    coefficient_base:          100,
    calcul_depuis_coefficient: true,

    familles: [
      // ── Main d'œuvre ────────────────────────────────────────────────────────
      {
        code:    'MO',
        libelle: "Main d'œuvre",
        categories: [
          {
            code:    'O1',
            libelle: 'Ouvrier 1 — Sans qualification',
            niveau:  1,
            echelons: [
              { code: 'A', libelle: 'Manœuvre', coefficient: 100, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Aide maçon', coefficient: 112, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
          {
            code:    'O2',
            libelle: 'Ouvrier 2 — Qualifié (CAP)',
            niveau:  2,
            echelons: [
              { code: 'A', libelle: 'Maçon débutant',   coefficient: 140, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Maçon confirmé',   coefficient: 160, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Maçon qualifié P2', coefficient: 180, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [
              {
                code:        'P_RISQUE',
                libelle:     'Prime de risque chantier',
                type:        'pct_salaire_base',
                montant:     0.15,   // 15% du salaire de base
                imposable:   true,
                periodicite: 'mensuel',
                obligatoire: true,
                base_legale: 'Convention BTP CG — Art. [à préciser]',
              },
            ],
          },
          {
            code:    'O3',
            libelle: 'Ouvrier 3 — Très qualifié (BEP+)',
            niveau:  3,
            echelons: [
              { code: 'A', libelle: 'Chef d\'équipe débutant', coefficient: 200, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Chef d\'équipe confirmé', coefficient: 230, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Chef d\'équipe senior',   coefficient: 260, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [
              {
                code:        'P_RISQUE',
                libelle:     'Prime de risque chantier',
                type:        'pct_salaire_base',
                montant:     0.15,
                imposable:   true,
                periodicite: 'mensuel',
                obligatoire: true,
              },
            ],
          },
        ],
      },

      // ── Encadrement ─────────────────────────────────────────────────────────
      {
        code:    'ENCADREMENT',
        libelle: 'Encadrement technique',
        categories: [
          {
            code:    'T1',
            libelle: 'Technicien 1 — BTS / DUT',
            niveau:  4,
            echelons: [
              { code: 'A', libelle: 'Technicien débutant', coefficient: 280, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Technicien confirmé', coefficient: 320, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Technicien senior',   coefficient: 360, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
          {
            code:    'I1',
            libelle: 'Ingénieur — Bac+5',
            niveau:  5,
            echelons: [
              { code: 'A', libelle: 'Ingénieur débutant (0-3 ans)',  coefficient: 420, salaire_minimum_mensuel: 0 },
              { code: 'B', libelle: 'Ingénieur confirmé (3-8 ans)',  coefficient: 520, salaire_minimum_mensuel: 0 },
              { code: 'C', libelle: 'Ingénieur senior (> 8 ans)',    coefficient: 640, salaire_minimum_mensuel: 0 },
            ],
            primes_specifiques: [],
          },
        ],
      },
    ],
  },

  primes_globales: [
    {
      code:        'P_TRANS_BTP',
      libelle:     'Indemnité de transport BTP',
      type:        'fixe',
      montant:     20_000,
      imposable:   false,
      periodicite: 'mensuel',
      obligatoire: true,
    },
    {
      code:        'P_ELOIGNEMENT',
      libelle:     'Prime d\'éloignement (chantier > 50 km)',
      type:        'pct_salaire_base',
      montant:     0.25,
      imposable:   true,
      periodicite: 'mensuel',
      conditions:  'si chantier à plus de 50 km de Brazzaville',
      obligatoire: false,
    },
  ],

  // Ancienneté MEILLEURE que Code du Travail : 3%/an vs 5%/3ans ≈ 1.67%/an
  regle_anciennete: {
    methode:                  'taux_annuel',
    taux_annuel:              0.03,   // 3% par an
    plafond_pct:              0.30,   // plafond 30% (meilleur que 25% légal)
    base_calcul:              'salaire_base',
    plus_favorable_que_legal: true,
    base_legale:              'Convention BTP Congo — plus favorable que Code du Travail',
  },

  // HS MEILLEURES : +20% (vs +15% légal), +60% (vs +50% légal)
  regle_heures_sup: {
    tranches: [
      { seuil_heures_semaine: 40, majoration_pct: 0.20, description: '+20% au-delà de 40h/semaine (vs +15% légal)' },
      { seuil_heures_semaine: 48, majoration_pct: 0.60, description: '+60% au-delà de 48h/semaine (vs +50% légal)' },
    ],
    plus_favorable_que_legal: true,
    base_legale:              'Convention BTP Congo — plus favorable que Code du Travail',
  },

  avantages: [
    {
      code:        'EPI',
      libelle:     'Équipements de Protection Individuelle',
      description: 'Fourniture obligatoire : casque, gants, chaussures de sécurité',
      type:        'nature',
      conditions:  '',
      obligatoire: true,
    },
    {
      code:        'CONG_ANNUEL_BTP',
      libelle:     'Congés annuels BTP',
      description: '30 jours ouvrables par an (identique légal)',
      type:        'temps',
      valeur:      30,
      unite:       'jours',
      conditions:  'après 12 mois de service',
      obligatoire: true,
    },
  ],

  notes: [
    '⚠️ DONNÉES PILOTES — Non validées par les partenaires sociaux',
    'Ancienneté 3%/an (vs 5%/3ans légal) — plus favorable pour l\'employé',
    'HS +20%/>40h, +60%/>48h — plus favorable que Code du Travail',
    'Prime de risque 15% sur salaire de base pour ouvriers O2+',
    'Prime d\'éloignement +25% si chantier hors Brazzaville',
  ],

  data_confidence: 'pilote',
}

// ─── PILOTE 3 : Cameroun — Commerce ──────────────────────────────────────────
// Basé sur SMIG Cameroun (36 270 FCFA)
// HS Cameroun : +20%/>40h, +40%/>48h (différent de Congo)

const CM_COMMERCE_PILOTE: Convention = {
  code:                  'CM_COMMERCE_PILOTE',
  code_pays:             'CM',
  code_secteur:          'COMMERCE',
  libelle:               'Convention Collective — Commerce Cameroun (Pilote)',
  description:           'Convention pilote Commerce Cameroun. Données non validées.',
  date_signature:        'PILOTE',
  date_entree_vigueur:   '2026-01-01',
  parties_signataires:   ['[À compléter : GICAM]', '[À compléter : FKTU / CSTT]'],

  sous_secteurs: [
    { code: 'COMMERCE_DETAIL', libelle: 'Commerce de détail' },
    { code: 'COMMERCE_GROS',   libelle: 'Commerce de gros et distribution' },
  ],

  grille_salariale: {
    code_pays:                 'CM',
    code_secteur:              'COMMERCE',
    annee_validite:            2026,
    coefficient_base:          100,
    calcul_depuis_coefficient: true,   // SMIG CM × coeff / 100

    familles: [
      {
        code:    'EXEC_CM',
        libelle: "Personnel d'Exécution",
        categories: [
          {
            code:    'I',
            libelle: 'Catégorie I — Agents sans qualification',
            niveau:  1,
            echelons: [
              { code: 'A', libelle: 'Manœuvre',     coefficient: 100, salaire_minimum_mensuel: 0 },  // 36 270 FCFA
              { code: 'B', libelle: 'Agent qualif.', coefficient: 120, salaire_minimum_mensuel: 0 },  // 43 524 FCFA
            ],
            primes_specifiques: [],
          },
          {
            code:    'II',
            libelle: 'Catégorie II — Agents qualifiés',
            niveau:  2,
            echelons: [
              { code: 'A', libelle: 'Agent qualifié déb.', coefficient: 150, salaire_minimum_mensuel: 0 }, // 54 405 FCFA
              { code: 'B', libelle: 'Agent qualifié conf.', coefficient: 175, salaire_minimum_mensuel: 0 }, // 63 473 FCFA
              { code: 'C', libelle: 'Agent qualifié sen.',  coefficient: 200, salaire_minimum_mensuel: 0 }, // 72 540 FCFA
            ],
            primes_specifiques: [],
          },
          {
            code:    'III',
            libelle: 'Catégorie III — Agents de maîtrise',
            niveau:  3,
            echelons: [
              { code: 'A', libelle: 'Chef de rayon déb.', coefficient: 250, salaire_minimum_mensuel: 0 }, // 90 675 FCFA
              { code: 'B', libelle: 'Chef de rayon conf.', coefficient: 300, salaire_minimum_mensuel: 0 }, // 108 810 FCFA
              { code: 'C', libelle: 'Chef de département', coefficient: 380, salaire_minimum_mensuel: 0 }, // 137 826 FCFA
            ],
            primes_specifiques: [],
          },
        ],
      },
    ],
  },

  primes_globales: [
    {
      code:        'P_TRANS_CM',
      libelle:     'Prime de transport Cameroun',
      type:        'fixe',
      montant:     26_250,   // SMIG CM × 0.724 (approx conventionnel Cameroun)
      imposable:   false,
      periodicite: 'mensuel',
      obligatoire: true,
    },
    {
      code:        'TICKET_RESTO',
      libelle:     'Ticket restaurant',
      type:        'par_jour',
      montant:     500,
      imposable:   false,
      periodicite: 'mensuel',
      conditions:  'si journée complète travaillée',
      obligatoire: false,
    },
  ],

  // Ancienneté Cameroun : 5%/2ans (différent du Congo 5%/3ans), plaf 30%
  regle_anciennete: {
    methode:                  'taux_par_tranche',
    taux_par_tranche:         0.05,
    duree_tranche_ans:        2,     // Cameroun : 2 ans (pas 3 comme Congo)
    plafond_pct:              0.30,
    base_calcul:              'salaire_base',
    plus_favorable_que_legal: true,
    base_legale:              'Code du Travail Cameroun — Art. [à préciser]',
  },

  // HS Cameroun différentes du Congo (pas de convention plus favorable ici)
  regle_heures_sup: {
    tranches: [
      { seuil_heures_semaine: 40, majoration_pct: 0.20, description: '+20% > 40h (Cameroun Code Travail)' },
      { seuil_heures_semaine: 48, majoration_pct: 0.40, description: '+40% > 48h (Cameroun Code Travail)' },
    ],
    plus_favorable_que_legal: false,
    base_legale:              'Code du Travail Cameroun',
  },

  avantages: [
    {
      code:        'CONG_CM',
      libelle:     'Congés annuels Cameroun',
      description: '24 jours ouvrables par an minimum',
      type:        'temps',
      valeur:      24,
      unite:       'jours',
      conditions:  '',
      obligatoire: true,
    },
  ],

  notes: [
    '⚠️ DONNÉES PILOTES — Non validées GICAM / syndicats Cameroun',
    'Salaires basés sur SMIG Cameroun 2023 : 36 270 FCFA (à confirmer 2026)',
    'Ancienneté 5%/2ans (meilleure que Congo 5%/3ans)',
    'HS +20%/>40h, +40%/>48h — conforme Code du Travail Cameroun',
  ],

  data_confidence: 'pilote',
}

// ─── AUTO-ENREGISTREMENT ──────────────────────────────────────────────────────
// Les 3 conventions pilotes sont enregistrées au chargement de ce module.

registerConventions([
  CG_COMMERCE_PILOTE,
  CG_BTP_PILOTE,
  CM_COMMERCE_PILOTE,
])

// ─── RE-EXPORTS ───────────────────────────────────────────────────────────────

export {
  registerConvention,
  registerConventions,
  getConvention,
  getConventionOrThrow,
  listConventions,
  getCategorie,
  getEchelon,
  getCoefficient,
  calculerSalaireConventionnel,
  calculerPrimeConventionnelle,
  calculerAncienneteConventionnelle,
  calculerHeuresSupConventionnelles,
  verifierConformiteConvention,
  genererResumeConvention,
  getMIAAAuditConvention,
  getMIAAContexteConvention,
} from './convention-engine'

export type {
  Convention,
  Categorie,
  Echelon,
  FamilleProfessionnelle,
  SousSecteur,
  CodeSecteur,
  PrimeConventionnelle,
  TypePrime,
  RegleAnciennete,
  RegleHeuresSup,
  AvantageConventionnel,
  GrilleSalariale,
  ResultatSalaireConventionnel,
  ResultatPrimeConventionnelle,
  ResultatAncienneteConventionnelle,
  ResultatHeuresSupConventionnelles,
  AlerteConformite,
  ResultatConformite,
  ResumeConvention,
  MIAAAuditConvention,
  MIAAContexteConvention,
} from './types'

// Exports des conventions pilotes (pour tests et inspection)
export const PILOTES = {
  CG_COMMERCE: CG_COMMERCE_PILOTE,
  CG_BTP:      CG_BTP_PILOTE,
  CM_COMMERCE: CM_COMMERCE_PILOTE,
} as const
