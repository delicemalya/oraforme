/**
 * lib/countries/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FONDATION UNIVERSELLE — CountryConfig
 *
 * Architecture cible Oraforme : une seule interface, N pays.
 * Ajouter un pays = remplir un objet de config.
 * Aucune logique métier ici — uniquement des structures de données.
 *
 * Consommateurs futurs :
 *   UniversalPayrollEngine   (lib/payroll/engine.ts)
 *   UniversalTaxEngine       (lib/tax/engine.ts)
 *   ConventionEngine         (lib/convention/engine.ts)
 *   MIAA+ fiscal             (app/api/miaa/*)
 *   Toutes les pages RH, Fiscalité, Paie, Recrutement
 */

// ─── Identifiants pays supportés ─────────────────────────────────────────────

export type CodePays =
  | 'CG'  // Congo-Brazzaville
  | 'CM'  // Cameroun
  | 'GA'  // Gabon
  | 'CD'  // RD Congo (Kinshasa)
  | 'CF'  // Centrafrique
  | 'TD'  // Tchad
  | 'GQ'  // Guinée Équatoriale
  | 'AO'  // Angola
  | 'ML'  // Mali
  | 'BF'  // Burkina Faso
  | 'NE'  // Niger
  | 'NG'  // Nigeria
  | 'FR'  // France
  | 'BE'  // Belgique
  | 'CH'  // Suisse

export type DataConfidence = 'verified' | 'to_verify' | 'estimated'

export type ZoneFiscale = 'CEMAC' | 'UEMOA' | 'autre'

// ─── TVA ─────────────────────────────────────────────────────────────────────

export interface TaxeAdditionnelle {
  code:    string            // 'CA' | 'CAC' | 'TPS' …
  libelle: string
  taux:    number
  base:    'tva_collectee' | 'ca_ht' | 'is_calcule'
  // 'tva_collectee' : taxe = taux × TVA_collectée  (ex: CA Congo, CAC TVA Cameroun)
  // 'ca_ht'         : taxe = taux × CA_HT           (ex: contribution professionnelle)
  // 'is_calcule'    : taxe = taux × IS_calculé       (ex: CAC IS Cameroun 10%)
}

export interface ConfigTVA {
  taux_normal:             number
  taux_reduit?:            number
  taux_zero?:              number
  taxes_additionnelles:    TaxeAdditionnelle[]
  // taux_effectif = taux_normal + Σ(additionnelles sur tva_collectee)
  taux_effectif_sur_ht:   number
  seuil_assujettissement:  number          // CA annuel HT minimum
  regime:                  'mensuel' | 'trimestriel' | 'annuel'
  echeance_jour:           number          // ex: 20 → déclaration avant le 20
  echeance_mois_suivant:   boolean
  source:                  string
}

// ─── IS / Impôt sur les Sociétés ─────────────────────────────────────────────

export interface ConfigIS {
  taux_standard:       number
  taux_minimum_ca?:    number        // minimum de perception sur CA (ex: 1% Congo)
  minimum_montant?:    number        // minimum en valeur absolue (ex: 1M FCFA Gabon)
  taxes_additionnelles?: TaxeAdditionnelle[]
  acomptes?: {
    periodicite:  'trimestriel' | 'mensuel'
    taux_acompte: number            // ex: 0.25 = 25% de l'IS N-1 par acompte
  }
  source: string
}

// ─── Retenues à la source ─────────────────────────────────────────────────────

export interface ConfigRetenuesSource {
  dividendes_residents?:       number
  dividendes_non_residents:    number
  interets_non_residents:      number
  redevances_non_residents?:   number
  prestations_non_residents:   number
  honoraires_residents?:       number
  loyers_etat_entreprises?:    number
  source:                      string
}

// ─── CNSS / Cotisations sociales ─────────────────────────────────────────────

export interface BrancheCNSS {
  code:             string          // 'VID' | 'AF' | 'AT' | 'TUS' | 'FNE' …
  libelle:          string
  taux_salarie:     number          // 0 si branche purement patronale
  taux_patronal:    number          // 0 si branche purement salariale
  plafond_mensuel:  number | null   // null = déplafonné
  // Quand plusieurs branches partagent un même plafond, utiliser la même valeur.
  // Le moteur applique le plafond indépendamment par branche.
}

export interface MesureSpecialeCNSS {
  code:               string
  description:        string
  reduction_patronal: number   // 0.5 = 50% pris en charge État
  conditions:         string
  actif:              boolean
}

export interface ConfigCNSS {
  nom:      string
  acronyme: string
  branches: BrancheCNSS[]
  medecine_travail_taux?: number   // 0.005 Tchad/Congo — taux séparé sans plafond
  echeance_jour:          number
  echeance_mois_suivant:  boolean
  mesures_speciales?:     MesureSpecialeCNSS[]
  source:                 string
}

// ─── IRPP / Impôt sur le Revenu des Personnes Physiques ──────────────────────

export type MethodeBaseIRPP =
  | 'annuelle_div12'      // Seuils annuels → moteur divise par 12 pour appliquer mensuellement
  | 'mensuelle_directe'   // Seuils déjà mensuels → moteur applique directement

export type TypeAbattement =
  | 'aucun'               // Pas d'abattement forfaitaire (Congo LF 2026 → quotient familial)
  | 'pct_brut'            // Abattement % sur salaire brut avant CNSS
  | 'pct_net_cnss'        // Abattement % sur (brut - CNSS salarié)
  | 'forfait_fixe'        // Déduction fixe en FCFA/mois

export interface ConfigAbattement {
  type:   TypeAbattement
  valeur: number   // 0.20 pour 20%, 150_000 pour forfait, 0 pour aucun
}

export interface TrancheIRPP {
  min:           number
  max:           number    // Infinity pour la dernière tranche
  taux:          number
  montant_fixe?: number | null   // montant fixe/part/an au lieu de taux % (ex: T1 Congo 4 200 F/an)
}

export interface ConfigQuotientFamilial {
  actif:              boolean
  parts_base:         number   // 1 = 1 part de base pour tout contribuable
  parts_marie:        number   // ex: +1 si marié(e)
  parts_par_enfant:   number   // ex: +0.5 par enfant à charge
  plafond_parts?:     number   // certains pays plafonnent le nb de parts
}

export interface MesureSpecialeIRPP {
  code:        string
  description: string
  reduction:   number   // 1.0 = 100% IRPP pris en charge
  conditions:  string
  actif:       boolean
}

export interface ConfigIRPP {
  nom:             string   // 'IRPP' | 'IPR' | 'ITS' | 'IRPF' …
  methode_base:    MethodeBaseIRPP
  abattement:      ConfigAbattement
  quotient_familial: ConfigQuotientFamilial
  tranches:        TrancheIRPP[]
  // Centimes additionnels sur IRPP calculé (ex: Cameroun CAC 10%)
  centimes_additionnels?: number
  mesures_speciales?: MesureSpecialeIRPP[]
  /** Plancher d'IRPP annuel (en devise) applicable quand brut < SMIG (ex: 1 200 F/an Congo) */
  minimum_annuel?: number
  periodicite:     'mensuel' | 'trimestriel'
  echeance_jour:   number
  source:          string
}

// ─── Exonérations sur primes et indemnités ────────────────────────────────────

export interface ConfigExoIndemnite {
  actif:            boolean
  plafond_mensuel:  number | null   // null = exonération totale sans plafond légal connu
  base_legale:      string          // 'Art. XX CGI [PAYS]' ou 'À confirmer'
}

export interface ConfigExonerations {
  transport:  ConfigExoIndemnite
  logement:   ConfigExoIndemnite
  repas:      ConfigExoIndemnite & { plafond_par_repas?: number; max_jours_mois?: number }
  formation:  { actif: boolean; plafond_annuel: number | null; base_legale: string }
  autres:     Array<{ code: string; libelle: string; plafond_mensuel: number | null; base_legale: string }>
}

// ─── Taxes fixes mensuelles (TOL, etc.) ──────────────────────────────────────

export interface TaxeFixe {
  code:        string   // 'TOL' | 'TVTS' …
  libelle:     string
  montant:     number
  periodicite: 'mensuel' | 'annuel'
  actif:       boolean
  base_legale: string
}

// ─── Conventions collectives (fondation, non encore implémentée) ──────────────

export interface EchelonConvention {
  code:                  string
  libelle:               string
  salaire_minimum:       number
  prime_anciennete_pct:  number   // par tranche de N années (voir convention)
}

export interface CategorieConvention {
  code:     string
  libelle:  string
  echelons: EchelonConvention[]
}

export interface GrilleSectorielle {
  secteur:    string
  categories: CategorieConvention[]
}

export interface ConfigConventions {
  actif:               boolean
  prime_anciennete: {
    taux_par_tranche: number      // ex: 0.05 = 5% par tranche
    duree_tranche_ans: number     // ex: 3 = tous les 3 ans
    plafond_pct:      number      // ex: 0.25 = 25% maximum
  }
  heures_sup: Array<{
    seuil_heures_semaine: number
    majoration_pct:       number  // ex: 0.15 = +15%
  }>
  grilles:    GrilleSectorielle[]   // vide au départ
}

// ─── Feature flags ────────────────────────────────────────────────────────────

export interface FeatureFlags {
  support_conventions_collectives: boolean
  support_multi_filiales:          boolean
  support_multi_agences:           boolean
  support_ifrs:                    boolean
  support_consolidation:           boolean
  support_miaa_fiscal:             boolean
  support_miaa_rh:                 boolean
  support_declarations_cnss:       boolean
  support_declarations_fiscales:   boolean
}

// ─── CountryConfig — interface maître ────────────────────────────────────────

export interface CountryConfig {
  // ── Identité ──────────────────────────────────────────────────────────────
  code_pays:          CodePays
  nom_pays:           string
  devise:             string     // 'FCFA' | 'CDF' | 'XAF' | 'EUR' …
  symbole_devise:     string     // '₣' | 'FC' | '€' …
  langue_principale:  string     // 'fr' | 'en' | 'es' | 'pt'
  fuseau_horaire:     string     // 'Africa/Brazzaville' | 'Africa/Kinshasa' …
  format_date:        string     // 'DD/MM/YYYY'
  format_montant:     string     // '#,##0 FCFA' | '#,##0.00 €'
  systeme_comptable:  'SYSCOHADA' | 'IFRS' | 'OHADA' | 'autre'
  zone_fiscale:       ZoneFiscale

  // ── Social ────────────────────────────────────────────────────────────────
  smig:          number          // SMIG mensuel brut en devise locale
  smig_source:   string

  // ── Fiscalité entreprise ──────────────────────────────────────────────────
  tva:              ConfigTVA
  is:               ConfigIS
  retenues_source:  ConfigRetenuesSource

  // ── Fiscalité salariale ───────────────────────────────────────────────────
  irpp:          ConfigIRPP
  cnss:          ConfigCNSS
  exonerations:  ConfigExonerations
  taxes_fixes:   TaxeFixe[]

  // ── Conventions (fondation) ───────────────────────────────────────────────
  conventions:   ConfigConventions

  // ── Feature flags ─────────────────────────────────────────────────────────
  features:      FeatureFlags

  // ── Méta ──────────────────────────────────────────────────────────────────
  data_confidence:       DataConfidence
  loi_reference:         string
  derniere_mise_a_jour:  string   // ISO date
  notes:                 string[]
}
