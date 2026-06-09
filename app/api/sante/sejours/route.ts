import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut  = searchParams.get('statut') ?? 'en_cours'
  const service = searchParams.get('service')

  let query = supabaseAdmin
    .from('his_sejours')
    .select(`
      *,
      clinique_patients(nom, prenom, numero_dossier, telephone, groupe_sanguin),
      clinique_medecins(nom, prenom, specialite),
      his_lits(numero, service, type)
    `)
    .eq('tenant_id', ctx.tenantId)
    .order('date_entree', { ascending: false })
    .limit(200)

  if (statut !== 'all') query = query.eq('statut', statut)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  let sejours = data ?? []
  if (service) {
    sejours = sejours.filter((s: Record<string, unknown>) => {
      const lit = s.his_lits as { service?: string } | null
      return lit?.service === service
    })
  }

  return NextResponse.json({ sejours, total: sejours.length })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.patient_id || !body.motif_admission) {
    return NextResponse.json({ error: 'patient_id et motif_admission requis' }, { status: 400 })
  }

  const allowed = ['patient_id','lit_id','medecin_referent_id','date_entree','date_sortie_prevue','motif_admission','diagnostic_entree','notes']
  const payload: Record<string, unknown> = { tenant_id: ctx.tenantId }
  for (const k of allowed) { if (body[k] !== undefined) payload[k] = body[k] }

  const { data, error: dbError } = await supabaseAdmin
    .from('his_sejours')
    .insert(payload)
    .select('id, numero_sejour')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Mark lit as occupied
  if (body.lit_id) {
    await supabaseAdmin
      .from('his_lits')
      .update({ statut: 'occupe' })
      .eq('id', body.lit_id)
      .eq('tenant_id', ctx.tenantId)
  }

  return NextResponse.json({ id: data.id, numero_sejour: data.numero_sejour }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['statut','lit_id','medecin_referent_id','date_sortie_prevue','date_sortie_effective','diagnostic_sortie','type_sortie','notes']
  const update: Record<string, unknown> = {}
  for (const k of allowed) { if (rest[k] !== undefined) update[k] = rest[k] }

  // If setting statut to sorti or transfere, free the lit
  if (update.statut === 'sorti' || update.statut === 'transfere') {
    const { data: existing } = await supabaseAdmin
      .from('his_sejours')
      .select('lit_id')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()

    if (existing?.lit_id) {
      await supabaseAdmin
        .from('his_lits')
        .update({ statut: 'desinfection' })
        .eq('id', existing.lit_id)
        .eq('tenant_id', ctx.tenantId)
    }
    if (!update.date_sortie_effective) update.date_sortie_effective = new Date().toISOString()
  }

  const { error: dbError } = await supabaseAdmin
    .from('his_sejours')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
