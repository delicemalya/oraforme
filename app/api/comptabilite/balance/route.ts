/**
 * GET /api/comptabilite/balance
 *
 * Balance générale SYSCOHADA — agrégation serveur de journal_entries.
 * Retourne totaux débit/crédit/solde par compte pour une année/mois donnés.
 * Utilisé par MIAA Compliance pour l'analyse automatisée.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeBalance, BALANCE_SELECT } from '@/lib/erp-core/compute/accounting'

export { type BalanceLine, type BalanceSummary as BalanceResult } from '@/lib/erp-core/compute/accounting'

const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const sp           = req.nextUrl.searchParams
  const year         = parseInt(sp.get('annee') ?? String(new Date().getFullYear()))
  const mois         = sp.get('mois') ? parseInt(sp.get('mois')!) : undefined
  const classeFilter = sp.get('classe') ? parseInt(sp.get('classe')!) : null

  let q = db
    .from('journal_entries')
    .select(BALANCE_SELECT)
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', year)

  if (mois) {
    const monthStr = String(mois).padStart(2, '0')
    q = q
      .gte('date_operation', `${year}-${monthStr}-01`)
      .lte('date_operation', `${year}-${monthStr}-31`)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = computeBalance(entries ?? [], classeFilter)

  return NextResponse.json({ ok: true, ...result, fiscal_year: year, mois })
}
