import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q')
  const statut = searchParams.get('statut')

  let query = supabaseAdmin
    .from('banque_membres')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)
  if (q)      query = query.or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,numero_compte.ilike.%${q}%`)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { nom, prenom, date_naissance, telephone, adresse, type_compte } = body

  if (!nom?.trim() || !prenom?.trim())
    return NextResponse.json({ error: 'Nom et prénom requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('banque_membres')
    .insert({
      tenant_id:      ctx.tenantId,
      nom:            nom.trim(),
      prenom:         prenom.trim(),
      date_naissance: date_naissance  || null,
      telephone:      telephone       || null,
      adresse:        adresse         || null,
      type_compte:    type_compte     || 'epargne',
      solde:          0,
      statut:         'actif',
    })
    .select('id, numero_compte')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id, numero_compte: data.numero_compte }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['nom','prenom','telephone','adresse','statut','type_compte']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('banque_membres')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
