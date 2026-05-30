import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// GET /api/sante/rendez-vous
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const statut  = searchParams.get('statut')

  let query = supabaseAdmin
    .from('clinique_rdv')
    .select('*, clinique_patients(nom, prenom, telephone), clinique_medecins(nom, prenom, specialite)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_heure', { ascending: true })
    .limit(200)

  if (from)   query = query.gte('date_heure', from)
  if (to)     query = query.lte('date_heure', to)
  if (statut) query = query.eq('statut', statut)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

// POST /api/sante/rendez-vous
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { patient_id, medecin_id, date_heure, duree_minutes = 30, motif, notes, statut = 'planifie' } = body

  if (!patient_id)  return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })
  if (!date_heure)  return NextResponse.json({ error: 'date_heure requis (ISO)' }, { status: 400 })
  if (!motif?.trim()) return NextResponse.json({ error: 'motif requis' }, { status: 400 })

  // Vérifier appartenance tenant
  const { data: patient } = await supabaseAdmin
    .from('clinique_patients')
    .select('id')
    .eq('id', patient_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!patient) return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })

  const { data, error: insErr } = await supabaseAdmin
    .from('clinique_rdv')
    .insert({
      tenant_id:     ctx.tenantId,
      patient_id,
      medecin_id:    medecin_id || null,
      date_heure,
      duree_minutes,
      motif:         motif.trim(),
      notes:         notes || null,
      statut,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

// PATCH /api/sante/rendez-vous — mettre à jour le statut
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, statut, notes, date_heure } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const updatePayload: Record<string, unknown> = {}
  if (statut)     updatePayload.statut     = statut
  if (notes !== undefined) updatePayload.notes = notes
  if (date_heure) updatePayload.date_heure = date_heure

  const { error: updErr } = await supabaseAdmin
    .from('clinique_rdv')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
