import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url    = new URL(_req.url)
  const statut = url.searchParams.get('statut')
  const etage  = url.searchParams.get('etage')

  let q = supabaseAdmin
    .from('htl_rooms')
    .select('*, htl_room_types(nom, capacite)')
    .eq('hotel_id', ctx.tenantId)
    .order('etage', { ascending: true })
    .order('numero', { ascending: true })

  if (statut) q = q.eq('statut', statut)
  if (etage)  q = q.eq('etage', Number(etage))

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ rooms: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { type_id, numero, etage, equipements, notes } = await req.json()
  if (!numero?.trim()) return NextResponse.json({ error: 'numero requis' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_rooms')
    .insert({ hotel_id: ctx.tenantId, type_id, numero: numero.trim(), etage: etage ?? 0, equipements: equipements ?? [], notes })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
