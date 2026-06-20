/**
 * lib/payroll/universal-payroll-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIVERSAL PAYROLL ENGINE — Oraforme Phase 1.4
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE                            │
 * │                                                             │
 * │  lib/countries/[CG|CM|GA|CD|CF|TD|GQ|...].ts               │
 * │              ↓  CountryConfig                               │
 * │  lib/fiscal/universal-tax-engine.ts                         │
 * │              ↓  IRPP · CNSS · TVA · IS                     │
 * │  lib/payroll/universal-payroll-engine.ts   ← ICI            │
 * │    ├─ calculerAnciennete()                                  │
 * │    ├─ calculerHeuresSupplementaires()                       │
 * │    ├─ calculerConges()                                      │
 * │    ├─ calculerPrimes()                                      │
 * │    ├─ calculerSalaireImposable()                            │
 * │    ├─ calculerSalaireBrut()                                 │
 * │    ├─ calculerCotisations()                                 │
 * │    ├─ calculerNetAPayer()                                   │
 * │    ├─ calculerCoutEmployeur()                               │
 * │    ├─ genererBulletinPaie()                                 │
 * │    └─ genererResumeRH()                                     │
 * │              ↓  BulletinPaie · ResumeRH                    │
 * │  ConventionEngine (future)                                  │
 * │  Pages RH / Paie / Recrutement / Intérim / Mise à dispo    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * RÈGLES :
 *  - Aucune valeur fiscale ou RH hardcodée dans ce fichier
 *  - Toutes données depuis CountryConfig via UniversalTaxEngine
 *  - Aucun écran modifié — aucun calcul existant remplacé
 *  - Coexistence additive avec calcul-paie.ts et congo-calculs.ts
 *  - Fonctions pures (pas d'effets de bord)
 *  - Support natif : CDI · CDD · Stage · Consultant · Intérimaire · Mise à dispo · Freelance
 *  - Support natif : Groupe → Pays → Filiale → Agence → Département → Service
 *  - Support natif : Cabinet RH · Intérim · Portage · Recrutement
 *
 * STATUT : Phase 1.4 — fondation uniquement. Production en Phase 2.
 *
 * @module universal-payroll-engine
 * @since 2026-06-20
 */

import { getCountryConfig, type CodePays, type DataConfidence } from '@/lib/countries'
import {
  calculerIRPP,
  calculerChargesSociales,
  type ResultatIRPP,
  type ResultatChargesSociales,
  type SituationFamiliale,
} from '@/lib/fiscal/universal-tax-engine'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — IDENTITÉS RH
// ═══════════════════════════════════════════════════════════════════════════════

export type TypeContrat =
  | 'CDI'
  | 'CDD'
  | 'Stage'
  | 'Consultant'
  | 'Prestataire'
  | 'Intérimaire'
  | 'MiseADisposition'
  | 'Freelance'

export type TypeConge =
  | 'conge_annuel'
  | 'maladie'
  | 'maternite'
  | 'paternite'
  | 'absence_autorisee'
  | 'absence_non_autorisee'
  | 'accident_travail'

export type NiveauEntite = 'groupe' | 'pays' | 'filiale' | 'agence' | 'departement' | 'service'

export type RoleCabinet =
  | 'recrutement'
  | 'interim'
  | 'portage_salarial'
  | 'mise_a_disposition'
  | 'cabinet_rh'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — STRUCTURES ORGANISATIONNELLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hiérarchie multi-niveaux : Groupe → Pays → Filiale → Agence → Département → Service.
 * Chaque niveau est indépendant. Seul codePays est obligatoire.
 */
export interface ContexteOrganisationnel {
  codePays:     CodePays
  groupe?:      string
  filiale?:     string
  agence?:      string
  departement?: string
  service?:     string
}

/**
 * Cabinet RH, intérim, portage ou recrutement.
 * Relation tripartite : Employé ↔ Cabinet ↔ Entreprise cliente.
 */
export interface CabinetRH {
  id:                  string
  nom:                 string
  role:                RoleCabinet
  entreprise_cliente?: string
  taux_marge?:         number   // marge sur coût employeur (ex: 0.15 = 15%)
  reference_contrat?:  string
}

/** Profil complet d'un employé avec contexte organisationnel, poste, fiscal, cabinet. */
export interface ProfilEmploye {
  id:          string
  nom:         string
  prenom:      string
  matricule?:  string

  contexte:    ContexteOrganisationnel

  poste:        string
  type_contrat: TypeContrat
  categorie?:   string
  echelon?:     string
  coefficient?: number

  date_entree:       string   // ISO 'YYYY-MM-DD'
  date_fin_contrat?: string   // CDD uniquement

  situation_familiale: SituationFamiliale
  nombre_enfants:      number

  cabinet?: CabinetRH
}

/** Éléments variables du mois : HS, absences, primes ponctuelles, retenues diverses. */
export interface ElementsVariables {
  heures_supplementaires?: number
  absences_jours?:         number
  conges?: Array<{
    type:  TypeConge
    jours: number
    debut: string
    fin:   string
  }>
  primes_variables?: Array<{
    code:      string
    libelle:   string
    montant:   number
    imposable: boolean
  }>
  avantages_nature?: Array<{
    code:      string
    libelle:   string
    montant:   number
    imposable: boolean
  }>
  acompte?:         number
  opposition?:      number
  mutuelle?:        number
  autres_retenues?: Array<{ code: string; libelle: string; montant: number }>
}

/** Input principal pour générer un bulletin de paie complet. */
export interface InputBulletinPaie {
  periode:      string   // 'YYYY-MM'
  employe:      ProfilEmploye
  salaire_base: number

  prime_transport?:           number
  prime_logement?:            number
  prime_responsabilite?:      number
  indemnite_deplacement?:     number
  prime_anciennete_override?: number   // ignore l'auto-calcul si fourni

  variables?: ElementsVariables

  appliquer_mesures_speciales?: boolean
}

// Inputs dédiés pour les fonctions standalone
export interface InputAnciennete {
  codePays:     CodePays
  salaire_base: number
  date_entree:  string   // 'YYYY-MM-DD'
  periode:      string   // 'YYYY-MM'
}

export interface InputHeuresSup {
  codePays:                 CodePays
  salaire_base:             number
  heures_sup_mois:          number
  heures_standard_semaine?: number   // défaut 40
  semaines_par_mois?:       number   // défaut 52/12
}

export interface InputConges {
  codePays:          CodePays
  salaire_base:      number
  periode:           string
  jours_ouvres_mois?: number   // défaut 22
  conges?:           ElementsVariables['conges']
}

export interface InputSalaireImposable {
  codePays:               CodePays
  salaire_base:           number
  prime_anciennete?:      number
  prime_responsabilite?:  number
  indemnite_deplacement?: number
  heures_sup_montant?:    number
  primes_var_imposables?: number
  prime_transport?:       number
  prime_logement?:        number
  avantages_imposables?:  number
  avantages_non_imp?:     number
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — RÉSULTATS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResultatAnciennete {
  date_entree:              string
  periode_de_calcul:        string
  annees_completes:         number
  mois_restants:            number
  prime_montant:            number
  taux_applique:            number
  prochain_palier_dans_ans: number
}

export interface ResultatHeuresSup {
  heures:            number
  taux_horaire_base: number
  detail_majorations: Array<{
    seuil_h_semaine:     number
    majoration_pct:      number
    heures_dans_tranche: number
    montant:             number
  }>
  total_montant: number
}

export interface ResultatConges {
  periode:           string
  jours_acquis_mois: number   // 2.5j/mois = 30j/an légal CEMAC
  jours_pris:        number
  impact_salaire:    number
  detail: Array<{
    type:           TypeConge
    jours:          number
    montant_retenu: number
    indemnise:      boolean
  }>
}

export interface ResultatPrimes {
  prime_anciennete:                number
  prime_transport:                 number
  prime_logement:                  number
  prime_responsabilite:            number
  indemnite_deplacement:           number
  primes_variables_imposables:     number
  primes_variables_non_imposables: number
  avantages_nature_imposables:     number
  avantages_nature_non_imposables: number
  total_imposable:                 number
  total_non_imposable:             number
  detail: Array<{ code: string; libelle: string; montant: number; imposable: boolean }>
}

export interface ResultatSalaireImposable {
  salaire_base:            number
  elements_imposables:     number   // primes impo + HS + avantages impo
  salaire_brut_imposable:  number   // base + elements_imposables
  exonerations_montant:    number
  elements_non_imposables: number   // transport (exo) + avantages non impo
  salaire_brut_total:      number   // imposable + non_imposables
  detail_exonerations: Array<{ code: string; libelle: string; montant: number }>
}

export type TypeLigneBulletin = 'gain_imposable' | 'gain_exonere' | 'retenue' | 'info'

export interface LigneBulletin {
  code:     string
  libelle:  string
  base?:    number
  taux?:    number
  gain?:    number
  retenue?: number
  type:     TypeLigneBulletin
}

/** Bulletin de paie complet — toutes informations pour affichage conforme. */
export interface BulletinPaie {
  periode: string
  employe: {
    id:           string
    nom_complet:  string
    matricule?:   string
    poste:        string
    type_contrat: TypeContrat
    contexte:     ContexteOrganisationnel
    categorie?:   string
    echelon?:     string
    coefficient?: number
    date_entree:  string
  }
  pays: {
    code:            CodePays
    nom:             string
    devise:          string
    loi_reference:   string
    data_confidence: DataConfidence
  }
  cabinet?: CabinetRH

  salaire_base:   number
  primes:         ResultatPrimes
  heures_sup:     ResultatHeuresSup
  conges:         ResultatConges
  anciennete:     ResultatAnciennete
  bruts:          ResultatSalaireImposable
  cotisations:    ResultatChargesSociales
  irpp:           ResultatIRPP
  taxes_fixes:    Array<{ code: string; libelle: string; montant: number }>
  autres_retenues: Array<{ code: string; libelle: string; montant: number }>
  mutuelle:       number
  acompte:        number
  opposition:     number

  total_gains:    number
  total_retenues: number
  net_a_payer:    number
  cout_employeur: number
  cout_cabinet?:  number   // si cabinet.taux_marge défini

  lignes:       LigneBulletin[]
  genere_le:    string
  source_moteur: string
}

/** Résumé RH agrégé pour un ensemble de bulletins (mois / département / filiale). */
export interface ResumeRH {
  periode:                   string
  contexte:                  ContexteOrganisationnel
  effectif_total:            number
  effectif_par_type_contrat: Partial<Record<TypeContrat, number>>
  effectif_par_departement:  Record<string, number>
  masse_salariale_brute:     number
  masse_salariale_nette:     number
  cout_employeur_total:      number
  total_cnss_salarie:        number
  total_cnss_patronal:       number
  total_irpp:                number
  total_taxes_fixes:         number
  smig_pays:                 number
  nb_employes_sous_smig:     number
  cabinet?:                  CabinetRH
  bulletins:                 BulletinPaie[]
  pays:                      CodePays
  loi_reference:             string
  data_confidence:           DataConfidence
  genere_le:                 string
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS PRIVÉS
// ═══════════════════════════════════════════════════════════════════════════════

/** Décompose 'YYYY-MM' en { annee, mois } (1-indexed). */
function parsePeriode(p: string): { annee: number; mois: number } {
  const [annee, mois] = p.split('-').map(Number)
  return { annee, mois }
}

/** Décompose 'YYYY-MM-DD' en { annee, mois, jour } (1-indexed). */
function parseDate(d: string): { annee: number; mois: number; jour: number } {
  const [annee, mois, jour] = d.split('-').map(Number)
  return { annee, mois, jour }
}

/** Calcule la différence en mois complets entre une date d'entrée et une période. */
function diffMoisComplets(dateEntree: string, periode: string): number {
  const e = parseDate(dateEntree)
  const p = parsePeriode(periode)
  return (p.annee - e.annee) * 12 + (p.mois - e.mois)
}

/** Formateur interne. */
function round(n: number): number {
  return Math.round(n)
}

/** Construit les lignes de bulletin à partir des composantes déjà calculées. */
function buildLignesBulletin(
  salaire_base:    number,
  primes:          ResultatPrimes,
  heures_sup:      ResultatHeuresSup,
  cotisations:     ResultatChargesSociales,
  irpp:            ResultatIRPP,
  taxes_fixes:     Array<{ code: string; libelle: string; montant: number }>,
  autres_retenues: Array<{ code: string; libelle: string; montant: number }>,
  mutuelle:        number,
  acompte:         number,
  opposition:      number,
): LigneBulletin[] {
  const lignes: LigneBulletin[] = []

  lignes.push({ code: 'SAL_BASE', libelle: 'Salaire de base', gain: salaire_base, type: 'gain_imposable' })

  if (primes.prime_anciennete > 0)
    lignes.push({ code: 'P_ANC', libelle: 'Prime d\'ancienneté', gain: primes.prime_anciennete, type: 'gain_imposable' })

  if (primes.prime_responsabilite > 0)
    lignes.push({ code: 'P_RESP', libelle: 'Prime de responsabilité', gain: primes.prime_responsabilite, type: 'gain_imposable' })

  if (primes.indemnite_deplacement > 0)
    lignes.push({ code: 'P_DEP', libelle: 'Indemnité de déplacement', gain: primes.indemnite_deplacement, type: 'gain_imposable' })

  if (primes.primes_variables_imposables > 0)
    lignes.push({ code: 'P_VAR_IMP', libelle: 'Primes variables (imposables)', gain: primes.primes_variables_imposables, type: 'gain_imposable' })

  if (primes.avantages_nature_imposables > 0)
    lignes.push({ code: 'AVN_IMP', libelle: 'Avantages en nature (imposables)', gain: primes.avantages_nature_imposables, type: 'gain_imposable' })

  if (heures_sup.total_montant > 0)
    lignes.push({ code: 'HS', libelle: `Heures supplémentaires (${heures_sup.heures}h)`, gain: heures_sup.total_montant, type: 'gain_imposable' })

  if (primes.prime_transport > 0)
    lignes.push({ code: 'P_TRANS', libelle: 'Prime de transport (exonérée)', gain: primes.prime_transport, type: 'gain_exonere' })

  if (primes.prime_logement > 0)
    lignes.push({ code: 'P_LOG', libelle: 'Prime de logement (exonérée)', gain: primes.prime_logement, type: 'gain_exonere' })

  if (primes.primes_variables_non_imposables > 0)
    lignes.push({ code: 'P_VAR_EXO', libelle: 'Primes variables (exonérées)', gain: primes.primes_variables_non_imposables, type: 'gain_exonere' })

  if (primes.avantages_nature_non_imposables > 0)
    lignes.push({ code: 'AVN_EXO', libelle: 'Avantages en nature (exonérés)', gain: primes.avantages_nature_non_imposables, type: 'gain_exonere' })

  // Retenues
  for (const branch of cotisations.branches) {
    if (branch.montant_salarie > 0)
      lignes.push({
        code:    branch.code + '_SAL',
        libelle: branch.libelle + ' (salarié)',
        base:    branch.base_calcul,
        taux:    branch.taux_salarie,
        retenue: branch.montant_salarie,
        type:    'retenue',
      })
  }

  if (irpp.irpp_net > 0)
    lignes.push({ code: 'IRPP', libelle: irpp.methode_base.includes('annuelle') ? 'IRPP' : 'IPR', base: irpp.base_apres_abattement, retenue: irpp.irpp_net, type: 'retenue' })

  for (const tf of taxes_fixes)
    lignes.push({ code: tf.code, libelle: tf.libelle, retenue: tf.montant, type: 'retenue' })

  if (mutuelle > 0)
    lignes.push({ code: 'MUTUELLE', libelle: 'Mutuelle', retenue: mutuelle, type: 'retenue' })

  if (acompte > 0)
    lignes.push({ code: 'ACOMPTE', libelle: 'Acompte sur salaire', retenue: acompte, type: 'retenue' })

  if (opposition > 0)
    lignes.push({ code: 'OPPOSITION', libelle: 'Opposition / saisie', retenue: opposition, type: 'retenue' })

  for (const r of autres_retenues)
    lignes.push({ code: r.code, libelle: r.libelle, retenue: r.montant, type: 'retenue' })

  return lignes
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS PUBLIQUES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule la prime d'ancienneté et le statut d'ancienneté d'un employé.
 *
 * Lit depuis CountryConfig.conventions.prime_anciennete :
 *   - taux_par_tranche (ex: 5% par tranche pour CG)
 *   - duree_tranche_ans (ex: 3 ans entre chaque palier)
 *   - plafond_pct (ex: 25% maximum)
 */
export function calculerAnciennete(input: InputAnciennete): ResultatAnciennete {
  const cfg = getCountryConfig(input.codePays)
  const pa  = cfg.conventions.prime_anciennete

  const totalMois = diffMoisComplets(input.date_entree, input.periode)

  if (totalMois <= 0) {
    return {
      date_entree:              input.date_entree,
      periode_de_calcul:        input.periode,
      annees_completes:         0,
      mois_restants:            0,
      prime_montant:            0,
      taux_applique:            0,
      prochain_palier_dans_ans: pa.duree_tranche_ans,
    }
  }

  const anneesCompletes = Math.floor(totalMois / 12)
  const moisRestants    = totalMois % 12

  const tranchesCumulees = Math.floor(anneesCompletes / pa.duree_tranche_ans)
  // Round to 4 decimal places to avoid IEEE-754 float drift (e.g. 3×0.05 = 0.15000000000000002)
  const taux = Math.round(Math.min(tranchesCumulees * pa.taux_par_tranche, pa.plafond_pct) * 10_000) / 10_000
  const primeMontant     = round(input.salaire_base * taux)

  const prochainePalierAnnees = (tranchesCumulees + 1) * pa.duree_tranche_ans
  const prochainPalierDansAns = taux >= pa.plafond_pct
    ? 0
    : Math.max(0, prochainePalierAnnees - anneesCompletes)

  return {
    date_entree:              input.date_entree,
    periode_de_calcul:        input.periode,
    annees_completes:         anneesCompletes,
    mois_restants:            moisRestants,
    prime_montant:            primeMontant,
    taux_applique:            taux,
    prochain_palier_dans_ans: prochainPalierDansAns,
  }
}

/**
 * Calcule les heures supplémentaires avec majorations légales.
 *
 * Lit depuis CountryConfig.conventions.heures_sup le barème de majorations par seuil :
 *   CG : [{ seuil: 40h → +15% }, { seuil: 48h → +50% }]
 *
 * Distribue les heures dans les tranches et calcule le montant total.
 */
export function calculerHeuresSupplementaires(input: InputHeuresSup): ResultatHeuresSup {
  const cfg  = getCountryConfig(input.codePays)
  const conf = cfg.conventions

  const semainesParMois    = input.semaines_par_mois    ?? (52 / 12)
  const heuresStdSemaine   = input.heures_standard_semaine ?? 40
  const heuresStdMois      = heuresStdSemaine * semainesParMois
  const tauxHoraireBase    = input.salaire_base / heuresStdMois

  if (conf.heures_sup.length === 0 || input.heures_sup_mois <= 0) {
    return { heures: 0, taux_horaire_base: round(tauxHoraireBase), detail_majorations: [], total_montant: 0 }
  }

  const seuils = [...conf.heures_sup].sort((a, b) => a.seuil_heures_semaine - b.seuil_heures_semaine)

  let heuresRestantes = input.heures_sup_mois
  let montantTotal    = 0
  const detail: ResultatHeuresSup['detail_majorations'] = []

  for (let i = 0; i < seuils.length; i++) {
    if (heuresRestantes <= 0) break

    const prochainSeuil     = seuils[i + 1]
    const maxHeuresTouteTrancheParMois = prochainSeuil
      ? (prochainSeuil.seuil_heures_semaine - seuils[i].seuil_heures_semaine) * semainesParMois
      : heuresRestantes

    const heuresTranche = Math.min(heuresRestantes, maxHeuresTouteTrancheParMois)
    const montant       = round(heuresTranche * tauxHoraireBase * (1 + seuils[i].majoration_pct))

    detail.push({
      seuil_h_semaine:     seuils[i].seuil_heures_semaine,
      majoration_pct:      seuils[i].majoration_pct,
      heures_dans_tranche: heuresTranche,
      montant,
    })

    montantTotal    += montant
    heuresRestantes -= heuresTranche
  }

  return {
    heures:            input.heures_sup_mois,
    taux_horaire_base: round(tauxHoraireBase),
    detail_majorations: detail,
    total_montant:     montantTotal,
  }
}

/**
 * Calcule l'impact des congés et absences sur le bulletin du mois.
 *
 * Base légale CEMAC : 30 jours de congés annuels = 2,5 jours acquis/mois.
 * Indemnisation : salaire maintenu pendant congés annuels et maternité/paternité.
 * Absence non autorisée : déduction sur salaire.
 */
export function calculerConges(input: InputConges): ResultatConges {
  const joursOuvresMois = input.jours_ouvres_mois ?? 22
  const tauxJournalier  = input.salaire_base / joursOuvresMois

  const joursAcquisMois = 2.5   // 30j/an ÷ 12 — standard Code du Travail CEMAC
  const congesListe     = input.conges ?? []

  const detail: ResultatConges['detail'] = []
  let impactSalaire  = 0
  let joursPrisTotaux = 0

  const TYPES_INDEMNISES: TypeConge[] = ['conge_annuel', 'maladie', 'maternite', 'paternite', 'absence_autorisee', 'accident_travail']

  for (const c of congesListe) {
    const indemnise     = TYPES_INDEMNISES.includes(c.type)
    const montantRetenu = indemnise ? 0 : round(c.jours * tauxJournalier)

    detail.push({ type: c.type, jours: c.jours, montant_retenu: montantRetenu, indemnise })
    impactSalaire  += montantRetenu
    joursPrisTotaux += c.jours
  }

  return {
    periode:           input.periode,
    jours_acquis_mois: joursAcquisMois,
    jours_pris:        joursPrisTotaux,
    impact_salaire:    impactSalaire,
    detail,
  }
}

/**
 * Calcule le détail de toutes les primes d'un bulletin.
 *
 * Lit les exonérations depuis CountryConfig.exonerations pour déterminer
 * quelles primes sont imposables ou non.
 */
export function calculerPrimes(
  input: InputBulletinPaie,
  anneesAnciennete: number,
): ResultatPrimes {
  const cfg  = getCountryConfig(input.employe.contexte.codePays)
  const exos = cfg.exonerations

  // Ancienneté auto (ou override)
  const primeAnciennete = input.prime_anciennete_override
    ?? calculerAnciennete({
        codePays:     input.employe.contexte.codePays,
        salaire_base: input.salaire_base,
        date_entree:  input.employe.date_entree,
        periode:      input.periode,
      }).prime_montant

  // Transport : exonéré si config actif (dans la limite du plafond mensuel si défini)
  const transportBrut = input.prime_transport ?? 0
  const transportExo  = exos.transport.actif
  const transportImpo = transportExo ? 0 : transportBrut
  // La prime de transport reste non-imposable dans tous les cas CEMAC (même sans plafond)
  // On la classe toujours comme non-imposable car c'est un remboursement de frais

  // Logement : exonéré si config actif
  const logementBrut = input.prime_logement ?? 0
  const logementExo  = exos.logement.actif
  const logementImpo = logementExo ? 0 : logementBrut

  const primesVarImp    = (input.variables?.primes_variables ?? []).filter(p => p.imposable).reduce((s, p) => s + p.montant, 0)
  const primesVarNonImp = (input.variables?.primes_variables ?? []).filter(p => !p.imposable).reduce((s, p) => s + p.montant, 0)
  const avnImp          = (input.variables?.avantages_nature ?? []).filter(a => a.imposable).reduce((s, a) => s + a.montant, 0)
  const avnNonImp       = (input.variables?.avantages_nature ?? []).filter(a => !a.imposable).reduce((s, a) => s + a.montant, 0)

  const primeResp    = input.prime_responsabilite ?? 0
  const indemniteDep = input.indemnite_deplacement ?? 0

  const detail: ResultatPrimes['detail'] = []

  if (primeAnciennete > 0) detail.push({ code: 'P_ANC',   libelle: "Prime d'ancienneté",       montant: primeAnciennete, imposable: true })
  if (primeResp > 0)       detail.push({ code: 'P_RESP',  libelle: 'Prime de responsabilité',  montant: primeResp,       imposable: true })
  if (indemniteDep > 0)    detail.push({ code: 'P_DEP',   libelle: 'Indemnité de déplacement', montant: indemniteDep,    imposable: true })
  if (transportBrut > 0)   detail.push({ code: 'P_TRANS', libelle: 'Prime de transport',       montant: transportBrut,   imposable: transportImpo > 0 })
  if (logementBrut > 0)    detail.push({ code: 'P_LOG',   libelle: 'Prime de logement',        montant: logementBrut,    imposable: logementImpo > 0 })

  for (const p of (input.variables?.primes_variables ?? []))
    detail.push({ code: 'P_VAR_' + p.code, libelle: p.libelle, montant: p.montant, imposable: p.imposable })
  for (const a of (input.variables?.avantages_nature ?? []))
    detail.push({ code: 'AVN_' + a.code, libelle: a.libelle, montant: a.montant, imposable: a.imposable })

  const totalImposable    = primeAnciennete + primeResp + indemniteDep + primesVarImp + avnImp + transportImpo + logementImpo
  const totalNonImposable = transportBrut + logementBrut + primesVarNonImp + avnNonImp - transportImpo - logementImpo

  return {
    prime_anciennete:                primeAnciennete,
    prime_transport:                 transportBrut,
    prime_logement:                  logementBrut,
    prime_responsabilite:            primeResp,
    indemnite_deplacement:           indemniteDep,
    primes_variables_imposables:     primesVarImp,
    primes_variables_non_imposables: primesVarNonImp,
    avantages_nature_imposables:     avnImp,
    avantages_nature_non_imposables: avnNonImp,
    total_imposable:                 totalImposable,
    total_non_imposable:             Math.max(0, totalNonImposable),
    detail,
  }
}

/**
 * Calcule le salaire brut imposable et le brut total.
 *
 * salaire_brut_imposable = base + primes_imposables + HS
 * salaire_brut_total     = imposable + non_imposables (transport exo, etc.)
 *
 * Les exonérations sont lues depuis CountryConfig.exonerations.
 */
export function calculerSalaireImposable(input: InputSalaireImposable): ResultatSalaireImposable {
  const cfg  = getCountryConfig(input.codePays)
  const exos = cfg.exonerations

  const elementsImposables =
    (input.prime_anciennete   ?? 0) +
    (input.prime_responsabilite ?? 0) +
    (input.indemnite_deplacement ?? 0) +
    (input.heures_sup_montant  ?? 0) +
    (input.primes_var_imposables ?? 0) +
    (input.avantages_imposables ?? 0)

  const brutImposable = input.salaire_base + elementsImposables

  // Exonérations applicables
  const detailExo: ResultatSalaireImposable['detail_exonerations'] = []
  let exoMontant = 0

  if (exos.transport.actif && (input.prime_transport ?? 0) > 0) {
    const plafond = exos.transport.plafond_mensuel ?? Infinity
    const montantExo = Math.min(input.prime_transport!, plafond)
    detailExo.push({ code: 'EXO_TRANS', libelle: 'Exonération transport', montant: montantExo })
    exoMontant += montantExo
  }

  if (exos.logement.actif && (input.prime_logement ?? 0) > 0) {
    const plafond = exos.logement.plafond_mensuel ?? Infinity
    const montantExo = Math.min(input.prime_logement!, plafond)
    detailExo.push({ code: 'EXO_LOG', libelle: 'Exonération logement', montant: montantExo })
    exoMontant += montantExo
  }

  const nonImposables =
    (input.prime_transport ?? 0) +
    (input.prime_logement  ?? 0) +
    (input.avantages_non_imp ?? 0)

  return {
    salaire_base:            input.salaire_base,
    elements_imposables:     elementsImposables,
    salaire_brut_imposable:  brutImposable,
    exonerations_montant:    exoMontant,
    elements_non_imposables: nonImposables,
    salaire_brut_total:      brutImposable + nonImposables,
    detail_exonerations:     detailExo,
  }
}

/**
 * Calcule les cotisations sociales (CNSS/CNPS/INSS) via UniversalTaxEngine.
 *
 * Délègue à calculerChargesSociales() — toutes les données viennent de CountryConfig.
 */
export function calculerCotisations(input: {
  codePays:                  CodePays
  salaireBrutImposable:      number
  appliquer_mesures_speciales?: boolean
}): ResultatChargesSociales {
  return calculerChargesSociales({
    codePays:                  input.codePays,
    salaireBrut:               input.salaireBrutImposable,
    appliquerMesuresSpeciales: input.appliquer_mesures_speciales,
  })
}

/**
 * Calcule le net à payer à partir des composantes pré-calculées.
 */
export function calculerNetAPayer(params: {
  salaire_brut_total:  number
  total_cnss_salarie:  number
  irpp_net:            number
  total_taxes_fixes:   number
  mutuelle?:           number
  acompte?:            number
  opposition?:         number
  autres_retenues?:    number
}): { net_a_payer: number; total_retenues: number } {
  const totalRetenues =
    params.total_cnss_salarie +
    params.irpp_net           +
    params.total_taxes_fixes  +
    (params.mutuelle        ?? 0) +
    (params.acompte         ?? 0) +
    (params.opposition      ?? 0) +
    (params.autres_retenues ?? 0)

  return {
    total_retenues: totalRetenues,
    net_a_payer:    Math.max(0, params.salaire_brut_total - totalRetenues),
  }
}

/**
 * Calcule le coût total employeur.
 *
 * cout_employeur = salaire_brut_total + cotisations_patronales_nettes
 * cout_cabinet   = cout_employeur × (1 + taux_marge) si cabinet défini
 */
export function calculerCoutEmployeur(params: {
  salaire_brut_total:    number
  total_patronal_net:    number
  cabinet?:              CabinetRH
}): { cout_employeur: number; cout_cabinet?: number } {
  const coutEmployeur = params.salaire_brut_total + params.total_patronal_net
  const coutCabinet   = params.cabinet?.taux_marge !== undefined
    ? round(coutEmployeur * (1 + params.cabinet.taux_marge))
    : undefined

  return { cout_employeur: coutEmployeur, cout_cabinet: coutCabinet }
}

/**
 * Génère un bulletin de paie complet pour un employé sur une période.
 *
 * Chaîne de calcul :
 *  1. Ancienneté → prime_anciennete
 *  2. HS → montant_hs
 *  3. Primes → detail imposable/non_imposable
 *  4. Brut imposable + brut total
 *  5. Cotisations CNSS (via UniversalTaxEngine)
 *  6. Base IRPP = brut_imposable - CNSS_salarié
 *  7. IRPP (via UniversalTaxEngine)
 *  8. Taxes fixes (TOL etc.) depuis CountryConfig
 *  9. Net à payer
 * 10. Coût employeur
 */
export function genererBulletinPaie(input: InputBulletinPaie): BulletinPaie {
  const cfg  = getCountryConfig(input.employe.contexte.codePays)
  const vars = input.variables ?? {}

  // 1. Ancienneté
  const anciennete = calculerAnciennete({
    codePays:     input.employe.contexte.codePays,
    salaire_base: input.salaire_base,
    date_entree:  input.employe.date_entree,
    periode:      input.periode,
  })

  // 2. Heures supplémentaires
  const heuresSup = calculerHeuresSupplementaires({
    codePays:        input.employe.contexte.codePays,
    salaire_base:    input.salaire_base,
    heures_sup_mois: vars.heures_supplementaires ?? 0,
  })

  // 3. Congés
  const conges = calculerConges({
    codePays:     input.employe.contexte.codePays,
    salaire_base: input.salaire_base,
    periode:      input.periode,
    conges:       vars.conges,
  })

  // 4. Primes (utilise ancienneté calculée pour l'override auto)
  const primes = calculerPrimes(
    { ...input, prime_anciennete_override: input.prime_anciennete_override ?? anciennete.prime_montant },
    anciennete.annees_completes,
  )

  // 5. Salaires bruts
  const bruts = calculerSalaireImposable({
    codePays:              input.employe.contexte.codePays,
    salaire_base:          input.salaire_base,
    prime_anciennete:      primes.prime_anciennete,
    prime_responsabilite:  primes.prime_responsabilite,
    indemnite_deplacement: primes.indemnite_deplacement,
    heures_sup_montant:    heuresSup.total_montant,
    primes_var_imposables: primes.primes_variables_imposables,
    prime_transport:       primes.prime_transport,
    prime_logement:        primes.prime_logement,
    avantages_imposables:  primes.avantages_nature_imposables,
    avantages_non_imp:     primes.avantages_nature_non_imposables + primes.primes_variables_non_imposables,
  })

  // 6. Cotisations sociales sur brut imposable
  const cotisations = calculerCotisations({
    codePays:                  input.employe.contexte.codePays,
    salaireBrutImposable:      bruts.salaire_brut_imposable,
    appliquer_mesures_speciales: input.appliquer_mesures_speciales,
  })

  // 7. Base IRPP = brut imposable - CNSS salarié
  const baseIRPP = Math.max(0, bruts.salaire_brut_imposable - cotisations.total_salarie)

  // 8. IRPP
  const irpp = calculerIRPP({
    codePays:                  input.employe.contexte.codePays,
    salaireBrut:               baseIRPP,
    situation:                 input.employe.situation_familiale,
    nombreEnfants:             input.employe.nombre_enfants,
    appliquerMesuresSpeciales: input.appliquer_mesures_speciales,
  })

  // 9. Taxes fixes (TOL etc.)
  const taxesFixes = cfg.taxes_fixes
    .filter(t => t.actif && t.periodicite === 'mensuel')
    .map(t => ({ code: t.code, libelle: t.libelle, montant: t.montant }))
  const totalTaxesFixes = taxesFixes.reduce((s, t) => s + t.montant, 0)

  // 10. Autres retenues
  const autresRetenues   = (vars.autres_retenues ?? []).map(r => ({ code: r.code, libelle: r.libelle, montant: r.montant }))
  const totalAutresRet   = autresRetenues.reduce((s, r) => s + r.montant, 0)
  const mutuelle         = vars.mutuelle   ?? 0
  const acompte          = vars.acompte    ?? 0
  const opposition       = vars.opposition ?? 0

  // 11. Net et totaux
  const { net_a_payer, total_retenues } = calculerNetAPayer({
    salaire_brut_total:  bruts.salaire_brut_total,
    total_cnss_salarie:  cotisations.total_salarie,
    irpp_net:            irpp.irpp_net,
    total_taxes_fixes:   totalTaxesFixes,
    mutuelle,
    acompte,
    opposition,
    autres_retenues:     totalAutresRet,
  })

  const totalGains = bruts.salaire_brut_total

  // 12. Coût employeur
  const { cout_employeur, cout_cabinet } = calculerCoutEmployeur({
    salaire_brut_total: bruts.salaire_brut_total,
    total_patronal_net: cotisations.total_patronal_net,
    cabinet:            input.employe.cabinet,
  })

  // 13. Lignes bulletin
  const lignes = buildLignesBulletin(
    input.salaire_base, primes, heuresSup, cotisations, irpp,
    taxesFixes, autresRetenues, mutuelle, acompte, opposition,
  )

  return {
    periode: input.periode,
    employe: {
      id:           input.employe.id,
      nom_complet:  `${input.employe.prenom} ${input.employe.nom}`,
      matricule:    input.employe.matricule,
      poste:        input.employe.poste,
      type_contrat: input.employe.type_contrat,
      contexte:     input.employe.contexte,
      categorie:    input.employe.categorie,
      echelon:      input.employe.echelon,
      coefficient:  input.employe.coefficient,
      date_entree:  input.employe.date_entree,
    },
    pays: {
      code:            cfg.code_pays,
      nom:             cfg.nom_pays,
      devise:          cfg.devise,
      loi_reference:   cfg.loi_reference,
      data_confidence: cfg.data_confidence,
    },
    cabinet:        input.employe.cabinet,
    salaire_base:   input.salaire_base,
    primes,
    heures_sup:     heuresSup,
    conges,
    anciennete,
    bruts,
    cotisations,
    irpp,
    taxes_fixes:    taxesFixes,
    autres_retenues: autresRetenues,
    mutuelle,
    acompte,
    opposition,
    total_gains:    totalGains,
    total_retenues,
    net_a_payer,
    cout_employeur,
    cout_cabinet,
    lignes,
    genere_le:    new Date().toISOString(),
    source_moteur: 'UniversalPayrollEngine v1.0',
  }
}

/**
 * Génère un résumé RH agrégé à partir d'un ensemble de bulletins.
 *
 * Calcule : masse salariale, effectifs par type/département,
 * conformité SMIG, totaux fiscaux et sociaux.
 */
export function genererResumeRH(
  bulletins: BulletinPaie[],
  contexte:  ContexteOrganisationnel,
): ResumeRH {
  if (bulletins.length === 0) {
    const cfg = getCountryConfig(contexte.codePays)
    return {
      periode:                   '',
      contexte,
      effectif_total:            0,
      effectif_par_type_contrat: {},
      effectif_par_departement:  {},
      masse_salariale_brute:     0,
      masse_salariale_nette:     0,
      cout_employeur_total:      0,
      total_cnss_salarie:        0,
      total_cnss_patronal:       0,
      total_irpp:                0,
      total_taxes_fixes:         0,
      smig_pays:                 cfg.smig,
      nb_employes_sous_smig:     0,
      bulletins:                 [],
      pays:                      contexte.codePays,
      loi_reference:             cfg.loi_reference,
      data_confidence:           cfg.data_confidence,
      genere_le:                 new Date().toISOString(),
    }
  }

  const cfg    = getCountryConfig(contexte.codePays)
  const smig   = cfg.smig
  const period = bulletins[0].periode

  const parContrat: Partial<Record<TypeContrat, number>> = {}
  const parDept: Record<string, number>                 = {}

  let masseSalalerialeBrute = 0
  let masseSalarialeNette   = 0
  let coutEmployeurTotal    = 0
  let totalCnssSal          = 0
  let totalCnssPat          = 0
  let totalIrpp             = 0
  let totalTaxesFixes       = 0
  let sousSmig              = 0

  for (const b of bulletins) {
    const contrat  = b.employe.type_contrat
    const dept     = b.employe.contexte.departement ?? 'Non défini'
    parContrat[contrat] = (parContrat[contrat] ?? 0) + 1
    parDept[dept]       = (parDept[dept]       ?? 0) + 1

    masseSalalerialeBrute += b.bruts.salaire_brut_total
    masseSalarialeNette   += b.net_a_payer
    coutEmployeurTotal    += b.cout_employeur
    totalCnssSal          += b.cotisations.total_salarie
    totalCnssPat          += b.cotisations.total_patronal_net
    totalIrpp             += b.irpp.irpp_net
    totalTaxesFixes       += b.taxes_fixes.reduce((s, t) => s + t.montant, 0)
    if (b.salaire_base < smig) sousSmig++
  }

  // Cabinet : si tous les bulletins ont le même cabinet, l'inclure dans le résumé
  const cabinetIds = new Set(bulletins.map(b => b.cabinet?.id).filter(Boolean))
  const cabinet    = cabinetIds.size === 1 ? bulletins[0].cabinet : undefined

  return {
    periode:                   period,
    contexte,
    effectif_total:            bulletins.length,
    effectif_par_type_contrat: parContrat,
    effectif_par_departement:  parDept,
    masse_salariale_brute:     masseSalalerialeBrute,
    masse_salariale_nette:     masseSalarialeNette,
    cout_employeur_total:      coutEmployeurTotal,
    total_cnss_salarie:        totalCnssSal,
    total_cnss_patronal:       totalCnssPat,
    total_irpp:                totalIrpp,
    total_taxes_fixes:         totalTaxesFixes,
    smig_pays:                 smig,
    nb_employes_sous_smig:     sousSmig,
    cabinet,
    bulletins,
    pays:                      contexte.codePays,
    loi_reference:             cfg.loi_reference,
    data_confidence:           cfg.data_confidence,
    genere_le:                 new Date().toISOString(),
  }
}

// Re-exports pour faciliter les imports consommateurs
export type { CodePays, DataConfidence, SituationFamiliale }
export type { ResultatIRPP, ResultatChargesSociales }
