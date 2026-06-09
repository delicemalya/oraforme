import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const date   = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const statut = searchParams.get('statut')

  let query = supabaseAdmin
    .from('his_interventions')
    .select(`
      *,
      clinique_patients(nom, prenom, numero_dossier),
      chirurgien:clinique_medecins!his_interventions_chirurgien_id_fkey(nom, prenom, specialite),
      anesthesiste:clinique_medecins!his_interventions_anesthesiste_id_fkey(nom, prenom, specialite)
    `)
    .eq('tenant_id', ctx.tenantId)
    .order('date_prevue', { ascending: true })
    .limit(200)

  if (statut) {
    query = query.eq('statut', statut)
  } else {
    query = query
      .gte('date_prevue', `${date}T00:00:00`)
      .lt('date_prevue', `${date}T23:59:59.999Z`)
  }

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ interventions: data ?? [], total: (data ?? []).length })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.patient_id || !body.type_intervention) {
    return NextResponse.json({ error: 'patient_id et type_intervention requis' }, { status: 400 })
  }

  const allowed = ['patient_id','sejour_id','chirurgien_id','anesthesiste_id','date_prevue','type_anesthesie','type_intervention','description','notes']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_interventions')
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

  const allowed = ['statut','date_prevue','date_debut','date_fin','type_anesthesie','type_intervention','description','complications','notes_post_op','chirurgien_id','anesthesiste_id']
  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  if (update.statut === 'en_cours' && !update.date_debut) update.date_debut = new Date().toISOString()
  if (update.statut === 'termine'  && !update.date_fin)   update.date_fin   = new Date().toISOString()

  const { error: dbError } = await supabaseAdmin
    .from('his_interventions')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
