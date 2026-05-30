import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut    = searchParams.get('statut')
  const membre_id = searchParams.get('membre_id')

  let query = supabaseAdmin
    .from('banque_credits')
    .select('*, banque_membres(nom, prenom, numero_compte)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (statut)    query = query.eq('statut', statut)
  if (membre_id) query = query.eq('membre_id', membre_id)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { membre_id, montant, taux_interet = 12, duree_mois = 12, motif, notes } = body

  if (!membre_id) return NextResponse.json({ error: 'membre_id requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data: membre } = await supabaseAdmin
    .from('banque_membres')
    .select('id')
    .eq('id', membre_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!membre) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  const { data, error: insErr } = await supabaseAdmin
    .from('banque_credits')
    .insert({
      tenant_id:    ctx.tenantId,
      membre_id,
      montant,
      taux_interet,
      duree_mois,
      motif:        motif || null,
      notes:        notes || null,
      statut:       'en_attente',
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['statut','montant_rembourse','date_octroi','date_echeance','notes']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  if (updates.statut === 'accorde' && !updates.date_octroi) {
    payload.date_octroi = new Date().toISOString().split('T')[0]
  }

  const { error: updErr } = await supabaseAdmin
    .from('banque_credits')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
