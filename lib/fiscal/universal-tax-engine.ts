/**
 * lib/fiscal/universal-tax-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIVERSAL TAX ENGINE — Oraforme
 *
 * Moteur fiscal universel multi-pays, zéro valeur hardcodée.
 * Toutes les données proviennent de CountryConfig (lib/countries/).
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     ARCHITECTURE                            │
 * │                                                             │
 * │  lib/countries/[CG|CM|GA|CD|CF|TD|GQ|...].ts               │
 * │              ↓  CountryConfig                               │
 * │  lib/fiscal/universal-tax-engine.ts                         │
 * │    ├─ calculerTVA()                                         │
 * │    ├─ calculerIS()                                          │
 * │    ├─ calculerIRPP()           ← IRPP/IPR/ITS/IRPF         │
 * │    ├─ calculerChargesSociales() ← CNSS/CNPS/INSS/INSESO    │
 * │    ├─ calculerRetenueSource()                               │
 * │    ├─ calculerTaxeMinimale()                                │
 * │    ├─ calculerFiscaliteEntreprise()                         │
 * │    └─ genererResumeFiscal[Mensuel|Entreprise]()             │
 * │              ↓  Résultats typés, auditables                 │
 * │  Modules consommateurs :                                    │
 * │    RH · Paie · Comptabilité · Facturation · MIAA+          │
 * └─────────────────────────────────────────────────────────────┘
 *
 * RÈGLES :
 *  - Aucune valeur fiscale hardcodée dans ce fichier
 *  - Toutes données depuis getCountryConfig()
 *  - Fonctions pures (pas d'effets de bord)
 *  - Montants en entiers (Math.round) — standard FCFA CEMAC
 *  - Compatible : CG, CM, GA, CD, CF, TD, GQ (et extensible)
 *
 * STATUT : Phase 1.3 — fondation uniquement.
 *          Calculs existants NON remplacés. Coexistence additive.
 *
 * @module universal-tax-engine
 * @since 2026-06-20
 */

import {
  getCountryConfig,
  type CountryConfig,
  type CodePays,
  type DataConfidence,
  type TrancheIRPP,
  type BrancheCNSS,
} from '@/lib/countries'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — INPUTS
// ═══════════════════════════════════════════════════════════════════════════════

export type SituationFamiliale =
  | 'celibataire'
  | 'marie'
  | 'divorce'
  | 'veuf'
  | 'concubinage'

export interface InputIRPP {
  codePays:                    CodePays
  /** Base IRPP mensuelle (brut imposable après déduction CNSS salarié) */
  salaireBrut:                 number
  situation:                   SituationFamiliale
  nombreEnfants:               number
  /** Active les mesures spéciales marquées `actif: true` dans CountryConfig */
  appliquerMesuresSpeciales?:  boolean
}

export interface InputChargesSociales {
  codePays:                    CodePays
  /** Salaire brut mensuel total (imposable + non-imposable selon pays) */
  salaireBrut:                 number
  appliquerMesuresSpeciales?:  boolean
}

export interface InputTVA {
  codePays:   CodePays
  montantHT:  number
  /** true = exportation → taux zéro */
  tauxZero?:  boolean
}

export interface InputIS {
  codePays:           CodePays
  beneficeNet:        number   // résultat fiscal annuel
  chiffreAffairesHT:  number   // CA annuel HT (pour minimum de perception)
}

export interface InputRetenueSource {
  codePays:    CodePays
  type:
    | 'dividendes_non_residents'
    | 'interets_non_residents'
    | 'redevances_non_residents'
    | 'prestations_non_residents'
    | 'honoraires_residents'
    | 'loyers_etat_entreprises'
  montantBrut: number
}

export interface InputFiscaliteEntreprise {
  codePays:           CodePays
  chiffre_affaires_ht: number
  benefice_net:        number
  tva_collectee:       number
  tva_deductible:      number
  retenues?: Array<{ type: InputRetenueSource['type']; montant: number }>
}

export interface InputResumeFiscalMensuel {
  codePays:                    CodePays
  periode:                     string      // 'YYYY-MM'
  salaireBrut:                 number
  situation:                   SituationFamiliale
  nombreEnfants:               number
  appliquerMesuresSpeciales?:  boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — OUTPUTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResultatTrancheIRPP {
  libelle:        string   // 'T1 (0%) — 0 → 38 667 FCFA'
  taux:           number
  base:           number   // montant dans cette tranche (par part)
  impot_par_part: number
  impot_total:    number   // par part × nombreParts
}

export interface ResultatIRPP {
  base_brut:                  number
  base_apres_abattement:      number
  abattement_montant:         number
  abattement_type:            string
  nombre_parts:               number
  base_par_part:              number
  tranches:                   ResultatTrancheIRPP[]
  irpp_avant_centimes:        number
  centimes_additionnels:      number
  irpp_total:                 number
  reduction_mesures_speciales: number
  irpp_net:                   number
  methode_base:               string
  source:                     string
}

export interface ResultatBrancheCNSS {
  code:            string
  libelle:         string
  base_calcul:     number
  plafond_applique: number | null
  taux_salarie:    number
  taux_patronal:   number
  montant_salarie: number
  montant_patronal: number
}

export interface ResultatChargesSociales {
  salaire_brut:                number
  branches:                    ResultatBrancheCNSS[]
  total_salarie:               number
  total_patronal_brut:         number
  reduction_mesures_speciales: number
  total_patronal_net:          number
  cout_total:                  number   // salarié + patronal net
  source:                      string
}

export interface ResultatTVA {
  montant_ht:           number
  tva_base:             number   // montantHT × taux_normal
  taxes_additionnelles: Array<{
    code:    string
    libelle: string
    taux:    number
    base:    'tva_collectee' | 'ca_ht' | 'is_calcule'
    montant: number
  }>
  tva_totale:           number   // tva_base + Σ additionnelles
  montant_ttc:          number
  taux_effectif:        number   // taux effectif sur HT depuis CountryConfig
  seuil_assujettissement: number
  source:               string
}

export interface ResultatIS {
  benefice_net:             number
  is_au_taux_standard:      number   // benefice × taux_standard
  is_minimum_ca:            number   // CA × taux_minimum_ca (si existant)
  is_du:                    number   // max(is_standard, is_minimum_ca)
  taxes_additionnelles:     Array<{ code: string; libelle: string; taux: number; montant: number }>
  is_total:                 number
  source:                   string
}

export interface ResultatRetenueSource {
  type:          string
  montant_brut:  number
  taux:          number
  retenue:       number
  montant_net:   number
  source:        string
}

export interface ResultatTaxeMinimale {
  applicable:   boolean
  base:         string   // 'benefice_net' | 'ca_ht'
  montant:      number
  taux_ou_min:  number
  source:       string
}

export interface ResultatFiscaliteEntreprise {
  codePays:             string
  nomPays:              string
  loi_reference:        string
  data_confidence:      DataConfidence
  tva:                  ResultatTVA
  is:                   ResultatIS
  retenues_source:      ResultatRetenueSource[]
  taxe_minimale:        ResultatTaxeMinimale
  total_charge_fiscale: number
}

export interface ResumeFiscalMensuel {
  codePays:                   string
  nomPays:                    string
  periode:                    string
  loi_reference:              string
  data_confidence:            DataConfidence
  irpp:                       ResultatIRPP
  charges_sociales:           ResultatChargesSociales
  taxes_fixes:                Array<{ code: string; libelle: string; montant: number }>
  total_retenues_salariales:  number
  total_charges_patronales:   number
  net_theorique:              number   // salaireBrut - total_retenues_salariales
  cout_employeur_mensuel:     number   // salaireBrut + total_charges_patronales
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS PRIVÉS
// ═══════════════════════════════════════════════════════════════════════════════

/** Calcule le nombre de parts fiscales selon le quotient familial du pays. */
function calcNombreParts(
  cfg: CountryConfig,
  situation: SituationFamiliale,
  nombreEnfants: number,
): number {
  const qf = cfg.irpp.quotient_familial
  if (!qf.actif) return 1

  let parts = qf.parts_base
  if (situation === 'marie') parts += qf.parts_marie
  parts += Math.max(0, nombreEnfants) * qf.parts_par_enfant
  if (qf.plafond_parts !== undefined) parts = Math.min(parts, qf.plafond_parts)
  return parts
}

/** Applique l'abattement configuré sur la base IRPP. */
function calcAbattement(
  cfg: CountryConfig,
  base: number,
): { base_apres: number; montant: number; type: string } {
  const ab = cfg.irpp.abattement
  switch (ab.type) {
    case 'aucun':
      return { base_apres: base, montant: 0, type: 'aucun' }

    case 'pct_brut':
    case 'pct_net_cnss': {
      const montant = Math.round(base * ab.valeur)
      return { base_apres: Math.max(0, base - montant), montant, type: ab.type }
    }

    case 'forfait_fixe': {
      const montant = Math.min(ab.valeur, base)
      return { base_apres: Math.max(0, base - montant), montant, type: 'forfait_fixe' }
    }
  }
}

/** Applique le barème progressif IRPP par part. Retourne le total non arrondi (arrondi après × parts). */
function appliquerBareme(
  baseParPart:  number,
  tranches:     TrancheIRPP[],
  diviseur:     number,  // 12 = annuelle_div12, 1 = mensuelle_directe
): { detail: ResultatTrancheIRPP[]; total_par_part: number } {
  const detail: ResultatTrancheIRPP[] = []
  let total = 0

  for (let i = 0; i < tranches.length; i++) {
    const t = tranches[i]
    const tMin = t.min / diviseur
    const tMax = t.max === Infinity ? Infinity : t.max / diviseur

    if (baseParPart <= tMin) break

    const base = (tMax === Infinity ? baseParPart : Math.min(baseParPart, tMax)) - tMin
    const impot = base * t.taux

    detail.push({
      libelle:        `T${i + 1} (${(t.taux * 100).toFixed(0)}%) — ${fmt(Math.round(tMin))} → ${tMax === Infinity ? '∞' : fmt(Math.round(tMax))} F`,
      taux:           t.taux,
      base:           Math.round(base),
      impot_par_part: Math.round(impot),
      impot_total:    0, // renseigné après multiplication par parts
    })

    total += impot
  }

  return { detail, total_par_part: total }
}

/** Formateur interne léger (pas d'import extérieur). */
function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS PUBLIQUES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IRPP/IPR/ITS mensuel pour un employé.
 *
 * Supporte :
 *  - CG (mensuelle_directe, quotient familial, abattement aucun — seuils mensuels Art. 76 CGI)
 *  - CM (annuelle_div12, CAC 10% sur IRPP, abattement 30%)
 *  - GA (annuelle_div12, 8 tranches, abattement 20%)
 *  - CD (mensuelle_directe, IPR, abattement aucun)
 *  - CF (annuelle_div12, ITS, abattement 15%)
 *  - TD (annuelle_div12, IS salaires, abattement 10%)
 *  - GQ (annuelle_div12, IRPF, abattement 10%)
 */
export function calculerIRPP(input: InputIRPP): ResultatIRPP {
  const cfg = getCountryConfig(input.codePays)
  const irppCfg = cfg.irpp

  // 1. Abattement
  const { base_apres: baseApresAbatt, montant: abattementMontant, type: abattType }
    = calcAbattement(cfg, input.salaireBrut)

  // 2. Parts fiscales
  const nombreParts = calcNombreParts(cfg, input.situation, input.nombreEnfants)

  // 3. Base par part
  const baseParPart = nombreParts > 0 ? baseApresAbatt / nombreParts : 0

  // 4. Diviseur : 12 pour seuils annuels, 1 pour seuils mensuels directs
  const diviseur = irppCfg.methode_base === 'annuelle_div12' ? 12 : 1

  // 5. Barème progressif
  const { detail, total_par_part: totalParPart } = appliquerBareme(baseParPart, irppCfg.tranches, diviseur)

  // 6. Total IRPP avant centimes (arrondi unique après × parts, comme congo-calculs.ts)
  const irppAvantCentimes = Math.round(totalParPart * nombreParts)

  // 7. Renseigner impot_total par tranche (× parts)
  for (const t of detail) {
    t.impot_total = Math.round(t.impot_par_part * nombreParts)
  }

  // 8. Centimes additionnels (Cameroun CAC 10% sur IRPP calculé)
  const centimes = irppCfg.centimes_additionnels
    ? Math.round(irppAvantCentimes * irppCfg.centimes_additionnels)
    : 0

  const irppTotal = irppAvantCentimes + centimes

  // 9. Mesures spéciales actives
  let reduction = 0
  if (input.appliquerMesuresSpeciales) {
    for (const mesure of irppCfg.mesures_speciales ?? []) {
      if (mesure.actif) {
        reduction += Math.round(irppTotal * mesure.reduction)
      }
    }
  }
  const irppNet = Math.max(0, irppTotal - reduction)

  return {
    base_brut:                  input.salaireBrut,
    base_apres_abattement:      baseApresAbatt,
    abattement_montant:         abattementMontant,
    abattement_type:            abattType,
    nombre_parts:               nombreParts,
    base_par_part:              Math.round(baseParPart),
    tranches:                   detail,
    irpp_avant_centimes:        irppAvantCentimes,
    centimes_additionnels:      centimes,
    irpp_total:                 irppTotal,
    reduction_mesures_speciales: reduction,
    irpp_net:                   irppNet,
    methode_base:               irppCfg.methode_base,
    source:                     irppCfg.source,
  }
}

/**
 * Calcule les charges sociales (CNSS/CNPS/INSS/INSESO) pour un brut mensuel.
 *
 * Itère sur toutes les branches définies dans CountryConfig.cnss.branches.
 * Applique le plafond de chaque branche indépendamment.
 * Compatible avec les structures CG (5 branches avec plafonds distincts),
 * CM (CNPS + CFC + FNE), CD (INSS déplafonné), GQ (INSESO), etc.
 */
export function calculerChargesSociales(input: InputChargesSociales): ResultatChargesSociales {
  const cfg = getCountryConfig(input.codePays)
  const cnss = cfg.cnss

  const branches: ResultatBrancheCNSS[] = []
  let totalSalarie     = 0
  let totalPatronalBrut = 0

  for (const branch of cnss.branches) {
    const base = branch.plafond_mensuel !== null
      ? Math.min(input.salaireBrut, branch.plafond_mensuel)
      : input.salaireBrut

    const montant_salarie  = Math.round(base * branch.taux_salarie)
    const montant_patronal = Math.round(base * branch.taux_patronal)

    branches.push({
      code:             branch.code,
      libelle:          branch.libelle,
      base_calcul:      base,
      plafond_applique: branch.plafond_mensuel,
      taux_salarie:     branch.taux_salarie,
      taux_patronal:    branch.taux_patronal,
      montant_salarie,
      montant_patronal,
    })

    totalSalarie      += montant_salarie
    totalPatronalBrut += montant_patronal
  }

  // Médecine du travail (taux séparé, déplafonné)
  if (cnss.medecine_travail_taux) {
    const montant = Math.round(input.salaireBrut * cnss.medecine_travail_taux)
    branches.push({
      code:             'MED_TRAV',
      libelle:          'Médecine du travail',
      base_calcul:      input.salaireBrut,
      plafond_applique: null,
      taux_salarie:     0,
      taux_patronal:    cnss.medecine_travail_taux,
      montant_salarie:  0,
      montant_patronal: montant,
    })
    totalPatronalBrut += montant
  }

  // Mesures spéciales actives (ex: LF 2026 — État prend en charge 50% patronal hors TUS)
  let reductionMesures = 0
  if (input.appliquerMesuresSpeciales) {
    for (const mesure of cnss.mesures_speciales ?? []) {
      if (mesure.actif) {
        const patronalHorsTUS = branches
          .filter(b => !b.code.startsWith('TUS'))
          .reduce((s, b) => s + b.montant_patronal, 0)
        reductionMesures += Math.round(patronalHorsTUS * mesure.reduction_patronal)
      }
    }
  }

  const totalPatronalNet = Math.max(0, totalPatronalBrut - reductionMesures)

  return {
    salaire_brut:                input.salaireBrut,
    branches,
    total_salarie:               totalSalarie,
    total_patronal_brut:         totalPatronalBrut,
    reduction_mesures_speciales: reductionMesures,
    total_patronal_net:          totalPatronalNet,
    cout_total:                  totalSalarie + totalPatronalNet,
    source:                      cnss.source,
  }
}

/**
 * Calcule la TVA due sur un montant HT.
 *
 * Gère : TVA de base + taxes additionnelles sur tva_collectee (CAC Cameroun)
 * ou sur CA HT selon la configuration du pays.
 */
export function calculerTVA(input: InputTVA): ResultatTVA {
  const cfg = getCountryConfig(input.codePays)
  const tvaCfg = cfg.tva

  if (input.tauxZero) {
    return {
      montant_ht:              input.montantHT,
      tva_base:                0,
      taxes_additionnelles:    [],
      tva_totale:              0,
      montant_ttc:             input.montantHT,
      taux_effectif:           0,
      seuil_assujettissement:  tvaCfg.seuil_assujettissement,
      source:                  tvaCfg.source,
    }
  }

  const tvaBase = Math.round(input.montantHT * tvaCfg.taux_normal)

  const addTaxes: ResultatTVA['taxes_additionnelles'] = []
  let totalAdd = 0

  for (const ta of tvaCfg.taxes_additionnelles) {
    const baseCalc = ta.base === 'tva_collectee' ? tvaBase : input.montantHT
    const montant  = Math.round(baseCalc * ta.taux)
    addTaxes.push({ code: ta.code, libelle: ta.libelle, taux: ta.taux, base: ta.base, montant })
    totalAdd += montant
  }

  const tvaTotale = tvaBase + totalAdd

  return {
    montant_ht:              input.montantHT,
    tva_base:                tvaBase,
    taxes_additionnelles:    addTaxes,
    tva_totale:              tvaTotale,
    montant_ttc:             input.montantHT + tvaTotale,
    taux_effectif:           tvaCfg.taux_effectif_sur_ht,
    seuil_assujettissement:  tvaCfg.seuil_assujettissement,
    source:                  tvaCfg.source,
  }
}

/**
 * Calcule l'Impôt sur les Sociétés annuel.
 *
 * Applique : IS standard + minimum de perception sur CA (si configuré) + taxes additionnelles.
 */
export function calculerIS(input: InputIS): ResultatIS {
  const cfg  = getCountryConfig(input.codePays)
  const isCfg = cfg.is

  const isStandard  = Math.round(Math.max(0, input.beneficeNet) * isCfg.taux_standard)
  const isMinimumCA = isCfg.taux_minimum_ca
    ? Math.round(input.chiffreAffairesHT * isCfg.taux_minimum_ca)
    : (isCfg.minimum_montant ?? 0)

  const isDu = Math.max(isStandard, isMinimumCA)

  const addTaxes: ResultatIS['taxes_additionnelles'] = []
  let totalAdd = 0
  for (const ta of isCfg.taxes_additionnelles ?? []) {
    // IS's taxes additionnelles use the IS calculated as base (base 'tva_collectee' field is IS context)
    const montant = Math.round(isDu * ta.taux)
    addTaxes.push({ code: ta.code, libelle: ta.libelle, taux: ta.taux, montant })
    totalAdd += montant
  }

  return {
    benefice_net:         input.beneficeNet,
    is_au_taux_standard:  isStandard,
    is_minimum_ca:        isMinimumCA,
    is_du:                isDu,
    taxes_additionnelles: addTaxes,
    is_total:             isDu + totalAdd,
    source:               isCfg.source,
  }
}

/**
 * Calcule la retenue à la source sur un paiement.
 */
export function calculerRetenueSource(input: InputRetenueSource): ResultatRetenueSource {
  const cfg  = getCountryConfig(input.codePays)
  const rsCfg = cfg.retenues_source

  const taux = rsCfg[input.type] ?? 0
  const retenue  = Math.round(input.montantBrut * taux)

  return {
    type:        input.type,
    montant_brut: input.montantBrut,
    taux,
    retenue,
    montant_net: input.montantBrut - retenue,
    source:      rsCfg.source,
  }
}

/**
 * Calcule le minimum de taxe applicable (minimum de perception IS).
 */
export function calculerTaxeMinimale(input: {
  codePays: CodePays
  chiffreAffairesHT: number
  beneficeNet: number
}): ResultatTaxeMinimale {
  const cfg  = getCountryConfig(input.codePays)
  const isCfg = cfg.is

  if (isCfg.taux_minimum_ca) {
    const montant = Math.round(input.chiffreAffairesHT * isCfg.taux_minimum_ca)
    return {
      applicable:  montant > 0,
      base:        'ca_ht',
      montant,
      taux_ou_min: isCfg.taux_minimum_ca,
      source:      isCfg.source,
    }
  }

  if (isCfg.minimum_montant) {
    return {
      applicable:  true,
      base:        'benefice_net',
      montant:     isCfg.minimum_montant,
      taux_ou_min: isCfg.minimum_montant,
      source:      isCfg.source,
    }
  }

  return {
    applicable:  false,
    base:        'benefice_net',
    montant:     0,
    taux_ou_min: 0,
    source:      isCfg.source,
  }
}

/**
 * Calcule la fiscalité entreprise complète pour un exercice :
 * TVA + IS + retenues à la source + minimum de perception.
 */
export function calculerFiscaliteEntreprise(
  input: InputFiscaliteEntreprise,
): ResultatFiscaliteEntreprise {
  const cfg = getCountryConfig(input.codePays)

  // TVA à reverser = collectée - déductible
  const tvaBrute    = Math.round(input.tva_collectee)
  const tvaDeduct   = Math.round(input.tva_deductible)
  const tvaAReverser = Math.max(0, tvaBrute - tvaDeduct)

  // Calcul TVA via engine (base HT reconstituée)
  const tvaCfg = cfg.tva
  const tvaAdd  = tvaCfg.taxes_additionnelles.reduce(
    (s, ta) => s + Math.round((ta.base === 'tva_collectee' ? tvaBrute : input.chiffre_affaires_ht) * ta.taux),
    0,
  )
  const tvaResultat: ResultatTVA = {
    montant_ht:              input.chiffre_affaires_ht,
    tva_base:                tvaBrute,
    taxes_additionnelles:    tvaCfg.taxes_additionnelles.map(ta => ({
      code:    ta.code,
      libelle: ta.libelle,
      taux:    ta.taux,
      base:    ta.base,
      montant: Math.round((ta.base === 'tva_collectee' ? tvaBrute : input.chiffre_affaires_ht) * ta.taux),
    })),
    tva_totale:              tvaAReverser + tvaAdd,
    montant_ttc:             input.chiffre_affaires_ht + tvaBrute,
    taux_effectif:           tvaCfg.taux_effectif_sur_ht,
    seuil_assujettissement:  tvaCfg.seuil_assujettissement,
    source:                  tvaCfg.source,
  }

  // IS
  const isResultat = calculerIS({
    codePays:          input.codePays,
    beneficeNet:       input.benefice_net,
    chiffreAffairesHT: input.chiffre_affaires_ht,
  })

  // Retenues à la source
  const retenues = (input.retenues ?? []).map(r =>
    calculerRetenueSource({ codePays: input.codePays, type: r.type, montantBrut: r.montant }),
  )
  const totalRetenues = retenues.reduce((s, r) => s + r.retenue, 0)

  // Minimum de perception
  const taxeMin = calculerTaxeMinimale({
    codePays: input.codePays,
    chiffreAffairesHT: input.chiffre_affaires_ht,
    beneficeNet: input.benefice_net,
  })

  const totalChargeFiscale = tvaAReverser + tvaAdd + isResultat.is_total + totalRetenues

  return {
    codePays:             cfg.code_pays,
    nomPays:              cfg.nom_pays,
    loi_reference:        cfg.loi_reference,
    data_confidence:      cfg.data_confidence,
    tva:                  tvaResultat,
    is:                   isResultat,
    retenues_source:      retenues,
    taxe_minimale:        taxeMin,
    total_charge_fiscale: totalChargeFiscale,
  }
}

/**
 * Génère un résumé fiscal mensuel complet pour un salarié.
 *
 * Chaîne interne : salaireBrut → CNSS → base_irpp → IRPP → taxes_fixes → totaux
 *
 * Note : Ce résumé n'est pas connecté aux écrans existants.
 *        Il constitue la fondation Phase 1.3 destinée à remplacer
 *        progressivement congo-calculs.ts (CG) et calcul-paie.ts.
 */
export function genererResumeFiscalMensuel(
  input: InputResumeFiscalMensuel,
): ResumeFiscalMensuel {
  const cfg = getCountryConfig(input.codePays)

  // 1. Charges sociales sur brut complet
  const cs = calculerChargesSociales({
    codePays:                   input.codePays,
    salaireBrut:                input.salaireBrut,
    appliquerMesuresSpeciales:  input.appliquerMesuresSpeciales,
  })

  // 2. Base IRPP = brut - CNSS salarié
  const baseIRPP = Math.max(0, input.salaireBrut - cs.total_salarie)

  // 3. IRPP
  const irpp = calculerIRPP({
    codePays:                   input.codePays,
    salaireBrut:                baseIRPP,
    situation:                  input.situation,
    nombreEnfants:              input.nombreEnfants,
    appliquerMesuresSpeciales:  input.appliquerMesuresSpeciales,
  })

  // 4. Taxes fixes (ex: TOL Congo 1 000 F/mois)
  const taxesFixes = cfg.taxes_fixes
    .filter(t => t.actif && t.periodicite === 'mensuel')
    .map(t => ({ code: t.code, libelle: t.libelle, montant: t.montant }))

  const totalTaxesFixes = taxesFixes.reduce((s, t) => s + t.montant, 0)

  // 5. Totaux
  const totalRetenuesSalariales = cs.total_salarie + irpp.irpp_net + totalTaxesFixes
  const netTheorique = Math.max(0, input.salaireBrut - totalRetenuesSalariales)
  const coutEmployeur = input.salaireBrut + cs.total_patronal_net

  return {
    codePays:                  cfg.code_pays,
    nomPays:                   cfg.nom_pays,
    periode:                   input.periode,
    loi_reference:             cfg.loi_reference,
    data_confidence:           cfg.data_confidence,
    irpp,
    charges_sociales:          cs,
    taxes_fixes:               taxesFixes,
    total_retenues_salariales: totalRetenuesSalariales,
    total_charges_patronales:  cs.total_patronal_net,
    net_theorique:             netTheorique,
    cout_employeur_mensuel:    coutEmployeur,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES PUBLICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne le taux CNSS salarié effectif pour un pays.
 * Utile pour affichage et exports.
 */
export function getTauxCNSSSalarie(codePays: CodePays): number {
  const cfg = getCountryConfig(codePays)
  return cfg.cnss.branches.reduce((s, b) => s + b.taux_salarie, 0)
}

/**
 * Retourne le taux CNSS patronal effectif pour un pays (hors plafonds).
 */
export function getTauxCNSSPatronal(codePays: CodePays): number {
  const cfg = getCountryConfig(codePays)
  return cfg.cnss.branches.reduce((s, b) => s + b.taux_patronal, 0)
}

/**
 * Vérifie si une entreprise est assujettie à la TVA pour un pays donné.
 */
export function isAssujettieTVA(codePays: CodePays, chiffreAffairesAnnuelHT: number): boolean {
  const cfg = getCountryConfig(codePays)
  return chiffreAffairesAnnuelHT >= cfg.tva.seuil_assujettissement
}

/**
 * Retourne le SMIG mensuel du pays.
 */
export function getSMIG(codePays: CodePays): { montant: number; devise: string; source: string } {
  const cfg = getCountryConfig(codePays)
  return { montant: cfg.smig, devise: cfg.devise, source: cfg.smig_source }
}

/**
 * Retourne le niveau de confiance des données fiscales du pays.
 */
export function getDataConfidence(codePays: CodePays): {
  niveau: DataConfidence
  loi_reference: string
  mise_a_jour: string
} {
  const cfg = getCountryConfig(codePays)
  return {
    niveau:        cfg.data_confidence,
    loi_reference: cfg.loi_reference,
    mise_a_jour:   cfg.derniere_mise_a_jour,
  }
}

// Re-export pour faciliter les imports des consommateurs
export type { CodePays, DataConfidence, CountryConfig }
