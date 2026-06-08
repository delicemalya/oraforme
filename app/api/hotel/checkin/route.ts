import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { reservation_id, room_id, depot_garantie, numero_cle, notes } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id requis' }, { status: 400 })

  // Créer le check-in
  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_check_ins')
    .insert({
      hotel_id: ctx.tenantId, reservation_id,
      room_id: room_id ?? null,
      depot_garantie: depot_garantie ?? 0,
      numero_cle: numero_cle ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Mettre à jour le statut de la réservation → checkin
  await supabaseAdmin
    .from('htl_reservations')
    .update({ statut: 'checkin' })
    .eq('id', reservation_id)
    .eq('hotel_id', ctx.tenantId)

  // Mettre la chambre en statut occupée
  if (room_id) {
    await supabaseAdmin
      .from('htl_rooms')
      .update({ statut: 'occupee' })
      .eq('id', room_id)
      .eq('hotel_id', ctx.tenantId)
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
