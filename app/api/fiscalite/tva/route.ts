import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerTVA } from '@/lib/fiscalite/engine'
import type { PaysFiscal } from '@/lib/fiscalite/types'
import {
  computeTVAFromJournal,
  BALANCE_SELECT,
  TVA_COLLECTEE_ACCOUNTS,
  TVA_DEDUCTIBLE_ACCOUNTS,
} from '@/lib/erp-core/compute/accounting'

export const dynamic = 'force-dynamic'

// GET /api/fiscalite/tva?annee=2026&mois=5&pays=CG
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = searchParams.get('mois') ? Number(searchParams.get('mois')) : null
  const pays  = (searchParams.get('pays') ?? 'CG') as PaysFiscal

  let q = supabaseAdmin
    .from('journal_entries')
    .select(BALANCE_SELECT)
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', annee)

  if (mois) {
    const from = `${annee}-${String(mois).padStart(2, '0')}-01`
    const to   = `${annee}-${String(mois).padStart(2, '0')}-31`
    q = q.gte('date_operation', from).lte('date_operation', to)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allEntries = entries ?? []

  // Agrégation ERP Core (source unique)
  const summary = computeTVAFromJournal(allEntries, annee)
  const monthPoints = mois ? summary.mensuel.filter(mp => mp.mois === mois) : summary.mensuel

  // Enrichissement pays (calculerTVA ajoute ca_ht, taxes_additionnelles)
  const declarations = monthPoints.map(mp => {
    const mvs = allEntries.filter(e => new Date(e.date_operation).getMonth() + 1 === mp.mois)
    // Compter les mouvements TVA uniquement (pas toutes les écritures du mois)
    const mouvements_count = mvs.filter(e =>
      TVA_COLLECTEE_ACCOUNTS.includes(e.credit_account ?? '') ||
      TVA_DEDUCTIBLE_ACCOUNTS.includes(e.debit_account ?? ''),
    ).length

    const resultat = calculerTVA(mp.tva_collectee, mp.tva_deductible, pays)
    return { mois: mp.mois, annee, ...resultat, mouvements_count }
  })

  const totaux = {
    tva_collectee:  summary.total_collectee,
    tva_deductible: summary.total_deductible,
    total_a_payer:  summary.total_a_payer,
    credit_tva:     summary.total_credit,
    ca_ht:          declarations.reduce((s, d) => s + d.ca_ht, 0),
  }

  return NextResponse.json({ declarations, totaux, pays, annee })
}
