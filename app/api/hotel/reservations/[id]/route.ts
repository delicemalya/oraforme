import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireTenant()
  if (error) return error
  const { id } = await params

  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_reservations')
    .select(`
      *, htl_guests(*),
      htl_reservation_rooms(*, htl_rooms(numero, etage, htl_room_types(nom))),
      htl_check_ins(*), htl_check_outs(*),
      htl_invoices(id, numero, montant_ttc, statut)
    `)
    .eq('id', id)
    .eq('hotel_id', ctx.tenantId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  return NextResponse.json({ reservation: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireTenant()
  if (error) return error
  const { id } = await params

  const body = await req.json()
  const allowed = ['statut','nb_adultes','nb_enfants','montant_total','montant_acompte','notes','agency_id']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) { if (body[k] !== undefined) patch[k] = body[k] }

  const { error: dbErr } = await supabaseAdmin
    .from('htl_reservations')
    .update(patch)
    .eq('id', id)
    .eq('hotel_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
