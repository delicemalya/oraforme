import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/fiscalite/declarations — liste des déclarations
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const annee  = searchParams.get('annee') ?? String(new Date().getFullYear())
  const type   = searchParams.get('type')
  const statut = searchParams.get('statut')

  let q = supabaseAdmin
    .from('fiscal_declarations')
    .select('*')
    .eq('tenant_id', ctx.tid)
    .eq('periode_annee', Number(annee))
    .order('date_echeance', { ascending: true })

  if (type)   q = q.eq('type', type)
  if (statut) q = q.eq('statut', statut)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ declarations: data ?? [] })
}

// POST /api/fiscalite/declarations — créer/enregistrer une déclaration
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.periode_mois || !body?.periode_annee) {
    return NextResponse.json({ error: 'type, periode_mois, periode_annee requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('fiscal_declarations')
    .upsert({
      tenant_id:       ctx.tid,
      type:            body.type,
      pays:            body.pays ?? 'CG',
      periode_mois:    body.periode_mois,
      periode_annee:   body.periode_annee,
      montant_base:    body.montant_base ?? 0,
      montant_du:      body.montant_du ?? 0,
      montant_paye:    body.montant_paye ?? 0,
      penalites:       body.penalites ?? 0,
      statut:          body.statut ?? 'a_faire',
      date_echeance:   body.date_echeance,
      date_depot:      body.date_depot ?? null,
      date_paiement:   body.date_paiement ?? null,
      reference_depot: body.reference_depot ?? null,
      notes:           body.notes ?? null,
    }, {
      onConflict: 'tenant_id,type,periode_mois,periode_annee',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ declaration: data }, { status: 201 })
}
