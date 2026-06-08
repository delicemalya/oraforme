import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { reservation_id, room_id, note_client, commentaire, statut_chambre_final, montant_extras } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id requis' }, { status: 400 })

  const finalStatut = statut_chambre_final ?? 'a_nettoyer'

  // Créer le check-out
  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_check_outs')
    .insert({
      hotel_id: ctx.tenantId, reservation_id,
      room_id: room_id ?? null,
      note_client: note_client ?? null,
      commentaire: commentaire ?? null,
      statut_chambre_final: finalStatut,
      montant_extras: montant_extras ?? 0,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Statut réservation → checkout
  await supabaseAdmin
    .from('htl_reservations')
    .update({ statut: 'checkout' })
    .eq('id', reservation_id)
    .eq('hotel_id', ctx.tenantId)

  // Chambre : statut selon état final
  if (room_id) {
    const chambreStatut = finalStatut === 'maintenance' ? 'maintenance'
      : finalStatut === 'dommages' ? 'hors_service'
      : 'nettoyage'

    await supabaseAdmin
      .from('htl_rooms')
      .update({ statut: chambreStatut })
      .eq('id', room_id)
      .eq('hotel_id', ctx.tenantId)

    // Déclencher tâche housekeeping automatique
    await supabaseAdmin
      .from('htl_housekeeping_tasks')
      .insert({
        hotel_id: ctx.tenantId, room_id,
        type_tache: 'depart',
        priorite: 'haute',
        statut: 'a_faire',
      })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
