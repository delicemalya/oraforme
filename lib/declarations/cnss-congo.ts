/**
 * Déclaration CNSS Congo-Brazzaville — préparation du document officiel.
 *
 * Ce module ne détient AUCUN taux ni AUCUN plafond. Il agrège, met en forme et
 * nomme ; les montants viennent tous de calculerChargesSociales(), qui les tire
 * de lib/countries/CG.ts.
 *
 * ── Pourquoi cette règle ──────────────────────────────────────────────────────
 * Le module portait auparavant ses propres constantes, et l'une d'elles était
 * fausse : les allocations familiales étaient assises sur le plafond AT/MP de
 * 600 000 F au lieu de leur propre plafond de 1 200 000 F. Pour un salarié à
 * 1 500 000 F de brut, la déclaration sous-déclarait 60 240 F par mois. Le
 * défaut n'était visible nulle part parce que les taux imprimés provenaient du
 * même fichier que le calcul : le document était cohérent avec lui-même et faux
 * par rapport au droit.
 *
 * Les documents (PDF, Excel, écran) doivent rendre `recap.branches`, jamais
 * réécrire un taux ou un plafond en dur. Le test d'architecture
 * lib/architecture/documents-fiscaux.test.ts fait échouer toute réintroduction.
 */

import {
  calculerChargesSociales,
  type CodePays,
} from '@/lib/fiscal/universal-tax-engine'

/** Pays de cette déclaration. La CNSS congolaise n'existe qu'au Congo. */
const PAYS: CodePays = 'CG'

export const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmployeInput {
  employe_id?: string
  nom: string
  postnom?: string | null
  prenom: string
  numero_cnss?: string | null
  matricule?: string | null
  poste?: string | null
  salaire_brut: number
}

/** Une branche de cotisation telle qu'elle doit apparaître sur le document. */
export interface BrancheDeclaree {
  code:             string
  libelle:          string
  taux_salarie:     number
  taux_patronal:    number
  plafond_mensuel:  number | null
  base_totale:      number
  montant_salarie:  number
  montant_patronal: number
}

export interface EmployeDeclaration extends EmployeInput {
  numero_ordre: number
  numero_cnss: string
  salaire_brut: number
  /** Détail par branche, avec son propre plafond. Source du rendu documentaire. */
  branches: BrancheDeclaree[]
  base_vieillesse: number
  cotisation_employe: number
  cotisation_vieillesse: number
  /** Base des allocations familiales — plafond propre, distinct de l'AT/MP. */
  base_allocations_familiales: number
  /** Base accidents du travail / maladie professionnelle. */
  base_at_mp_pf: number
  allocations_familiales: number
  accidents_travail: number
  cotisation_at_mp_pf: number
  cotisation_tus: number
  total_patronal: number
  total_a_verser: number
}

export interface RecapCNSS {
  nb_employes: number
  masse_salariale: number
  /** Agrégat par branche — ce que le document doit imprimer. */
  branches: BrancheDeclaree[]
  base_vieillesse_total: number
  cotisation_vieillesse_employe: number
  cotisation_vieillesse_patronal: number
  base_allocations_familiales_total: number
  base_at_mp_pf_total: number
  allocations_familiales_total: number
  accidents_travail_total: number
  cotisation_at_mp_pf_total: number
  cotisation_tus_total: number
  total_cotisations_patronales: number
  total_cotisations_employes: number
  total_a_verser: number
  total_sans_tus: number
}

export interface DeclarationCNSS {
  id?: string
  tenant_id: string
  mois: number
  annee: number
  reference?: string | null
  statut: 'brouillon' | 'validee' | 'deposee' | 'payee' | 'annulee'
  employes: EmployeDeclaration[]
  recap: RecapCNSS
  date_depot?: string | null
  date_paiement?: string | null
  reference_depot?: string | null
  notes?: string | null
  pre_rempli_depuis_paie?: boolean
}

// ── Accès aux branches par code ───────────────────────────────────────────────

function brancheParCode(branches: BrancheDeclaree[], code: string): BrancheDeclaree | undefined {
  return branches.find(b => b.code === code)
}

/** Taux effectif imprimable, dérivé des montants réellement liquidés. */
export function tauxEffectif(base: number, montant: number): number {
  return base > 0 ? montant / base : 0
}

// ── Calcul par salarié ────────────────────────────────────────────────────────

export function calculerCNSSEmploye(num: number, e: EmployeInput): EmployeDeclaration {
  const brut = Math.max(0, Math.round(e.salaire_brut))

  // appliquerMesuresSpeciales: false — la déclaration porte la cotisation due au
  // droit commun. La prise en charge partielle prévue par la LF 2026 est une
  // mesure d'exécution, inactive tant qu'elle n'est pas confirmée (CG.ts).
  const charges = calculerChargesSociales({
    codePays: PAYS,
    salaireBrut: brut,
    appliquerMesuresSpeciales: false,
  })

  const branches: BrancheDeclaree[] = charges.branches.map(b => ({
    code:             b.code,
    libelle:          b.libelle,
    taux_salarie:     b.taux_salarie,
    taux_patronal:    b.taux_patronal,
    plafond_mensuel:  b.plafond_applique,
    base_totale:      b.base_calcul,
    montant_salarie:  b.montant_salarie,
    montant_patronal: b.montant_patronal,
  }))

  const vidSal = brancheParCode(branches, 'VID_SAL')
  const vidPat = brancheParCode(branches, 'VID_PAT')
  const af     = brancheParCode(branches, 'AF')
  const at     = brancheParCode(branches, 'AT')
  const tus    = brancheParCode(branches, 'TUS')

  const allocations_familiales = af?.montant_patronal ?? 0
  const accidents_travail      = at?.montant_patronal ?? 0

  return {
    ...e,
    numero_ordre:                num,
    numero_cnss:                 e.numero_cnss ?? '—',
    salaire_brut:                brut,
    branches,
    base_vieillesse:             vidSal?.base_totale ?? vidPat?.base_totale ?? 0,
    cotisation_employe:          charges.total_salarie,
    cotisation_vieillesse:       vidPat?.montant_patronal ?? 0,
    base_allocations_familiales: af?.base_totale ?? 0,
    base_at_mp_pf:               at?.base_totale ?? 0,
    allocations_familiales,
    accidents_travail,
    cotisation_at_mp_pf:         allocations_familiales + accidents_travail,
    cotisation_tus:              tus?.montant_patronal ?? 0,
    total_patronal:              charges.total_patronal_net,
    total_a_verser:              charges.cout_total,
  }
}

// ── Récapitulatif global ───────────────────────────────────────────────────────

export function calculerDeclarationGlobale(employes: EmployeDeclaration[]): RecapCNSS {
  // Agrégat branche par branche, en gardant le libellé, le taux et le plafond
  // tels que le moteur les a fournis : le document n'a rien à réécrire.
  const parCode = new Map<string, BrancheDeclaree>()
  for (const emp of employes) {
    for (const b of emp.branches) {
      const acc = parCode.get(b.code)
      if (!acc) {
        parCode.set(b.code, { ...b })
      } else {
        acc.base_totale      += b.base_totale
        acc.montant_salarie  += b.montant_salarie
        acc.montant_patronal += b.montant_patronal
      }
    }
  }
  const branches = [...parCode.values()]

  const s = employes.reduce(
    (a, e) => ({
      masse: a.masse + e.salaire_brut,
      bv:    a.bv    + e.base_vieillesse,
      ce:    a.ce    + e.cotisation_employe,
      cv:    a.cv    + e.cotisation_vieillesse,
      baf:   a.baf   + e.base_allocations_familiales,
      bat:   a.bat   + e.base_at_mp_pf,
      af:    a.af    + e.allocations_familiales,
      at:    a.at    + e.accidents_travail,
      cat:   a.cat   + e.cotisation_at_mp_pf,
      tus:   a.tus   + e.cotisation_tus,
    }),
    { masse: 0, bv: 0, ce: 0, cv: 0, baf: 0, bat: 0, af: 0, at: 0, cat: 0, tus: 0 },
  )

  const total_cotisations_patronales = s.cv + s.cat + s.tus
  const total_cotisations_employes   = s.ce
  const total_a_verser               = total_cotisations_patronales + total_cotisations_employes
  const total_sans_tus               = s.cv + s.cat + s.ce

  return {
    nb_employes:                       employes.length,
    masse_salariale:                   s.masse,
    branches,
    base_vieillesse_total:             s.bv,
    cotisation_vieillesse_employe:     s.ce,
    cotisation_vieillesse_patronal:    s.cv,
    base_allocations_familiales_total: s.baf,
    base_at_mp_pf_total:               s.bat,
    allocations_familiales_total:      s.af,
    accidents_travail_total:           s.at,
    cotisation_at_mp_pf_total:         s.cat,
    cotisation_tus_total:              s.tus,
    total_cotisations_patronales,
    total_cotisations_employes,
    total_a_verser,
    total_sans_tus,
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

export function fmtCNSS(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

/** Taux imprimable, dérivé du moteur — jamais saisi à la main dans un document. */
export function fmtTaux(taux: number): string {
  return `${(taux * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`
}

/** Plafond imprimable, ou la mention explicite quand la branche est déplafonnée. */
export function fmtPlafond(plafond: number | null): string {
  return plafond === null ? 'déplafonné' : `${new Intl.NumberFormat('fr-FR').format(plafond)} FCFA`
}

export function genererReference(mois: number, annee: number): string {
  return `CNSS-${annee}-${String(mois).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`
}

// ── Auto-test conservé, valeurs corrigées ─────────────────────────────────────
//
// Les attendus précédents consacraient le défaut : ils exigeaient
// cotisation_at_mp_pf = 73 680 pour tout brut, montant obtenu en assoyant les
// allocations familiales sur le plafond AT/MP de 600 000 F. Les attendus
// ci-dessous sont ceux de lib/countries/CG.ts, branche par branche.
// La couverture réelle est dans lib/declarations/cnss-congo.test.ts.

export function _selfTestCNSS(): boolean {
  const c1 = calculerCNSSEmploye(1, { nom: 'T', prenom: 'A', salaire_brut: 900_000 })
  if (c1.cotisation_employe     !== 36_000)  throw new Error(`CAS1 employé: attendu 36000, obtenu ${c1.cotisation_employe}`)
  if (c1.cotisation_vieillesse  !== 72_000)  throw new Error(`CAS1 VID: attendu 72000, obtenu ${c1.cotisation_vieillesse}`)
  if (c1.allocations_familiales !== 90_315)  throw new Error(`CAS1 AF: attendu 90315, obtenu ${c1.allocations_familiales}`)
  if (c1.accidents_travail      !== 13_500)  throw new Error(`CAS1 AT: attendu 13500, obtenu ${c1.accidents_travail}`)
  if (c1.cotisation_tus         !== 27_000)  throw new Error(`CAS1 TUS: attendu 27000, obtenu ${c1.cotisation_tus}`)

  const c2 = calculerCNSSEmploye(2, { nom: 'T', prenom: 'B', salaire_brut: 1_500_000 })
  if (c2.cotisation_employe     !== 48_000)  throw new Error(`CAS2 employé: attendu 48000, obtenu ${c2.cotisation_employe}`)
  if (c2.cotisation_vieillesse  !== 96_000)  throw new Error(`CAS2 VID: attendu 96000, obtenu ${c2.cotisation_vieillesse}`)
  if (c2.allocations_familiales !== 120_420) throw new Error(`CAS2 AF: attendu 120420, obtenu ${c2.allocations_familiales}`)
  if (c2.accidents_travail      !== 13_500)  throw new Error(`CAS2 AT: attendu 13500, obtenu ${c2.accidents_travail}`)
  if (c2.cotisation_tus         !== 45_000)  throw new Error(`CAS2 TUS: attendu 45000, obtenu ${c2.cotisation_tus}`)

  return true
}
