import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const site_id = searchParams.get('site_id')
  const mois    = searchParams.get('mois') // YYYY-MM

  let query = supabaseAdmin
    .from('petrole_production')
    .select('*, petrole_sites(nom, unite_production)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_production', { ascending: false })
    .limit(300)

  if (site_id) query = query.eq('site_id', site_id)
  if (mois)    query = query.gte('date_production', `${mois}-01`).lt('date_production', `${mois}-32`)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { site_id, date_production, quantite, unite = 'barils', type_hydrocarbure = 'brut', prix_unitaire, notes } = body

  if (!site_id || !date_production || !quantite) {
    return NextResponse.json({ error: 'site_id, date_production et quantite requis' }, { status: 400 })
  }

  const { data, error: insErr } = await supabaseAdmin
    .from('petrole_production')
    .insert({
      tenant_id: ctx.tenantId, site_id, date_production, quantite: parseFloat(quantite),
      unite, type_hydrocarbure, prix_unitaire: prix_unitaire ? parseFloat(prix_unitaire) : null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['date_production', 'quantite', 'unite', 'type_hydrocarbure', 'prix_unitaire', 'notes']
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('petrole_production')
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
    .from('petrole_production')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
