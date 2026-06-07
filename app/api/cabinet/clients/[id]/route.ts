import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id } = await params

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_clients')
    .select('*')
    .eq('id', id)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id } = await params
  const body = await req.json()

  const ALLOWED = [
    'nom_entreprise','forme_juridique','secteur_activite','pays','ville','adresse',
    'telephone','email','site_web','niu','rccm','sciet','scien','date_creation_entreprise',
    'contact_nom','contact_prenom','contact_telephone','contact_email','contact_poste',
    'types_mission','date_debut_mission','date_fin_mission','honoraires_mensuel',
    'periodicite','frais_oraforme','notes','acces_actif','statut','tags',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED) { if (k in body) patch[k] = body[k] }

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_clients')
    .update(patch)
    .eq('id', id)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id } = await params

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_clients')
    .delete()
    .eq('id', id)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
