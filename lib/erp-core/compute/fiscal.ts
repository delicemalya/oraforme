/**
 * lib/erp-core/compute/fiscal.ts
 *
 * UNIQUE source de vérité pour les agrégations fiscales depuis bulletins_paie.
 * Remplace la logique inline dans :
 *   - app/api/fiscalite/irpp/route.ts
 *   - app/api/fiscalite/cnss/route.ts
 *   - app/api/agents/rh/bulletins/route.ts
 *
 * NE RECALCULE PAS — agrège les valeurs déjà calculées et stockées
 * dans bulletins_paie (brut, cnss_salarie, cnss_patronal, irpp, net).
 *
 * Pour les TAUX FISCAUX PAR PAYS → voir lib/fiscal/universal-tax-engine.ts
 * FONCTIONS DE CALCUL BRUT → voir lib/paie/calcul-paie.ts (INTOUCHABLE)
 *
 * Pays de référence : Congo-Brazzaville (LF n°42-2025 du 31/12/2025)
 * Extension multi-pays : CodePays via lib/countries/
 */

import { MONTH_LABELS_FR } from '@/lib/erp-core/filters/context'

// ── Types entrée ──────────────────────────────────────────────────────────────

/** Colonnes minimales de bulletins_paie nécessaires pour les calculs fiscaux */
export interface BulletinFiscalRow {
  mois:          number
  annee:         number
  brut:          number | null
  cnss_salarie:  number | null
  cnss_patronal: number | null
  irpp:          number | null
  net:           number | null
  statut:        string | null
  employe_id?:   string
}

/** Sélecteur Supabase pour les calculs fiscaux */
export const BULLETIN_FISCAL_SELECT =
  'mois, annee, brut, cnss_salarie, cnss_patronal, irpp, net, statut, employe_id' as const

// ── Types sortie CNSS ─────────────────────────────────────────────────────────

export interface CNSSMonthPoint {
  mois:              number
  nb_employes:       number
  brut_total:        number
  cnss_salarie:      number
  cnss_patronal:     number
  total_cnss:        number
}

export interface CNSSSummary {
  year:              number
  mensuel:           CNSSMonthPoint[]
  totaux: {
    brut_total:    number
    cnss_salarie:  number
    cnss_patronal: number
    total_cnss:    number
    nb_employes:   number
  }
  has_data:  boolean
}

// ── Types sortie IRPP ─────────────────────────────────────────────────────────

export interface IRPPMonthPoint {
  mois:           number
  nb_employes:    number
  brut_total:     number
  cnss_total:     number
  base_imposable: number
  irpp_total:     number
}

export interface IRPPSummary {
  year:      number
  mensuel:   IRPPMonthPoint[]
  totaux: {
    brut_total:      number
    base_imposable:  number
    irpp_total:      number
    nb_employes:     number
  }
  has_data:  boolean
}

// ── Types sortie charge globale ───────────────────────────────────────────────

export interface FiscalPayrollSummary {
  year:          number
  month:         number | null
  brut:          number
  cnss_salarie:  number
  cnss_patronal: number
  total_cnss:    number
  irpp:          number
  net:           number
  cout_employeur: number  // brut + cnss_patronal
  charge_fiscale: number  // cnss_salarie + cnss_patronal + irpp
  mensuel:        FiscalMonthPoint[]
  has_data:       boolean
}

export interface FiscalMonthPoint {
  month:         string   // 'Jan', 'Fév', ...
  mois:          number
  brut:          number
  cnss_salarie:  number
  cnss_patronal: number
  irpp:          number
  net:           number
}

// ── computePayrollFiscal ──────────────────────────────────────────────────────

/**
 * Résumé fiscal de la paie : CNSS + IRPP + charges agrégées.
 * Point d'entrée unique pour toutes les déclarations fiscales employeur.
 *
 * @param bulletins  - Résultat bulletins_paie (filtrés par tenant + annee en DB)
 * @param year       - Exercice fiscal
 * @param month      - Si fourni, filtre sur ce mois uniquement
 */
export function computePayrollFiscal(
  bulletins: BulletinFiscalRow[],
  year:      number,
  month:     number | null = null,
): FiscalPayrollSummary {
  const scoped = bulletins.filter(b => {
    if (b.annee !== year) return false
    if (b.statut === 'annule') return false
    if (month !== null && b.mois !== month) return false
    return true
  })

  const brut          = sum(scoped, 'brut')
  const cnss_salarie  = sum(scoped, 'cnss_salarie')
  const cnss_patronal = sum(scoped, 'cnss_patronal')
  const irpp          = sum(scoped, 'irpp')
  const net           = sum(scoped, 'net')

  const mensuel: FiscalMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const moisNum = i + 1
    const mb = scoped.filter(b => b.mois === moisNum)
    return {
      month:         MONTH_LABELS_FR[i],
      mois:          moisNum,
      brut:          sum(mb, 'brut'),
      cnss_salarie:  sum(mb, 'cnss_salarie'),
      cnss_patronal: sum(mb, 'cnss_patronal'),
      irpp:          sum(mb, 'irpp'),
      net:           sum(mb, 'net'),
    }
  })

  return {
    year, month, brut,
    cnss_salarie, cnss_patronal,
    total_cnss:     cnss_salarie + cnss_patronal,
    irpp, net,
    cout_employeur: brut + cnss_patronal,
    charge_fiscale: cnss_salarie + cnss_patronal + irpp,
    mensuel,
    has_data:       scoped.length > 0,
  }
}

// ── computeCNSSSummary ────────────────────────────────────────────────────────

/**
 * Déclaration CNSS mensuelle — agrège les valeurs stockées dans bulletins.
 * Respecte l'exactitude fiscale : utilise les montants calculés lors de la génération,
 * pas une re-estimation depuis salaire_base.
 */
export function computeCNSSSummary(
  bulletins: BulletinFiscalRow[],
  year:      number,
  mois?:     number | null,
): CNSSSummary {
  const filtered = bulletins.filter(b =>
    b.annee === year && b.statut !== 'annule' && (mois == null || b.mois === mois),
  )

  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)

  const mensuel: CNSSMonthPoint[] = months.map(m => {
    const mb = filtered.filter(b => b.mois === m)
    return {
      mois:          m,
      nb_employes:   mb.length,
      brut_total:    sum(mb, 'brut'),
      cnss_salarie:  sum(mb, 'cnss_salarie'),
      cnss_patronal: sum(mb, 'cnss_patronal'),
      total_cnss:    sum(mb, 'cnss_salarie') + sum(mb, 'cnss_patronal'),
    }
  })

  return {
    year,
    mensuel,
    totaux: {
      brut_total:    mensuel.reduce((s, m) => s + m.brut_total, 0),
      cnss_salarie:  mensuel.reduce((s, m) => s + m.cnss_salarie, 0),
      cnss_patronal: mensuel.reduce((s, m) => s + m.cnss_patronal, 0),
      total_cnss:    mensuel.reduce((s, m) => s + m.total_cnss, 0),
      nb_employes:   filtered.length,
    },
    has_data: filtered.length > 0,
  }
}

// ── computeIRPPSummary ────────────────────────────────────────────────────────

/**
 * Déclaration IRPP mensuelle — agrège depuis bulletins.
 * base_imposable = brut - cnss_salarie (déduction cotisation salarié)
 * Conforme Art. 76 CGI Congo (LF n°42-2025).
 */
export function computeIRPPSummary(
  bulletins: BulletinFiscalRow[],
  year:      number,
  mois?:     number | null,
): IRPPSummary {
  const filtered = bulletins.filter(b =>
    b.annee === year && b.statut !== 'annule' && (mois == null || b.mois === mois),
  )

  const months = mois ? [mois] : Array.from({ length: 12 }, (_, i) => i + 1)

  const mensuel: IRPPMonthPoint[] = months.map(m => {
    const mb = filtered.filter(b => b.mois === m)
    const brut_total    = sum(mb, 'brut')
    const cnss_total    = sum(mb, 'cnss_salarie')
    return {
      mois:           m,
      nb_employes:    mb.length,
      brut_total,
      cnss_total,
      base_imposable: Math.max(0, brut_total - cnss_total),
      irpp_total:     sum(mb, 'irpp'),
    }
  })

  return {
    year,
    mensuel,
    totaux: {
      brut_total:     mensuel.reduce((s, m) => s + m.brut_total, 0),
      base_imposable: mensuel.reduce((s, m) => s + m.base_imposable, 0),
      irpp_total:     mensuel.reduce((s, m) => s + m.irpp_total, 0),
      nb_employes:    filtered.length,
    },
    has_data: filtered.length > 0,
  }
}

// ── Helper privé ──────────────────────────────────────────────────────────────

function sum(rows: BulletinFiscalRow[], key: keyof BulletinFiscalRow): number {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}
