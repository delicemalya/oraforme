import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url    = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const date   = url.searchParams.get('date') // filtre arrivées du jour

  let q = supabaseAdmin
    .from('htl_reservations')
    .select(`
      *, htl_guests(nom, prenom, telephone, email, nationalite),
      htl_reservation_rooms(room_id, prix_nuit, htl_rooms(numero, etage))
    `)
    .eq('hotel_id', ctx.tenantId)
    .order('date_arrivee', { ascending: false })

  if (statut) q = q.eq('statut', statut)
  if (date)   q = q.eq('date_arrivee', date)

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ reservations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    guest_id, agency_id, type_reservation, date_arrivee, date_depart,
    nb_adultes, nb_enfants, montant_total, montant_acompte,
    rooms, notes, source,
  } = body

  if (!date_arrivee || !date_depart) {
    return NextResponse.json({ error: 'date_arrivee et date_depart requis' }, { status: 400 })
  }

  // Générer le numéro de réservation
  const { data: numData } = await supabaseAdmin.rpc('htl_generate_reservation_number', {
    p_hotel_id: ctx.tenantId,
  })
  const numero = numData ?? `HTL-${Date.now()}`

  const { data: res, error: dbErr } = await supabaseAdmin
    .from('htl_reservations')
    .insert({
      hotel_id: ctx.tenantId, numero,
      guest_id: guest_id ?? null, agency_id: agency_id ?? null,
      type_reservation: type_reservation ?? 'directe',
      statut: 'confirmee',
      date_arrivee, date_depart,
      nb_adultes: nb_adultes ?? 1, nb_enfants: nb_enfants ?? 0,
      montant_total: montant_total ?? 0,
      montant_acompte: montant_acompte ?? 0,
      notes: notes ?? null, source: source ?? null,
    })
    .select('id, numero')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Associer les chambres si fournies
  if (rooms?.length > 0) {
    await supabaseAdmin.from('htl_reservation_rooms').insert(
      rooms.map((r: { room_id: string; type_id?: string; prix_nuit: number; petit_dej?: boolean }) => ({
        hotel_id: ctx.tenantId,
        reservation_id: res.id,
        room_id: r.room_id,
        type_id: r.type_id ?? null,
        prix_nuit: r.prix_nuit ?? 0,
        petit_dej: r.petit_dej ?? false,
      }))
    )
  }

  return NextResponse.json({ id: res.id, numero: res.numero }, { status: 201 })
}
