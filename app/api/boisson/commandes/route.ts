import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')

  let query = supabaseAdmin
    .from('boisson_commandes')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_commande', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { client_nom, client_telephone, adresse_livraison, date_livraison, lignes = [], notes } = body

  if (!client_nom?.trim()) return NextResponse.json({ error: 'Nom client requis' }, { status: 400 })

  const montant_total = (lignes as Array<{ qte: number; prix_unitaire: number }>).reduce((s, l) => s + l.qte * l.prix_unitaire, 0)

  const { data, error: insErr } = await supabaseAdmin
    .from('boisson_commandes')
    .insert({
      tenant_id: ctx.tenantId, client_nom: client_nom.trim(), client_telephone: client_telephone || null,
      adresse_livraison: adresse_livraison || null, date_livraison: date_livraison || null,
      montant_total, statut: 'nouvelle', notes: notes || null,
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

  const allowed = ['client_nom', 'client_telephone', 'adresse_livraison', 'date_livraison', 'montant_total', 'statut', 'notes']
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('boisson_commandes')
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
    .from('boisson_commandes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
