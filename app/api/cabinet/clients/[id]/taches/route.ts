import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return error
  const { id: clientId } = await params

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_taches')
    .select('*')
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .order('date_echeance', { ascending: true, nullsFirst: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return error
  const { id: clientId } = await params
  const body = await req.json()

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_taches')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      client_id: clientId,
      titre: body.titre,
      description: body.description ?? null,
      type_tache: body.type_tache ?? null,
      priorite: body.priorite ?? 'normale',
      statut: 'a_faire',
      date_echeance: body.date_echeance ?? null,
      temps_estime_heures: body.temps_estime_heures ?? null,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return error
  const { id: clientId } = await params
  const { tacheId, statut, temps_passe_heures } = await req.json()

  const patch: Record<string, unknown> = { statut }
  if (statut === 'termine') patch.date_completion = new Date().toISOString().split('T')[0]
  if (temps_passe_heures !== undefined) patch.temps_passe_heures = temps_passe_heures

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_taches')
    .update(patch)
    .eq('id', tacheId)
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
