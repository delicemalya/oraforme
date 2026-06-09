import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const service = searchParams.get('service')

  let query = supabaseAdmin
    .from('his_lits')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('service')
    .order('numero')

  if (service) query = query.eq('service', service)

  const { data: lits, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Fetch active sejours to enrich bed data
  const { data: sejours } = await supabaseAdmin
    .from('his_sejours')
    .select('id, lit_id, motif_admission, date_entree, clinique_patients(nom, prenom, numero_dossier)')
    .eq('tenant_id', ctx.tenantId)
    .eq('statut', 'en_cours')

  type SejourRow = NonNullable<typeof sejours>[number]
  const sejourByLit: Record<string, SejourRow> = {}
  for (const s of sejours ?? []) {
    if (s.lit_id) sejourByLit[s.lit_id] = s
  }

  const enriched = (lits ?? []).map(lit => ({
    ...lit,
    sejour_actif: sejourByLit[lit.id] ?? null,
  }))

  return NextResponse.json({ lits: enriched })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.service || !body.numero) return NextResponse.json({ error: 'service et numero requis' }, { status: 400 })

  const allowed = ['service','numero','type','statut','etage','notes']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_lits')
    .insert(payload)
    .select('id')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['statut','type','service','etage','notes']
  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  const { error: dbError } = await supabaseAdmin
    .from('his_lits')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error: dbError } = await supabaseAdmin
    .from('his_lits')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
