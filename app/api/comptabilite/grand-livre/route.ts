/**
 * GET /api/comptabilite/grand-livre
 *
 * Grand Livre SYSCOHADA — Détail des mouvements par compte.
 * Utilisé par MIAA pour analyser les écritures et détecter les anomalies.
 *
 * Paramètres :
 *   ?annee=2026             — exercice fiscal
 *   ?compte=411             — filtrer un compte précis (optionnel)
 *   ?classe=4               — filtrer une classe (optionnel)
 *   ?anomalies=true         — retourner seulement les anomalies
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeGrandLivre, GRAND_LIVRE_SELECT } from '@/lib/erp-core/compute/accounting'

export { type GrandLivreCompte, type GrandLivreSummary } from '@/lib/erp-core/compute/accounting'

const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const sp            = req.nextUrl.searchParams
  const year          = parseInt(sp.get('annee') ?? String(new Date().getFullYear()))
  const compteFilter  = sp.get('compte') ?? null
  const classeFilter  = sp.get('classe') ?? null
  const anomaliesOnly = sp.get('anomalies') === 'true'
  const limit         = Math.min(parseInt(sp.get('limit') ?? '1000'), 5000)

  let q = db
    .from('journal_entries')
    .select(GRAND_LIVRE_SELECT)
    .eq('tenant_id', ctx.tid)
    .eq('fiscal_year', year)
    .order('date_operation', { ascending: true })
    .limit(limit)

  if (compteFilter) {
    q = q.or(`debit_account.eq.${compteFilter},credit_account.eq.${compteFilter}`)
  }

  const { data: entries, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = computeGrandLivre(entries ?? [], compteFilter, classeFilter, anomaliesOnly)

  return NextResponse.json({ ok: true, ...result, fiscal_year: year, compte_filter: compteFilter })
}
