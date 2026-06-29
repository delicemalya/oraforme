/**
 * lib/erp-core/filters/context.ts
 *
 * Contexte ERP unifié — impossible d'oublier tenant/année/pays.
 * Toute route API doit construire un ERPContext avant de lire des données.
 */

import type { CodePays } from '@/lib/countries'

export interface ERPContext {
  tid:    string        // tenant_id — toujours obligatoire
  year:   number        // exercice fiscal (ex: 2026)
  month:  number | null // 1-12 ou null = annuel
  pays:   CodePays      // 'CG' | 'CM' | 'GA' | 'CD' | 'CF' | 'TD' | 'GQ'
  userId: string
}

export interface ERPDateRange {
  yearStart:  string        // 'YYYY-01-01'
  yearEnd:    string        // 'YYYY-12-31'
  monthStart: string | null // 'YYYY-MM-01' si month != null
  monthEnd:   string | null // 'YYYY-MM-DD' dernier jour si month != null
}

/** Construit les bornes de dates pour les requêtes Supabase */
export function buildDateRange(ctx: ERPContext): ERPDateRange {
  const yearStart = `${ctx.year}-01-01`
  const yearEnd   = `${ctx.year}-12-31`

  if (ctx.month !== null) {
    const mo      = String(ctx.month).padStart(2, '0')
    const lastDay = new Date(ctx.year, ctx.month, 0).getDate()
    return {
      yearStart, yearEnd,
      monthStart: `${ctx.year}-${mo}-01`,
      monthEnd:   `${ctx.year}-${mo}-${lastDay}`,
    }
  }
  return { yearStart, yearEnd, monthStart: null, monthEnd: null }
}

/** Construit les 12 clés mensuelles 'YYYY-MM' pour un exercice */
export function buildMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

/** Construit un ERPContext depuis les paramètres bruts d'une route API */
export function buildERPContext(params: {
  tid:     string
  userId:  string
  year?:   number | string | null
  month?:  number | string | null
  pays?:   string | null
}): ERPContext {
  const now   = new Date()
  const year  = params.year  ? Number(params.year)  : now.getFullYear()
  const month = params.month ? Number(params.month) : null
  const pays  = (params.pays ?? 'CG') as CodePays

  return { tid: params.tid, userId: params.userId, year, month, pays }
}

export const MONTH_LABELS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'] as const
