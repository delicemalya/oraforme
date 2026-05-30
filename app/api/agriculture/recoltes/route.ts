import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const parcelle_id = searchParams.get('parcelle_id')
  const from        = searchParams.get('from')
  const to          = searchParams.get('to')

  let query = supabaseAdmin
    .from('agriculture_recoltes')
    .select('*, agriculture_parcelles(nom)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_recolte', { ascending: false })
    .limit(200)

  if (parcelle_id) query = query.eq('parcelle_id', parcelle_id)
  if (from)        query = query.gte('date_recolte', from)
  if (to)          query = query.lte('date_recolte', to)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { parcelle_id, culture, quantite_kg, prix_unitaire = 0, date_recolte, destination, notes } = body

  if (!culture?.trim()) return NextResponse.json({ error: 'Culture requise' }, { status: 400 })
  if (!quantite_kg || quantite_kg <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })

  if (parcelle_id) {
    const { data: p } = await supabaseAdmin.from('agriculture_parcelles').select('id').eq('id', parcelle_id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!p) return NextResponse.json({ error: 'Parcelle introuvable' }, { status: 404 })
  }

  const { data, error: insErr } = await supabaseAdmin
    .from('agriculture_recoltes')
    .insert({
      tenant_id:    ctx.tenantId,
      parcelle_id:  parcelle_id  || null,
      culture:      culture.trim(),
      quantite_kg,
      prix_unitaire,
      date_recolte: date_recolte || new Date().toISOString().split('T')[0],
      destination:  destination  || 'vente',
      notes:        notes        || null,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
