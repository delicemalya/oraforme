import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/v1/factures
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireApiKey(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const statut = searchParams.get('statut')
  const from_date = searchParams.get('from')
  const to_date = searchParams.get('to')

  let query = supabaseAdmin
    .from('factures')
    .select('id, numero, statut, montant_ttc, devise, echeance, created_at, client_id', { count: 'exact' })
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (statut) query = query.eq('statut', statut)
  if (from_date) query = query.gte('created_at', from_date)
  if (to_date) query = query.lte('created_at', to_date)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    meta: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
