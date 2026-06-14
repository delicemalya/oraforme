import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const chantier_id = searchParams.get('chantier_id')

  let query = supabaseAdmin
    .from('btp_phases')
    .select('*, btp_chantiers(nom, statut, client_nom)')
    .eq('tenant_id', ctx.tenantId)
    .order('chantier_id')
    .order('ordre')
    .limit(500)

  if (chantier_id) query = query.eq('chantier_id', chantier_id)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { chantier_id, nom, ordre = 1, date_prevue, notes } = body

  if (!chantier_id || !nom?.trim()) return NextResponse.json({ error: 'chantier_id et nom requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('btp_phases')
    .insert({ tenant_id: ctx.tenantId, chantier_id, nom: nom.trim(), ordre, date_prevue: date_prevue || null, notes: notes || null, statut: 'a_faire', avancement_pct: 0 })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['nom', 'ordre', 'avancement_pct', 'statut', 'date_prevue', 'notes']
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('btp_phases')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error: delErr } = await supabaseAdmin
    .from('btp_phases')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
