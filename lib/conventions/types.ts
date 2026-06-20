/**
 * lib/conventions/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TYPES — ConventionEngine Universel Oraforme Phase 2.1
 *
 * Hiérarchie :
 *   Convention
 *     └─ GrilleSalariale
 *           └─ FamilleProfessionnelle[]
 *                 └─ Categorie[]
 *                       └─ Echelon[]      (coefficient, salaire_minimum)
 *     └─ primes_globales[]               (toutes catégories)
 *     └─ regle_anciennete                (légale ou mieux)
 *     └─ regle_heures_sup                (légale ou mieux)
 *     └─ avantages[]                     (avantages en nature / temps)
 *
 * RÈGLES :
 *  - Aucune valeur hardcodée dans les types
 *  - Toutes valeurs fiscales via CountryConfig (UniversalTaxEngine)
 *  - Compatible : CG · CM · GA · CD · CF · TD · GQ
 *  - Extensible : France, Belgique, Sénégal, Côte d'Ivoire, Maroc
 *
 * @module convention-types
 * @since 2026-06-20
 */

import type { CodePays, DataConfidence } from '@/lib/countries'

export type { CodePays, DataConfidence }

// ─── Secteurs professionnels ──────────────────────────────────────────────────

export type CodeSecteur =
  | 'COMMERCE'
  | 'INDUSTRIE'
  | 'BTP'
  | 'TRANSPORT'
  | 'LOGISTIQUE'
  | 'BANQUE'
  | 'ASSURANCE'
  | 'TELECOM'
  | 'EDUCATION'
  | 'UNIVERSITE'
  | 'SANTE'
  | 'CLINIQUE'
  | 'HOPITAL'
  | 'CABINET_RH'
  | 'CABINET_COMPTABLE'
  | 'CABINET_JURIDIQUE'
  | 'HOTELLERIE'
  | 'RESTAURATION'
  | 'IMPORT_EXPORT'
  | 'ONG'
  | 'ADMINISTRATION'
  | 'AGRICULTURE'
  | 'MINES'
  | 'PETROLE'

/** Descripteur d'un sous-secteur d'activité (informatif — pas de données salariales). */
export interface SousSecteur {
  code:    string
  libelle: string
  notes?:  string
}

// ─── Grille salariale ─────────────────────────────────────────────────────────

/**
 * Échelon dans une catégorie.
 * Le salaire_minimum est : coefficient × base_salaire / coefficient_base
 * (calcul effectué par le moteur si salaire_minimum = 0 → calcul auto).
 */
export interface Echelon {
  code:                    string   // 'A' | 'B' | 'C' | '1' | '2' | ...
  libelle:                 string
  coefficient:             number   // ex: 150
  salaire_minimum_mensuel: number   // FCFA — 0 = calculé depuis coefficient
  exigences?:              string   // ex: 'CAP ou 2 ans d'expérience'
}

/** Catégorie professionnelle (ex: Catégorie I, II, III ou A, B, C). */
export interface Categorie {
  code:                string   // 'I' | 'II' | 'CAD_MOY' | 'OUVRIER' | ...
  libelle:             string
  niveau:              number   // 1, 2, 3... pour tri et comparaison
  description?:        string
  echelons:            Echelon[]
  primes_specifiques:  PrimeConventionnelle[]   // primes propres à cette catégorie
}

/** Famille professionnelle (ex: Personnel d'Exécution, Cadres). */
export interface FamilleProfessionnelle {
  code:       string
  libelle:    string
  categories: Categorie[]
}

/**
 * Grille salariale complète d'une convention.
 * Si calcul_depuis_coefficient = true :
 *   salaire_minimum = smig × (coefficient / coefficient_base)
 * Sinon : salaire_minimum est directement dans chaque Échelon.
 */
export interface GrilleSalariale {
  code_pays:                   CodePays
  code_secteur:                CodeSecteur
  annee_validite:              number
  coefficient_base:            number   // coefficient de référence (Cat. la plus basse)
  calcul_depuis_coefficient:   boolean
  familles:                    FamilleProfessionnelle[]
}

// ─── Primes conventionnelles ──────────────────────────────────────────────────

export type TypePrime =
  | 'fixe'               // montant fixe mensuel en FCFA
  | 'pct_salaire_base'   // % du salaire de base
  | 'pct_salaire_brut'   // % du salaire brut imposable
  | 'par_jour'           // montant × jours travaillés
  | 'par_unite'          // montant × unités produites / prestations

export interface PrimeConventionnelle {
  code:        string
  libelle:     string
  type:        TypePrime
  montant:     number    // valeur ou taux selon type (ex: 0.15 = 15% si pct_*)
  imposable:   boolean
  periodicite: 'mensuel' | 'annuel' | 'conditionnel'
  conditions?: string    // ex: 'si présence ≥ 20 jours'
  obligatoire: boolean
  base_legale?: string
}

// ─── Règles d'ancienneté ─────────────────────────────────────────────────────

export type MethodeAnciennete =
  | 'taux_annuel'       // X% par an (Congo BTP type)
  | 'taux_par_tranche'  // X% par tranche de N ans (Code Travail CEMAC type)
  | 'grille_fixe'       // montants fixes par palier d'années

export interface RegleAnciennete {
  methode:               MethodeAnciennete
  taux_annuel?:          number   // pour taux_annuel (ex: 0.03 = 3%/an)
  taux_par_tranche?:     number   // pour taux_par_tranche (ex: 0.05 = 5%/tranche)
  duree_tranche_ans?:    number   // ex: 3 = tous les 3 ans
  grille_fixe?:          Array<{ annees_min: number; montant_ou_pct: number; est_pct: boolean }>
  plafond_pct:           number   // plafond maximum (ex: 0.25 = 25%)
  base_calcul:           'salaire_base' | 'salaire_brut_imposable'
  plus_favorable_que_legal: boolean   // si true, remplace la règle légale Code Travail
  base_legale:           string
}

// ─── Règles d'heures supplémentaires ─────────────────────────────────────────

export interface TrancheHeuresSup {
  seuil_heures_semaine:  number
  majoration_pct:        number   // ex: 0.20 = +20%
  description:           string   // ex: '> 40h/semaine — heures normales supplémentaires'
}

export interface RegleHeuresSup {
  tranches:                 TrancheHeuresSup[]
  plus_favorable_que_legal: boolean
  base_legale:              string
}

// ─── Avantages conventionnels ─────────────────────────────────────────────────

export type TypeAvantage = 'monetaire' | 'temps' | 'nature' | 'formation' | 'sante'

export interface AvantageConventionnel {
  code:        string
  libelle:     string
  description: string
  type:        TypeAvantage
  valeur?:     number
  unite?:      string   // 'FCFA' | 'jours' | 'heures' | '%'
  conditions:  string
  obligatoire: boolean
  base_legale?: string
}

// ─── Convention — entité maître ───────────────────────────────────────────────

export type DataConfidenceConvention = 'pilote' | 'to_verify' | 'verified'

/**
 * Convention collective sectorielle.
 *
 * Une convention est identifiée par (code_pays, code_secteur).
 * La grille salariale contient toute la hiérarchie catégories/échelons.
 *
 * MULTI-PAYS : même structure, données différentes par pays.
 * MULTI-FILIALES : une filiale peut référencer n'importe quelle convention.
 */
export interface Convention {
  code:                  string       // 'CG_COMMERCE_PILOTE', 'CG_BTP_PILOTE'...
  code_pays:             CodePays
  code_secteur:          CodeSecteur
  libelle:               string
  description:           string
  date_signature:        string       // 'YYYY-MM-DD' ou 'PILOTE'
  date_entree_vigueur:   string
  date_expiration?:      string
  parties_signataires:   string[]

  sous_secteurs:         SousSecteur[]        // sous-secteurs couverts (descriptif)
  grille_salariale:      GrilleSalariale      // catégories, échelons, coefficients
  primes_globales:       PrimeConventionnelle[] // applicables à toutes les catégories
  regle_anciennete:      RegleAnciennete
  regle_heures_sup:      RegleHeuresSup
  avantages:             AvantageConventionnel[]

  notes:                 string[]
  data_confidence:       DataConfidenceConvention
}

// ─── Résultats des fonctions du moteur ───────────────────────────────────────

export interface ResultatSalaireConventionnel {
  code_pays:       CodePays
  code_secteur:    CodeSecteur
  code_categorie:  string
  code_echelon:    string
  libelle_categorie: string
  libelle_echelon: string
  coefficient:     number
  coefficient_base: number
  smig_utilise:    number
  salaire_minimum: number
  methode:         'coefficient_smig' | 'grille_directe'
  source:          string
}

export interface ResultatPrimeConventionnelle {
  code:        string
  libelle:     string
  type:        TypePrime
  base_calcul: number   // valeur sur laquelle le montant est calculé
  montant:     number
  imposable:   boolean
  obligatoire: boolean
}

export interface ResultatAncienneteConventionnelle {
  date_entree:            string
  periode_de_calcul:      string
  annees_completes:       number
  montant_legal:          number   // selon Code du Travail
  montant_conventionnel:  number   // selon convention
  montant_applique:       number   // max(legal, conventionnel)
  taux_applique:          number
  regle_utilisee:         'legal' | 'conventionnel'
  methode_convention:     MethodeAnciennete
  prochain_palier_dans_ans: number
}

export interface ResultatHeuresSupConventionnelles {
  heures:                 number
  taux_horaire_base:      number
  detail_legal:           Array<{ seuil: number; pct: number; h: number; montant: number }>
  detail_conventionnel:   Array<{ seuil: number; pct: number; h: number; montant: number }>
  montant_legal:          number
  montant_conventionnel:  number
  montant_applique:       number
  regle_utilisee:         'legal' | 'conventionnel'
}

export interface AlerteConformite {
  code:        string
  severite:    'bloquant' | 'avertissement' | 'information'
  message:     string
  valeur_actuelle?:  number
  valeur_requise?:   number
  ecart?:            number
}

export interface ResultatConformite {
  conforme:                boolean
  salaire_minimum_requis:  number
  salaire_actuel:          number
  ecart_salaire:           number   // salaire_actuel - minimum (négatif = non conforme)
  alertes:                 AlerteConformite[]
  primes_manquantes:       PrimeConventionnelle[]
  recommandations:         string[]
}

export interface ResumeConvention {
  code_pays:             CodePays
  code_secteur:          CodeSecteur
  convention:            string   // code convention appliquée
  periode:               string
  employe_id:            string
  categorie:             string
  echelon:               string
  salaire_conventionnel: ResultatSalaireConventionnel
  anciennete:            ResultatAncienneteConventionnelle
  heures_sup?:           ResultatHeuresSupConventionnelles
  primes:                ResultatPrimeConventionnelle[]
  conformite:            ResultatConformite
  avantages_applicables: AvantageConventionnel[]
  genere_le:             string
}

// ─── Types MIAA+ (points d'entrée futurs) ────────────────────────────────────

/** Résumé d'audit convention — prêt pour MIAA+ Audit RH. */
export interface MIAAAuditConvention {
  code_pays:            CodePays
  code_secteur:         CodeSecteur
  convention:           string
  nb_employes:          number
  nb_conformes:         number
  nb_non_conformes:     number
  taux_conformite_pct:  number
  masse_regularisation: number   // montant total à régulariser
  alertes_prioritaires: AlerteConformite[]
  recommandations_ia:   string[]   // emplacement pour futures recommandations MIAA+
}

/** Contexte convention — prêt pour MIAA+ Formation et Recrutement. */
export interface MIAAContexteConvention {
  code_pays:         CodePays
  code_secteur:      CodeSecteur
  convention:        string
  grille_simplifiee: Array<{
    categorie: string
    echelon:   string
    salaire_minimum: number
    coefficient: number
  }>
  primes_obligatoires: PrimeConventionnelle[]
  avantages:           AvantageConventionnel[]
}
