import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data, error: dbErr, count } = await supabaseAdmin
    .from('agriculture_parcelles')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { nom, superficie_ha, culture, localisation, proprietaire, notes } = body

  if (!nom?.trim()) return NextResponse.json({ error: 'Nom de la parcelle requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('agriculture_parcelles')
    .insert({
      tenant_id:    ctx.tenantId,
      nom:          nom.trim(),
      superficie_ha: superficie_ha ?? 0,
      culture:      culture      || null,
      localisation: localisation || null,
      proprietaire: proprietaire || null,
      notes:        notes        || null,
      statut:       'active',
    })
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

  const allowed = ['nom','superficie_ha','culture','localisation','statut','proprietaire','notes']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('agriculture_parcelles')
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
    .from('agriculture_parcelles')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
