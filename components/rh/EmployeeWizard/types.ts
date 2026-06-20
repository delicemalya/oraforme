import type { CodePays } from '@/lib/countries/types'

export interface PrimeEmploye {
  id?:           string
  code:          string
  nom:           string
  categorie:     'rh' | 'logistique' | 'social' | 'technique' | 'commercial' | 'medical' | 'personnalise'
  montant:       number
  type:          'fixe' | 'pct_brut' | 'pct_base'
  periodicite:   'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel'
  imposable:     boolean
  soumis_cnss:   boolean
  soumis_irpp:   boolean
  conventionnelle: boolean
}

export interface AvantageNature {
  id?:               string
  type:              'logement' | 'vehicule' | 'carburant' | 'telephone' | 'internet' | 'nourriture' | 'assurance_sante' | 'assurance_vie' | 'autre'
  libelle:           string
  valeur:            number
  imposable:         boolean
  soumis_cotisations: boolean
}

export interface DossierEmploye {
  codePays: CodePays

  // A — Identité
  nom:                   string
  sexe:                  string
  date_naissance:        string
  lieu_naissance:        string
  nationalite:           string
  situation_matrimoniale: string
  nb_enfants:            number
  photo_url:             string
  signature_url:         string

  // B — Coordonnées
  adresse:               string
  pays:                  string
  region:                string
  ville:                 string
  quartier:              string
  telephone:             string
  telephone2:            string
  email_personnel:       string
  email_pro:             string
  contact_urgence_nom:   string
  contact_urgence_tel:   string

  // C — Contrat
  contrat:               string
  date_recrutement:      string
  date_debut_contrat:    string
  date_fin_contrat:      string
  periode_essai:         string
  statut:                string
  motif_sortie:          string

  // D — Organisation
  filiale:               string
  agence:                string
  direction:             string
  departement:           string
  service:               string
  equipe:                string
  manager_id:            string
  site_travail:          string

  // E — Poste
  poste:                 string
  metier:                string
  famille_metier:        string
  niveau_hierarchique:   string
  categorie_convention:  string
  echelon:               string
  grade:                 string
  coefficient:           string
  code_secteur:          string

  // F — Salaire
  salaire_base:          number
  salaire_conventionnel: number

  // G — Primes
  primes: PrimeEmploye[]

  // H — Avantages en nature
  avantages: AvantageNature[]

  // I — CNSS
  numero_cnss:           string
  numero_cnss_centre:    string

  // J — Fiscalité
  numero_fiscal:         string
  pays_fiscal:           string
  residence_fiscale:     string

  // K — Banque
  mode_paiement:         string
  banque:                string
  rib:                   string
  iban:                  string
  swift:                 string
  mobile_money_type:     string
  mobile_money_numero:   string

  // M — Médical
  groupe_sanguin:        string
  allergies:             string
  handicap:              boolean
  medecin_traitant:      string
  date_visite_medicale:  string
}

export const DOSSIER_INIT: DossierEmploye = {
  codePays: 'CG',
  nom: '', sexe: '', date_naissance: '', lieu_naissance: '', nationalite: '',
  situation_matrimoniale: 'celibataire', nb_enfants: 0, photo_url: '', signature_url: '',
  adresse: '', pays: '', region: '', ville: '', quartier: '',
  telephone: '', telephone2: '', email_personnel: '', email_pro: '',
  contact_urgence_nom: '', contact_urgence_tel: '',
  contrat: 'cdi', date_recrutement: '', date_debut_contrat: '', date_fin_contrat: '',
  periode_essai: '', statut: 'actif', motif_sortie: '',
  filiale: '', agence: '', direction: '', departement: '', service: '', equipe: '',
  manager_id: '', site_travail: '',
  poste: '', metier: '', famille_metier: '', niveau_hierarchique: '', categorie_convention: '',
  echelon: '', grade: '', coefficient: '', code_secteur: '',
  salaire_base: 0, salaire_conventionnel: 0,
  primes: [], avantages: [],
  numero_cnss: '', numero_cnss_centre: '',
  numero_fiscal: '', pays_fiscal: '', residence_fiscale: '',
  mode_paiement: 'banque', banque: '', rib: '', iban: '', swift: '',
  mobile_money_type: '', mobile_money_numero: '',
  groupe_sanguin: '', allergies: '', handicap: false,
  medecin_traitant: '', date_visite_medicale: '',
}

// Bibliothèque de primes standard — montant 0 par défaut (utilisateur saisit)
export const PRIMES_CATALOGUE: Omit<PrimeEmploye, 'montant'>[] = [
  // RH
  { code: 'anciennete',      nom: 'Prime d\'ancienneté',       categorie: 'rh',         type: 'pct_base', periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: true  },
  { code: 'responsabilite',  nom: 'Prime de responsabilité',   categorie: 'rh',         type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'rendement',       nom: 'Prime de rendement',        categorie: 'rh',         type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'performance',     nom: 'Prime de performance',      categorie: 'rh',         type: 'pct_brut', periodicite: 'trimestriel', imposable: true, soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'assiduite',       nom: 'Prime d\'assiduité',        categorie: 'rh',         type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'fidelite',        nom: 'Prime de fidélité',         categorie: 'rh',         type: 'fixe',     periodicite: 'annuel',    imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  // Logistique
  { code: 'transport',       nom: 'Prime de transport',        categorie: 'logistique', type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: true  },
  { code: 'carburant',       nom: 'Indemnité carburant',       categorie: 'logistique', type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  { code: 'mission',         nom: 'Indemnité de mission',      categorie: 'logistique', type: 'fixe',     periodicite: 'ponctuel',  imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  { code: 'deplacement',     nom: 'Frais de déplacement',      categorie: 'logistique', type: 'fixe',     periodicite: 'ponctuel',  imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  // Social
  { code: 'logement',        nom: 'Prime de logement',         categorie: 'social',     type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: true  },
  { code: 'panier',          nom: 'Indemnité panier',          categorie: 'social',     type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  { code: 'restauration',    nom: 'Indemnité de restauration', categorie: 'social',     type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  { code: 'famille',         nom: 'Allocation familiale',      categorie: 'social',     type: 'fixe',     periodicite: 'mensuel',   imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: true  },
  { code: 'scolarite',       nom: 'Allocation scolarité',      categorie: 'social',     type: 'fixe',     periodicite: 'annuel',    imposable: false, soumis_cnss: false, soumis_irpp: false, conventionnelle: false },
  // Technique
  { code: 'risque',          nom: 'Prime de risque',           categorie: 'technique',  type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: true  },
  { code: 'danger',          nom: 'Prime de danger',           categorie: 'technique',  type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: true  },
  { code: 'chantier',        nom: 'Indemnité chantier',        categorie: 'technique',  type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'astreinte',       nom: 'Prime d\'astreinte',        categorie: 'technique',  type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  // Commercial
  { code: 'commission',      nom: 'Commission',                categorie: 'commercial', type: 'pct_brut', periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'portefeuille',    nom: 'Prime portefeuille',        categorie: 'commercial', type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  // Médical
  { code: 'garde',           nom: 'Indemnité de garde',        categorie: 'medical',    type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: true  },
  { code: 'permanence',      nom: 'Prime de permanence',       categorie: 'medical',    type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
  { code: 'urgence_med',     nom: 'Prime urgence médicale',    categorie: 'medical',    type: 'fixe',     periodicite: 'mensuel',   imposable: true,  soumis_cnss: true,  soumis_irpp: true,  conventionnelle: false },
]

export const CATEGORIES_PRIMES: { code: PrimeEmploye['categorie']; label: string; emoji: string }[] = [
  { code: 'rh',          label: 'RH',         emoji: '👥' },
  { code: 'logistique',  label: 'Logistique', emoji: '🚗' },
  { code: 'social',      label: 'Social',     emoji: '🏠' },
  { code: 'technique',   label: 'Technique',  emoji: '⚙️' },
  { code: 'commercial',  label: 'Commercial', emoji: '💰' },
  { code: 'medical',     label: 'Médical',    emoji: '🏥' },
  { code: 'personnalise',label: 'Personnalisé', emoji: '✏️' },
]

export const AVANTAGES_CATALOGUE: { type: AvantageNature['type']; label: string; emoji: string }[] = [
  { type: 'logement',        label: 'Logement de fonction',  emoji: '🏠' },
  { type: 'vehicule',        label: 'Véhicule de fonction',  emoji: '🚗' },
  { type: 'carburant',       label: 'Carburant',             emoji: '⛽' },
  { type: 'telephone',       label: 'Téléphone',             emoji: '📱' },
  { type: 'internet',        label: 'Internet / Forfait',    emoji: '📶' },
  { type: 'nourriture',      label: 'Nourriture / Repas',    emoji: '🍽️' },
  { type: 'assurance_sante', label: 'Assurance santé',       emoji: '🏥' },
  { type: 'assurance_vie',   label: 'Assurance vie',         emoji: '🛡️' },
  { type: 'autre',           label: 'Autre avantage',        emoji: '🎁' },
]
