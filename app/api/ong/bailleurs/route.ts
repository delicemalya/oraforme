import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data, error: dbErr, count } = await supabaseAdmin
    .from('ong_bailleurs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('nom')
    .limit(200)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { nom, type_bailleur = 'prive', pays, contact_nom, contact_email, contact_tel, montant_engage, devise = 'XAF', statut = 'actif', notes } = body

  if (!nom?.trim()) return NextResponse.json({ error: 'Nom du bailleur requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('ong_bailleurs')
    .insert({
      tenant_id: ctx.tenantId, nom: nom.trim(), type_bailleur, pays: pays || null,
      contact_nom: contact_nom || null, contact_email: contact_email || null, contact_tel: contact_tel || null,
      montant_engage: montant_engage || 0, devise, statut, notes: notes || null,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['nom', 'type_bailleur', 'pays', 'contact_nom', 'contact_email', 'contact_tel', 'montant_engage', 'devise', 'statut', 'notes']
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('ong_bailleurs')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error: delErr } = await supabaseAdmin
    .from('ong_bailleurs')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
