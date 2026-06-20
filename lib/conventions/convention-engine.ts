/**
 * lib/conventions/convention-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CONVENTION ENGINE — Oraforme Phase 2.1
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE                            │
 * │                                                             │
 * │  lib/countries/[CG|CM|GA|...].ts                           │
 * │              ↓  CountryConfig (SMIG, HS légales, ancienneté │
 * │  lib/fiscal/universal-tax-engine.ts                         │
 * │              ↓  IRPP · CNSS · TVA · IS                     │
 * │  lib/payroll/universal-payroll-engine.ts                    │
 * │              ↓  Bulletin · ResumeRH · Ancienneté légale    │
 * │  lib/conventions/convention-engine.ts   ← ICI              │
 * │    ├─ getConvention()                                       │
 * │    ├─ getCategorie()                                        │
 * │    ├─ getEchelon()                                          │
 * │    ├─ getCoefficient()                                      │
 * │    ├─ calculerSalaireConventionnel()                        │
 * │    ├─ calculerPrimeConventionnelle()                        │
 * │    ├─ calculerAncienneteConventionnelle()                   │
 * │    ├─ calculerHeuresSupConventionnelles()                   │
 * │    ├─ verifierConformiteConvention()                        │
 * │    └─ genererResumeConvention()                             │
 * │              ↓  MIAA+ entry points                         │
 * │  getMIAAAuditConvention()                                   │
 * │  getMIAAContexteConvention()                                │
 * │              ↓  Modules consommateurs                       │
 * │  Pages RH · Paie · Recrutement · Intérim · Cabinets        │
 * └─────────────────────────────────────────────────────────────┘
 *
 * RÈGLES :
 *  - Aucune valeur hardcodée dans ce fichier
 *  - SMIG depuis CountryConfig (via getCountryConfig)
 *  - Règles légales depuis CountryConfig.conventions
 *  - Ancienneté et HS : toujours la règle la plus favorable à l'employé
 *  - Fonctions pures (pas d'effets de bord)
 *  - Aucun écran modifié — aucun calcul existant remplacé
 *
 * STATUT : Phase 2.1 — fondation uniquement.
 *          Conventions pilotes pour validation d'architecture.
 *
 * @module convention-engine
 * @since 2026-06-20
 */

import { getCountryConfig, type CodePays } from '@/lib/countries'
import { calculerAnciennete, calculerHeuresSupplementaires } from '@/lib/payroll/universal-payroll-engine'

import type {
  Convention,
  Categorie,
  Echelon,
  CodeSecteur,
  PrimeConventionnelle,
  ResultatSalaireConventionnel,
  ResultatPrimeConventionnelle,
  ResultatAncienneteConventionnelle,
  ResultatHeuresSupConventionnelles,
  ResultatConformite,
  AlerteConformite,
  ResumeConvention,
  MIAAAuditConvention,
  MIAAContexteConvention,
  MethodeAnciennete,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRE — Convention Registry
// ═══════════════════════════════════════════════════════════════════════════════

const CONVENTION_REGISTRY = new Map<string, Convention>()

/** Enregistre une convention dans le registre. Clé : 'CG:COMMERCE'. */
export function registerConvention(convention: Convention): void {
  const key = `${convention.code_pays}:${convention.code_secteur}`
  CONVENTION_REGISTRY.set(key, convention)
}

/** Enregistre plusieurs conventions en une seule opération. */
export function registerConventions(conventions: Convention[]): void {
  for (const c of conventions) registerConvention(c)
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS PRIVÉS
// ═══════════════════════════════════════════════════════════════════════════════

function diffMoisComplets(dateEntree: string, periode: string): number {
  const [yE, mE] = dateEntree.split('-').map(Number)
  const [yP, mP] = periode.split('-').map(Number)
  return (yP - yE) * 12 + (mP - mE)
}

function toFixed4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function getAllCategories(convention: Convention): Categorie[] {
  return convention.grille_salariale.familles.flatMap(f => f.categories)
}

function computeSalaireMinimum(
  echelon:     Echelon,
  grille:      Convention['grille_salariale'],
  smig:        number,
): number {
  if (echelon.salaire_minimum_mensuel > 0) return echelon.salaire_minimum_mensuel
  if (grille.calcul_depuis_coefficient && grille.coefficient_base > 0) {
    return Math.round(smig * echelon.coefficient / grille.coefficient_base)
  }
  return smig
}

function computeAncienneteLegal(
  codePays:    CodePays,
  salaireBase: number,
  dateEntree:  string,
  periode:     string,
): number {
  return calculerAnciennete({ codePays, salaire_base: salaireBase, date_entree: dateEntree, periode }).prime_montant
}

function computeAncienneteConvention(
  salaireBase:    number,
  anneesCompletes: number,
  convention:     Convention,
): { montant: number; taux: number; prochainPalier: number } {
  const r = convention.regle_anciennete
  let taux = 0

  if (r.methode === 'taux_annuel' && r.taux_annuel !== undefined) {
    taux = toFixed4(Math.min(anneesCompletes * r.taux_annuel, r.plafond_pct))
    const anneesPalier = r.plafond_pct / r.taux_annuel
    const prochainPalier = taux >= r.plafond_pct ? 0 : 1
    return { montant: Math.round(salaireBase * taux), taux, prochainPalier }
  }

  if (r.methode === 'taux_par_tranche' && r.taux_par_tranche !== undefined && r.duree_tranche_ans !== undefined) {
    const tranches = Math.floor(anneesCompletes / r.duree_tranche_ans)
    taux = toFixed4(Math.min(tranches * r.taux_par_tranche, r.plafond_pct))
    const prochainPalier = taux >= r.plafond_pct ? 0 : (tranches + 1) * r.duree_tranche_ans - anneesCompletes
    return { montant: Math.round(salaireBase * taux), taux, prochainPalier: Math.max(0, prochainPalier) }
  }

  if (r.methode === 'grille_fixe' && r.grille_fixe) {
    const paliers = [...r.grille_fixe].sort((a, b) => b.annees_min - a.annees_min)
    const palier  = paliers.find(p => anneesCompletes >= p.annees_min)
    if (palier) {
      const montant = palier.est_pct ? Math.round(salaireBase * palier.montant_ou_pct) : palier.montant_ou_pct
      return { montant, taux: palier.est_pct ? palier.montant_ou_pct : 0, prochainPalier: 0 }
    }
  }

  return { montant: 0, taux: 0, prochainPalier: convention.regle_anciennete.duree_tranche_ans ?? 0 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS PUBLIQUES — LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère une convention depuis le registre.
 * Retourne null si non trouvée.
 *
 * MULTI-PAYS : changer codePays → convention du pays cible.
 * MULTI-FILIALES : une filiale peut forcer une convention différente.
 */
export function getConvention(codePays: CodePays, codeSecteur: CodeSecteur): Convention | null {
  return CONVENTION_REGISTRY.get(`${codePays}:${codeSecteur}`) ?? null
}

/** Retourne la convention ou lance une erreur si non trouvée. */
export function getConventionOrThrow(codePays: CodePays, codeSecteur: CodeSecteur): Convention {
  const conv = getConvention(codePays, codeSecteur)
  if (!conv) throw new Error(`Convention non trouvée : ${codePays}:${codeSecteur}. Registre actuel : ${[...CONVENTION_REGISTRY.keys()].join(', ')}`)
  return conv
}

/** Liste toutes les conventions enregistrées, optionnellement filtrées par pays. */
export function listConventions(codePays?: CodePays): Convention[] {
  const all = [...CONVENTION_REGISTRY.values()]
  return codePays ? all.filter(c => c.code_pays === codePays) : all
}

/**
 * Trouve une catégorie dans une convention par son code.
 * Cherche dans toutes les familles professionnelles.
 */
export function getCategorie(convention: Convention, codeCategorie: string): Categorie | null {
  for (const famille of convention.grille_salariale.familles) {
    const cat = famille.categories.find(c => c.code === codeCategorie)
    if (cat) return cat
  }
  return null
}

/** Trouve un échelon dans une catégorie par son code. */
export function getEchelon(categorie: Categorie, codeEchelon: string): Echelon | null {
  return categorie.echelons.find(e => e.code === codeEchelon) ?? null
}

/** Retourne le coefficient d'un échelon donné dans une catégorie. */
export function getCoefficient(
  convention:    Convention,
  codeCategorie: string,
  codeEchelon:   string,
): number {
  const cat = getCategorie(convention, codeCategorie)
  if (!cat) return 0
  const ech = getEchelon(cat, codeEchelon)
  return ech?.coefficient ?? 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS PUBLIQUES — CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule le salaire minimum conventionnel pour une catégorie/échelon.
 *
 * Si grille.calcul_depuis_coefficient = true :
 *   salaire_minimum = SMIG × (coefficient / coefficient_base)
 * Sinon : salaire_minimum est directement dans l'échelon.
 *
 * Le SMIG est lu depuis CountryConfig (jamais hardcodé).
 */
export function calculerSalaireConventionnel(input: {
  codePays:       CodePays
  codeSecteur:    CodeSecteur
  codeCategorie:  string
  codeEchelon:    string
  smig_override?: number   // pour tests ou override filiale
}): ResultatSalaireConventionnel {
  const conv = getConventionOrThrow(input.codePays, input.codeSecteur)
  const cfg  = getCountryConfig(input.codePays)
  const smig = input.smig_override ?? cfg.smig

  const cat = getCategorie(conv, input.codeCategorie)
  if (!cat) throw new Error(`Catégorie "${input.codeCategorie}" non trouvée dans ${conv.code}`)

  const ech = getEchelon(cat, input.codeEchelon)
  if (!ech) throw new Error(`Échelon "${input.codeEchelon}" non trouvé dans catégorie ${input.codeCategorie}`)

  const grille       = conv.grille_salariale
  const salaire_min  = computeSalaireMinimum(ech, grille, smig)
  const methode      = grille.calcul_depuis_coefficient && ech.salaire_minimum_mensuel === 0
    ? 'coefficient_smig'
    : 'grille_directe'

  return {
    code_pays:        input.codePays,
    code_secteur:     input.codeSecteur,
    code_categorie:   input.codeCategorie,
    code_echelon:     input.codeEchelon,
    libelle_categorie: cat.libelle,
    libelle_echelon:  ech.libelle,
    coefficient:      ech.coefficient,
    coefficient_base: grille.coefficient_base,
    smig_utilise:     smig,
    salaire_minimum:  salaire_min,
    methode,
    source:           conv.code,
  }
}

/**
 * Calcule le montant d'une prime conventionnelle.
 *
 * Types supportés :
 *  'fixe'              → montant directement
 *  'pct_salaire_base'  → montant × salaire_base
 *  'pct_salaire_brut'  → montant × salaire_brut
 *  'par_jour'          → montant × jours_travailles
 *  'par_unite'         → montant × unites
 */
export function calculerPrimeConventionnelle(input: {
  prime:            PrimeConventionnelle
  salaire_base:     number
  salaire_brut?:    number
  jours_travailles?: number
  unites?:          number
}): ResultatPrimeConventionnelle {
  const { prime } = input
  let montant    = 0
  let baseCalc   = 0

  switch (prime.type) {
    case 'fixe':
      montant  = prime.montant
      baseCalc = 1
      break
    case 'pct_salaire_base':
      baseCalc = input.salaire_base
      montant  = Math.round(baseCalc * prime.montant)
      break
    case 'pct_salaire_brut':
      baseCalc = input.salaire_brut ?? input.salaire_base
      montant  = Math.round(baseCalc * prime.montant)
      break
    case 'par_jour':
      baseCalc = input.jours_travailles ?? 22
      montant  = Math.round(prime.montant * baseCalc)
      break
    case 'par_unite':
      baseCalc = input.unites ?? 0
      montant  = Math.round(prime.montant * baseCalc)
      break
  }

  return {
    code:        prime.code,
    libelle:     prime.libelle,
    type:        prime.type,
    base_calcul: baseCalc,
    montant,
    imposable:   prime.imposable,
    obligatoire: prime.obligatoire,
  }
}

/**
 * Calcule l'ancienneté selon la convention ET selon le Code du Travail.
 * Applique toujours la règle LA PLUS FAVORABLE à l'employé.
 *
 * Principe CEMAC : "l'avantage le plus favorable prime".
 */
export function calculerAncienneteConventionnelle(input: {
  codePays:     CodePays
  codeSecteur:  CodeSecteur
  salaire_base: number
  date_entree:  string   // 'YYYY-MM-DD'
  periode:      string   // 'YYYY-MM'
}): ResultatAncienneteConventionnelle {
  const conv = getConventionOrThrow(input.codePays, input.codeSecteur)

  const totalMois      = diffMoisComplets(input.date_entree, input.periode)
  const anneesCompletes = Math.max(0, Math.floor(totalMois / 12))

  // 1. Ancienneté légale (Code du Travail via UniversalPayrollEngine)
  const montantLegal = computeAncienneteLegal(
    input.codePays, input.salaire_base, input.date_entree, input.periode,
  )

  // 2. Ancienneté conventionnelle
  const { montant: montantConv, taux, prochainPalier } = computeAncienneteConvention(
    input.salaire_base, anneesCompletes, conv,
  )

  // 3. La plus favorable
  const plusFavorable = conv.regle_anciennete.plus_favorable_que_legal
    ? montantConv > montantLegal
    : false

  const montantApplique  = plusFavorable || montantConv > montantLegal ? montantConv : montantLegal
  const regleUtilisee    = montantConv >= montantLegal ? 'conventionnel' : 'legal'

  return {
    date_entree:            input.date_entree,
    periode_de_calcul:      input.periode,
    annees_completes:       anneesCompletes,
    montant_legal:          montantLegal,
    montant_conventionnel:  montantConv,
    montant_applique:       montantApplique,
    taux_applique:          taux,
    regle_utilisee:         regleUtilisee as 'legal' | 'conventionnel',
    methode_convention:     conv.regle_anciennete.methode,
    prochain_palier_dans_ans: prochainPalier,
  }
}

/**
 * Calcule les heures supplémentaires selon la convention ET selon le Code du Travail.
 * Applique toujours les taux LES PLUS FAVORABLES à l'employé.
 */
export function calculerHeuresSupConventionnelles(input: {
  codePays:                 CodePays
  codeSecteur:              CodeSecteur
  salaire_base:             number
  heures_sup_mois:          number
  heures_standard_semaine?: number
  semaines_par_mois?:       number
}): ResultatHeuresSupConventionnelles {
  const conv = getConventionOrThrow(input.codePays, input.codeSecteur)

  const semainesParMois  = input.semaines_par_mois    ?? (52 / 12)
  const heuresStdSemaine = input.heures_standard_semaine ?? 40
  const heuresStdMois    = heuresStdSemaine * semainesParMois
  const tauxHoraire      = input.salaire_base / heuresStdMois

  // Calcul légal via UniversalPayrollEngine
  const legal = calculerHeuresSupplementaires({
    codePays:                 input.codePays,
    salaire_base:             input.salaire_base,
    heures_sup_mois:          input.heures_sup_mois,
    heures_standard_semaine:  heuresStdSemaine,
    semaines_par_mois:        semainesParMois,
  })

  // Calcul conventionnel (même algorithme, tranches de la convention)
  const tranchesConv = conv.regle_heures_sup.tranches
    .slice()
    .sort((a, b) => a.seuil_heures_semaine - b.seuil_heures_semaine)

  const detailConv: ResultatHeuresSupConventionnelles['detail_conventionnel'] = []
  let heuresRestantes = input.heures_sup_mois
  let montantConv     = 0

  for (let i = 0; i < tranchesConv.length && heuresRestantes > 0; i++) {
    const prochainSeuil = tranchesConv[i + 1]
    const maxH = prochainSeuil
      ? (prochainSeuil.seuil_heures_semaine - tranchesConv[i].seuil_heures_semaine) * semainesParMois
      : heuresRestantes
    const h      = Math.min(heuresRestantes, maxH)
    const montant = Math.round(h * tauxHoraire * (1 + tranchesConv[i].majoration_pct))
    detailConv.push({ seuil: tranchesConv[i].seuil_heures_semaine, pct: tranchesConv[i].majoration_pct, h, montant })
    montantConv     += montant
    heuresRestantes -= h
  }

  const detailLegal = legal.detail_majorations.map(d => ({
    seuil:  d.seuil_h_semaine,
    pct:    d.majoration_pct,
    h:      d.heures_dans_tranche,
    montant: d.montant,
  }))

  const montantLegal    = legal.total_montant
  const plusFavorable   = montantConv > montantLegal
  const montantApplique = plusFavorable ? montantConv : montantLegal
  const regleUtilisee   = plusFavorable ? 'conventionnel' : 'legal'

  return {
    heures:                input.heures_sup_mois,
    taux_horaire_base:     Math.round(tauxHoraire),
    detail_legal:          detailLegal,
    detail_conventionnel:  detailConv,
    montant_legal:         montantLegal,
    montant_conventionnel: montantConv,
    montant_applique:      montantApplique,
    regle_utilisee:        regleUtilisee as 'legal' | 'conventionnel',
  }
}

/**
 * Vérifie la conformité d'un salarié par rapport à la convention applicable.
 *
 * Contrôles effectués :
 *  1. Salaire de base ≥ minimum conventionnel
 *  2. Primes obligatoires toutes versées
 *  3. Conformité SMIG pays
 */
export function verifierConformiteConvention(params: {
  codePays:        CodePays
  codeSecteur:     CodeSecteur
  codeCategorie:   string
  codeEchelon:     string
  salaire_base:    number
  primes_versees?: Array<{ code: string; montant: number }>
  smig_override?:  number
}): ResultatConformite {
  const conv   = getConventionOrThrow(params.codePays, params.codeSecteur)
  const cfg    = getCountryConfig(params.codePays)
  const smig   = params.smig_override ?? cfg.smig
  const alertes: AlerteConformite[] = []
  const primes_manquantes: PrimeConventionnelle[] = []
  const recommandations: string[] = []

  // Salaire minimum conventionnel
  const sc = calculerSalaireConventionnel({
    codePays:      params.codePays,
    codeSecteur:   params.codeSecteur,
    codeCategorie: params.codeCategorie,
    codeEchelon:   params.codeEchelon,
    smig_override: params.smig_override,
  })
  const ecart = params.salaire_base - sc.salaire_minimum

  if (ecart < 0) {
    alertes.push({
      code:             'SALAIRE_SOUS_MINIMUM_CONV',
      severite:         'bloquant',
      message:          `Salaire (${params.salaire_base.toLocaleString('fr-FR')} FCFA) inférieur au minimum conventionnel (${sc.salaire_minimum.toLocaleString('fr-FR')} FCFA) — Catégorie ${params.codeCategorie} Échelon ${params.codeEchelon}`,
      valeur_actuelle:  params.salaire_base,
      valeur_requise:   sc.salaire_minimum,
      ecart:            ecart,
    })
    recommandations.push(`Augmenter le salaire de ${Math.abs(ecart).toLocaleString('fr-FR')} FCFA pour atteindre le minimum conventionnel`)
  }

  // Conformité SMIG
  if (params.salaire_base < smig) {
    alertes.push({
      code:            'SALAIRE_SOUS_SMIG',
      severite:        'bloquant',
      message:         `Salaire inférieur au SMIG (${smig.toLocaleString('fr-FR')} FCFA)`,
      valeur_actuelle: params.salaire_base,
      valeur_requise:  smig,
      ecart:           params.salaire_base - smig,
    })
    recommandations.push(`Aligner le salaire sur le SMIG de ${smig.toLocaleString('fr-FR')} FCFA minimum`)
  }

  // Primes obligatoires
  const cat = getCategorie(conv, params.codeCategorie)
  const toutesLesPrimesObligatoires = [
    ...conv.primes_globales.filter(p => p.obligatoire),
    ...(cat?.primes_specifiques.filter(p => p.obligatoire) ?? []),
  ]

  for (const prime of toutesLesPrimesObligatoires) {
    const versee = (params.primes_versees ?? []).find(pv => pv.code === prime.code)
    if (!versee || versee.montant <= 0) {
      primes_manquantes.push(prime)
      alertes.push({
        code:     'PRIME_OBLIGATOIRE_MANQUANTE',
        severite: 'avertissement',
        message:  `Prime obligatoire manquante : ${prime.libelle} (${prime.code})`,
      })
      recommandations.push(`Ajouter la prime obligatoire "${prime.libelle}"`)
    }
  }

  const conforme = alertes.filter(a => a.severite === 'bloquant').length === 0

  return {
    conforme,
    salaire_minimum_requis: sc.salaire_minimum,
    salaire_actuel:         params.salaire_base,
    ecart_salaire:          ecart,
    alertes,
    primes_manquantes,
    recommandations,
  }
}

/**
 * Génère un résumé complet convention pour un employé sur une période.
 *
 * Point d'entrée principal pour les pages RH, bulletins et MIAA+.
 */
export function genererResumeConvention(input: {
  codePays:        CodePays
  codeSecteur:     CodeSecteur
  codeCategorie:   string
  codeEchelon:     string
  employe_id:      string
  salaire_base:    number
  periode:         string
  date_entree:     string
  heures_sup_mois?: number
  primes_versees?: Array<{ code: string; montant: number }>
}): ResumeConvention {
  const conv = getConventionOrThrow(input.codePays, input.codeSecteur)

  const sc = calculerSalaireConventionnel({
    codePays:      input.codePays,
    codeSecteur:   input.codeSecteur,
    codeCategorie: input.codeCategorie,
    codeEchelon:   input.codeEchelon,
  })

  const anc = calculerAncienneteConventionnelle({
    codePays:     input.codePays,
    codeSecteur:  input.codeSecteur,
    salaire_base: input.salaire_base,
    date_entree:  input.date_entree,
    periode:      input.periode,
  })

  const hs = input.heures_sup_mois !== undefined && input.heures_sup_mois > 0
    ? calculerHeuresSupConventionnelles({
        codePays:        input.codePays,
        codeSecteur:     input.codeSecteur,
        salaire_base:    input.salaire_base,
        heures_sup_mois: input.heures_sup_mois,
      })
    : undefined

  // Calcul de toutes les primes globales
  const cat = getCategorie(conv, input.codeCategorie)
  const toutesLesPrimes = [
    ...conv.primes_globales,
    ...(cat?.primes_specifiques ?? []),
  ]
  const primesCalculees = toutesLesPrimes.map(prime =>
    calculerPrimeConventionnelle({ prime, salaire_base: input.salaire_base })
  )

  // Avantages applicables à cette catégorie
  const avantages = conv.avantages.filter(a => a.obligatoire || a.conditions === '')

  const conformite = verifierConformiteConvention({
    codePays:      input.codePays,
    codeSecteur:   input.codeSecteur,
    codeCategorie: input.codeCategorie,
    codeEchelon:   input.codeEchelon,
    salaire_base:  input.salaire_base,
    primes_versees: input.primes_versees,
  })

  return {
    code_pays:             input.codePays,
    code_secteur:          input.codeSecteur,
    convention:            conv.code,
    periode:               input.periode,
    employe_id:            input.employe_id,
    categorie:             input.codeCategorie,
    echelon:               input.codeEchelon,
    salaire_conventionnel: sc,
    anciennete:            anc,
    heures_sup:            hs,
    primes:                primesCalculees,
    conformite,
    avantages_applicables: avantages,
    genere_le:             new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POINTS D'ENTRÉE MIAA+
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Point d'entrée MIAA+ Audit RH.
 *
 * Agrège les résultats de conformité pour un ensemble d'employés.
 * Retourne un rapport synthétique prêt pour analyse IA.
 *
 * Utilisé par : MIAA+ Audit · MIAA+ RH · Cabinets RH
 */
export function getMIAAAuditConvention(
  codePays:    CodePays,
  codeSecteur: CodeSecteur,
  employes:    Array<{
    id:            string
    codeCategorie: string
    codeEchelon:   string
    salaire_base:  number
    primes?:       Array<{ code: string; montant: number }>
  }>,
): MIAAAuditConvention {
  const alertesPrioritaires: import('./types').AlerteConformite[] = []
  let massRegul = 0
  let nbConformes = 0

  for (const emp of employes) {
    const r = verifierConformiteConvention({
      codePays, codeSecteur,
      codeCategorie: emp.codeCategorie,
      codeEchelon:   emp.codeEchelon,
      salaire_base:  emp.salaire_base,
      primes_versees: emp.primes,
    })
    if (r.conforme) {
      nbConformes++
    } else {
      const ecart = r.ecart_salaire < 0 ? Math.abs(r.ecart_salaire) : 0
      massRegul += ecart
      alertesPrioritaires.push(...r.alertes.filter(a => a.severite === 'bloquant'))
    }
  }

  return {
    code_pays:            codePays,
    code_secteur:         codeSecteur,
    convention:           `${codePays}:${codeSecteur}`,
    nb_employes:          employes.length,
    nb_conformes:         nbConformes,
    nb_non_conformes:     employes.length - nbConformes,
    taux_conformite_pct:  employes.length > 0
      ? Math.round(nbConformes / employes.length * 100)
      : 100,
    masse_regularisation: massRegul,
    alertes_prioritaires: alertesPrioritaires.slice(0, 10),
    recommandations_ia:   [],   // ← MIAA+ remplira ce tableau lors de l'appel IA
  }
}

/**
 * Point d'entrée MIAA+ Formation et Recrutement.
 *
 * Retourne la grille conventionnelle simplifiée — prêt pour aide au recrutement.
 * Utilisé par : MIAA+ Recrutement · MIAA+ RH · Portails RH
 */
export function getMIAAContexteConvention(
  codePays:    CodePays,
  codeSecteur: CodeSecteur,
): MIAAContexteConvention {
  const conv   = getConventionOrThrow(codePays, codeSecteur)
  const cfg    = getCountryConfig(codePays)
  const smig   = cfg.smig
  const grille = conv.grille_salariale

  const grille_simplifiee = getAllCategories(conv).flatMap(cat =>
    cat.echelons.map(ech => ({
      categorie:       cat.code,
      echelon:         ech.code,
      salaire_minimum: computeSalaireMinimum(ech, grille, smig),
      coefficient:     ech.coefficient,
    }))
  )

  return {
    code_pays:           codePays,
    code_secteur:        codeSecteur,
    convention:          conv.code,
    grille_simplifiee,
    primes_obligatoires: conv.primes_globales.filter(p => p.obligatoire),
    avantages:           conv.avantages,
  }
}

// Re-exports utilitaires
export type { Convention, Categorie, Echelon, CodeSecteur }
