import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data, error: dbErr, count } = await supabaseAdmin
    .from('petrole_sites')
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
  const { nom, localisation, type_site = 'puits', production_journaliere = 0, unite_production = 'barils', date_ouverture, operateur, notes } = body

  if (!nom?.trim()) return NextResponse.json({ error: 'Nom du site requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('petrole_sites')
    .insert({
      tenant_id:             ctx.tenantId,
      nom:                   nom.trim(),
      localisation:          localisation          || null,
      type_site,
      production_journaliere,
      unite_production,
      date_ouverture:        date_ouverture        || null,
      operateur:             operateur             || null,
      notes:                 notes                 || null,
      statut:                'actif',
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

  const allowed = ['nom','localisation','type_site','production_journaliere','unite_production','statut','operateur','notes']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('petrole_sites')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
