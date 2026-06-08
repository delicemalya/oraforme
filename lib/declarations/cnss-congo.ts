/**
 * Moteur officiel CNSS Congo-Brazzaville — Télédéclaration
 * Taux officiels CNSS (arrêtés CNSS + Code CNSS Congo — validés ECAM 2024)
 *
 * Vieillesse : 4% salarié + 8% patronal — plafond 1 200 000 FCFA/mois
 * AT/MP/PF   : 10.03% AF + 2.25% AT = 12.28% patronal — plafond 600 000 FCFA/mois
 * TUS        : 3% patronal — déplafonné
 */

// ── Constantes officielles ────────────────────────────────────────────────────

export const PLAFOND_VIEILLESSE       = 1_200_000
export const PLAFOND_AT_MP_PF         = 600_000
export const TAUX_VIEILLESSE_EMPLOYE  = 0.04
export const TAUX_VIEILLESSE_PATRONAL = 0.08
export const TAUX_ALLOC_FAMILIALES    = 0.1003
export const TAUX_ACCIDENTS_TRAVAIL   = 0.0225
export const TAUX_AT_MP_PF            = TAUX_ALLOC_FAMILIALES + TAUX_ACCIDENTS_TRAVAIL // 0.1228
export const TAUX_TUS                 = 0.03

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

export interface EmployeDeclaration extends EmployeInput {
  numero_ordre: number
  numero_cnss: string
  salaire_brut: number
  base_vieillesse: number
  cotisation_employe: number       // 4% part salarié
  cotisation_vieillesse: number    // 8% patronal
  base_at_mp_pf: number
  allocations_familiales: number   // 10.03%
  accidents_travail: number        // 2.25%
  cotisation_at_mp_pf: number      // = AF + AT
  cotisation_tus: number           // 3% sur brut
  total_patronal: number
  total_a_verser: number           // employe + patronal
}

export interface RecapCNSS {
  nb_employes: number
  masse_salariale: number
  base_vieillesse_total: number
  cotisation_vieillesse_employe: number
  cotisation_vieillesse_patronal: number
  base_at_mp_pf_total: number
  allocations_familiales_total: number
  accidents_travail_total: number
  cotisation_at_mp_pf_total: number
  cotisation_tus_total: number
  total_cotisations_patronales: number
  total_cotisations_employes: number
  total_a_verser: number
  total_sans_tus: number           // pour fichier CNSS only (sans TUS)
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

// ── Calcul par salarié ────────────────────────────────────────────────────────

export function calculerCNSSEmploye(num: number, e: EmployeInput): EmployeDeclaration {
  const brut = Math.max(0, Math.round(e.salaire_brut))

  const base_vieillesse       = Math.min(brut, PLAFOND_VIEILLESSE)
  const cotisation_employe    = Math.round(base_vieillesse * TAUX_VIEILLESSE_EMPLOYE)
  const cotisation_vieillesse = Math.round(base_vieillesse * TAUX_VIEILLESSE_PATRONAL)

  const base_at_mp_pf          = Math.min(brut, PLAFOND_AT_MP_PF)
  const allocations_familiales = Math.round(base_at_mp_pf * TAUX_ALLOC_FAMILIALES)
  const accidents_travail      = Math.round(base_at_mp_pf * TAUX_ACCIDENTS_TRAVAIL)
  const cotisation_at_mp_pf    = allocations_familiales + accidents_travail

  const cotisation_tus    = Math.round(brut * TAUX_TUS)
  const total_patronal    = cotisation_vieillesse + cotisation_at_mp_pf + cotisation_tus
  const total_a_verser    = cotisation_employe + total_patronal

  return {
    ...e,
    numero_ordre:           num,
    numero_cnss:            e.numero_cnss ?? '—',
    salaire_brut:           brut,
    base_vieillesse,
    cotisation_employe,
    cotisation_vieillesse,
    base_at_mp_pf,
    allocations_familiales,
    accidents_travail,
    cotisation_at_mp_pf,
    cotisation_tus,
    total_patronal,
    total_a_verser,
  }
}

// ── Récapitulatif global ───────────────────────────────────────────────────────

export function calculerDeclarationGlobale(employes: EmployeDeclaration[]): RecapCNSS {
  const s = employes.reduce(
    (a, e) => ({
      masse:   a.masse   + e.salaire_brut,
      bv:      a.bv      + e.base_vieillesse,
      ce:      a.ce      + e.cotisation_employe,
      cv:      a.cv      + e.cotisation_vieillesse,
      bat:     a.bat     + e.base_at_mp_pf,
      af:      a.af      + e.allocations_familiales,
      at:      a.at      + e.accidents_travail,
      cat:     a.cat     + e.cotisation_at_mp_pf,
      tus:     a.tus     + e.cotisation_tus,
    }),
    { masse: 0, bv: 0, ce: 0, cv: 0, bat: 0, af: 0, at: 0, cat: 0, tus: 0 }
  )

  const total_cotisations_patronales = s.cv + s.cat + s.tus
  const total_cotisations_employes   = s.ce
  const total_a_verser               = total_cotisations_patronales + total_cotisations_employes
  const total_sans_tus               = s.cv + s.cat + s.ce

  return {
    nb_employes:                    employes.length,
    masse_salariale:                s.masse,
    base_vieillesse_total:          s.bv,
    cotisation_vieillesse_employe:  s.ce,
    cotisation_vieillesse_patronal: s.cv,
    base_at_mp_pf_total:            s.bat,
    allocations_familiales_total:   s.af,
    accidents_travail_total:        s.at,
    cotisation_at_mp_pf_total:      s.cat,
    cotisation_tus_total:           s.tus,
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

export function genererReference(mois: number, annee: number): string {
  return `CNSS-${annee}-${String(mois).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`
}

// ── Auto-tests (zéro erreur de calcul) ────────────────────────────────────────

export function _selfTestCNSS(): boolean {
  const c1 = calculerCNSSEmploye(1, { nom: 'T', prenom: 'A', salaire_brut: 900_000 })
  if (c1.cotisation_employe    !== 36_000) throw new Error(`CAS1 employé: attendu 36000, obtenu ${c1.cotisation_employe}`)
  if (c1.cotisation_vieillesse !== 72_000) throw new Error(`CAS1 VID: attendu 72000, obtenu ${c1.cotisation_vieillesse}`)
  if (c1.cotisation_at_mp_pf  !== 73_680) throw new Error(`CAS1 AT: attendu 73680, obtenu ${c1.cotisation_at_mp_pf}`)
  if (c1.cotisation_tus        !== 27_000) throw new Error(`CAS1 TUS: attendu 27000, obtenu ${c1.cotisation_tus}`)

  const c2 = calculerCNSSEmploye(2, { nom: 'T', prenom: 'B', salaire_brut: 1_500_000 })
  if (c2.cotisation_employe    !== 48_000) throw new Error(`CAS2 employé: attendu 48000, obtenu ${c2.cotisation_employe}`)
  if (c2.cotisation_vieillesse !== 96_000) throw new Error(`CAS2 VID: attendu 96000, obtenu ${c2.cotisation_vieillesse}`)
  if (c2.cotisation_at_mp_pf  !== 73_680) throw new Error(`CAS2 AT: attendu 73680, obtenu ${c2.cotisation_at_mp_pf}`)
  if (c2.cotisation_tus        !== 45_000) throw new Error(`CAS2 TUS: attendu 45000, obtenu ${c2.cotisation_tus}`)

  return true
}
