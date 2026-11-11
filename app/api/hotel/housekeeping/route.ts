import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url    = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const etage  = url.searchParams.get('etage')
  const date   = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  let q = supabaseAdmin
    .from('htl_housekeeping_tasks')
    .select('*, htl_rooms(numero, etage, statut)')
    .eq('hotel_id', ctx.tenantId)
    .eq('date_planif', date)
    .order('priorite', { ascending: false })

  if (statut) q = q.eq('statut', statut)
  if (etage) {
    const { data: roomsOnFloor } = await supabaseAdmin
      .from('htl_rooms').select('id').eq('hotel_id', ctx.tenantId).eq('etage', Number(etage))
    const ids = (roomsOnFloor ?? []).map(r => r.id)
    if (ids.length > 0) q = q.in('room_id', ids)
  }

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ tasks: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, statut, assigne_a, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (statut    !== undefined) patch.statut    = statut
  if (assigne_a !== undefined) patch.assigne_a = assigne_a
  if (notes     !== undefined) patch.notes     = notes

  const { error: dbErr } = await supabaseAdmin
    .from('htl_housekeeping_tasks')
    .update(patch)
    .eq('id', id)
    .eq('hotel_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Si terminée → remettre la chambre disponible
  if (statut === 'terminee' || statut === 'verifiee') {
    const { data: task } = await supabaseAdmin
      .from('htl_housekeeping_tasks')
      .select('room_id')
      .eq('id', id)
      .maybeSingle()
    if (task?.room_id) {
      await supabaseAdmin
        .from('htl_rooms')
        .update({ statut: 'disponible' })
        .eq('id', task.room_id)
        .eq('hotel_id', ctx.tenantId)
        .eq('statut', 'nettoyage')
    }
  }

  return NextResponse.json({ ok: true })
}
