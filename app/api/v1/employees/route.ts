import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/v1/employees
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireApiKey(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const departement = searchParams.get('departement')
  const statut = searchParams.get('statut')

  let query = supabaseAdmin
    .from('employees')
    .select('id, matricule, nom, prenom, poste, departement, statut, date_embauche, created_at', { count: 'exact' })
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (departement) query = query.eq('departement', departement)
  if (statut) query = query.eq('statut', statut)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    meta: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
