import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/resto/reservations/[id]
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const allowed = ['statut', 'table_id', 'heure_resa', 'nb_personnes', 'notes', 'livreur_nom']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in body) updates[k] = body[k]

  const { data, error: err } = await supabaseAdmin
    .from('resto_reservations')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select('*')
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ reservation: data })
}

// DELETE /api/resto/reservations/[id]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id } = await params
  const { error: err } = await supabaseAdmin
    .from('resto_reservations')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
