import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')

  let query = supabaseAdmin
    .from('his_examens_imagerie')
    .select('*, clinique_patients(nom, prenom, numero_dossier), clinique_medecins(nom, prenom, specialite)')
    .eq('tenant_id', ctx.tenantId)
    .order('date_prescription', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)
  if (from)   query = query.gte('date_prescription', from)
  if (to)     query = query.lte('date_prescription', to)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ examens: data ?? [], total: (data ?? []).length })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.patient_id || !body.type_examen) {
    return NextResponse.json({ error: 'patient_id et type_examen requis' }, { status: 400 })
  }

  const allowed = ['patient_id','consultation_id','sejour_id','medecin_id','type_examen','region','urgence','notes']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_examens_imagerie')
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

  const allowed = ['statut','rapport','date_realisation','technicien','notes','urgence']
  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  if (update.statut === 'realise' && !update.date_realisation) {
    update.date_realisation = new Date().toISOString()
  }

  const { error: dbError } = await supabaseAdmin
    .from('his_examens_imagerie')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
