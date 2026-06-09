import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'personnel' | 'gardes'
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (type === 'gardes') {
    const dateFrom = from ?? new Date().toISOString().split('T')[0]
    const dateTo   = to   ?? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    const { data, error: dbError } = await supabaseAdmin
      .from('his_gardes')
      .select('*, his_personnel(nom, prenom, poste), clinique_medecins(nom, prenom, specialite)')
      .eq('tenant_id', ctx.tenantId)
      .gte('date_garde', dateFrom)
      .lte('date_garde', dateTo)
      .order('date_garde')
      .order('heure_debut')

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ gardes: data ?? [] })
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_personnel')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('nom')
    .limit(500)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ personnel: data ?? [], total: (data ?? []).length })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const action = body.action // 'personnel' | 'garde'

  if (action === 'garde') {
    if (!body.date_garde) return NextResponse.json({ error: 'date_garde requis' }, { status: 400 })
    const allowed = ['personnel_id','medecin_id','date_garde','heure_debut','heure_fin','service','type_garde','notes']
    const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
    for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

    const { data, error: dbError } = await supabaseAdmin
      .from('his_gardes')
      .insert(payload)
      .select('id')
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ id: data.id }, { status: 201 })
  }

  if (!body.nom || !body.prenom || !body.poste) {
    return NextResponse.json({ error: 'nom, prenom et poste requis' }, { status: 400 })
  }

  const allowed = ['nom','prenom','poste','service','telephone','email','numero_ordre','salaire','date_embauche']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId, actif: true }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_personnel')
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
  const { id, target, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const table = target === 'garde' ? 'his_gardes' : 'his_personnel'
  const allowed = target === 'garde'
    ? ['personnel_id','medecin_id','date_garde','heure_debut','heure_fin','service','type_garde','notes']
    : ['nom','prenom','poste','service','telephone','email','numero_ordre','salaire','date_embauche','actif']

  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  const { error: dbError } = await supabaseAdmin
    .from(table)
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
  const id     = searchParams.get('id')
  const target = searchParams.get('target') ?? 'garde'
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const table = target === 'garde' ? 'his_gardes' : 'his_personnel'
  const { error: dbError } = await supabaseAdmin
    .from(table)
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
