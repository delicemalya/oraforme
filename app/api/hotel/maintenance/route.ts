import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const statut = new URL(req.url).searchParams.get('statut')

  let q = supabaseAdmin
    .from('htl_maintenance_requests')
    .select('*, htl_rooms(numero, etage)')
    .eq('hotel_id', ctx.tenantId)
    .order('created_at', { ascending: false })

  if (statut) q = q.eq('statut', statut)

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { room_id, titre, description, categorie, priorite, signale_par } = await req.json()
  if (!titre?.trim()) return NextResponse.json({ error: 'titre requis' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_maintenance_requests')
    .insert({
      hotel_id: ctx.tenantId, room_id: room_id ?? null,
      titre: titre.trim(), description: description ?? null,
      categorie: categorie ?? 'autre',
      priorite: priorite ?? 'normale',
      signale_par: signale_par ?? null,
      statut: 'signale',
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Bloquer la chambre si priorité urgente
  if (room_id && (priorite === 'urgente' || priorite === 'haute')) {
    await supabaseAdmin
      .from('htl_rooms')
      .update({ statut: 'maintenance' })
      .eq('id', room_id)
      .eq('hotel_id', ctx.tenantId)
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, statut, technicien, cout_reparation, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (statut          !== undefined) patch.statut           = statut
  if (technicien      !== undefined) patch.technicien       = technicien
  if (cout_reparation !== undefined) patch.cout_reparation  = cout_reparation
  if (notes           !== undefined) patch.notes            = notes
  if (statut === 'resolu') patch.date_resolution = new Date().toISOString()

  const { error: dbErr } = await supabaseAdmin
    .from('htl_maintenance_requests')
    .update(patch)
    .eq('id', id)
    .eq('hotel_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Résolu → remettre la chambre disponible
  if (statut === 'resolu') {
    const { data: req_ } = await supabaseAdmin
      .from('htl_maintenance_requests').select('room_id').eq('id', id).maybeSingle()
    if (req_?.room_id) {
      await supabaseAdmin.from('htl_rooms')
        .update({ statut: 'disponible' })
        .eq('id', req_.room_id)
        .eq('hotel_id', ctx.tenantId)
        .eq('statut', 'maintenance')
    }
  }

  return NextResponse.json({ ok: true })
}
