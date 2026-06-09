import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'compagnies' | 'dossiers'

  if (type === 'dossiers') {
    const { data, error: dbError } = await supabaseAdmin
      .from('his_dossiers_assurance')
      .select('*, clinique_patients(nom, prenom, numero_dossier), his_assurances(nom, code, type)')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ dossiers: data ?? [] })
  }

  const [assurRes, dossierRes] = await Promise.all([
    supabaseAdmin
      .from('his_assurances')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('nom'),
    supabaseAdmin
      .from('his_dossiers_assurance')
      .select('assurance_id, statut')
      .eq('tenant_id', ctx.tenantId)
      .eq('statut', 'actif'),
  ])

  const adherents: Record<string, number> = {}
  for (const d of dossierRes.data ?? []) {
    adherents[d.assurance_id] = (adherents[d.assurance_id] ?? 0) + 1
  }

  const assurances = (assurRes.data ?? []).map(a => ({ ...a, nb_adherents: adherents[a.id] ?? 0 }))
  return NextResponse.json({ assurances })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const action = body.action // 'compagnie' | 'dossier'

  if (action === 'dossier') {
    if (!body.patient_id || !body.assurance_id) {
      return NextResponse.json({ error: 'patient_id et assurance_id requis' }, { status: 400 })
    }
    const allowed = ['patient_id','assurance_id','numero_adherent','date_debut','date_fin','taux_couverture','notes']
    const payload: Record<string, unknown> = { tenant_id: ctx.tenantId, statut: 'actif' }
    for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

    const { data, error: dbError } = await supabaseAdmin
      .from('his_dossiers_assurance')
      .insert(payload)
      .select('id')
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json({ id: data.id }, { status: 201 })
  }

  if (!body.nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })
  const allowed = ['nom','code','type','taux_couverture','contacts','email','telephone']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_assurances')
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

  const table = target === 'dossier' ? 'his_dossiers_assurance' : 'his_assurances'
  const allowed = target === 'dossier'
    ? ['statut','numero_adherent','date_debut','date_fin','taux_couverture','notes']
    : ['nom','code','type','taux_couverture','contacts','email','telephone','actif']

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
