import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const date   = searchParams.get('date')

  let query = supabaseAdmin
    .from('his_urgences')
    .select('*, clinique_patients(nom, prenom, telephone, groupe_sanguin), clinique_medecins(nom, prenom, specialite)')
    .eq('tenant_id', ctx.tenantId)
    .order('priorite', { ascending: true })
    .order('heure_arrivee', { ascending: true })
    .limit(300)

  if (statut) query = query.eq('statut', statut)
  if (date) {
    query = query
      .gte('heure_arrivee', `${date}T00:00:00`)
      .lt('heure_arrivee', `${date}T23:59:59.999Z`)
  } else {
    const today = new Date().toISOString().split('T')[0]
    query = query
      .gte('heure_arrivee', `${today}T00:00:00`)
      .in('statut', ['en_attente','triage_fait','en_soins','hospitalise'])
  }

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ urgences: data ?? [], total: (data ?? []).length })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.motif) return NextResponse.json({ error: 'motif requis' }, { status: 400 })

  const allowed = ['patient_id','nom_complet','age_estime','sexe','mode_arrivee','priorite','ccmu','motif','constantes_vitales','medecin_id','notes']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_urgences')
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

  const allowed = ['statut','priorite','ccmu','constantes_vitales','medecin_id','notes','patient_id','nom_complet']
  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  const { error: dbError } = await supabaseAdmin
    .from('his_urgences')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
