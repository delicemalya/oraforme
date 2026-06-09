import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/hotel/rooms/available?check_in=2026-06-10&check_out=2026-06-13&type_id=UUID
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url       = new URL(req.url)
  const check_in  = url.searchParams.get('check_in')
  const check_out = url.searchParams.get('check_out')
  const type_id   = url.searchParams.get('type_id')

  if (!check_in || !check_out) {
    return NextResponse.json({ error: 'check_in et check_out requis' }, { status: 400 })
  }

  // Étape 1 : réservations actives qui chevauchent la période
  const { data: activeResas } = await supabaseAdmin
    .from('htl_reservations')
    .select('id')
    .eq('hotel_id', ctx.tenantId)
    .not('statut', 'in', '(annulee,no_show,checkout)')
    .lt('date_arrivee', check_out)
    .gt('date_depart', check_in)

  const resaIds = (activeResas ?? []).map(r => r.id)

  // Étape 2 : chambres occupées par ces réservations
  let occupiedRoomIds: string[] = []
  if (resaIds.length > 0) {
    const { data: occupied } = await supabaseAdmin
      .from('htl_reservation_rooms')
      .select('room_id')
      .eq('hotel_id', ctx.tenantId)
      .in('reservation_id', resaIds)
    occupiedRoomIds = (occupied ?? []).map(r => r.room_id).filter(Boolean)
  }

  // Étape 3 : chambres disponibles (exclure les occupées)
  let q = supabaseAdmin
    .from('htl_rooms')
    .select('*, htl_room_types(nom, capacite)')
    .eq('hotel_id', ctx.tenantId)
    .eq('statut', 'disponible')

  if (occupiedRoomIds.length > 0) q = q.not('id', 'in', `(${occupiedRoomIds.join(',')})`)
  if (type_id) q = q.eq('type_id', type_id)

  const { data, error: dbErr } = await q.order('numero')
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ rooms: data ?? [], check_in, check_out })
}
