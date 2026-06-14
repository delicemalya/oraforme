import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const annee  = searchParams.get('annee')

  let query = supabaseAdmin
    .from('cabinet_honoraires_factures')
    .select('*', { count: 'exact' })
    .eq('cabinet_tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (statut) query = query.eq('statut', statut)
  if (annee)  query = query.eq('annee', parseInt(annee))

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    numero, client_id, client_nom, mois, annee,
    montant_ht, taux_tva, montant_tva, montant_ttc,
    statut = 'brouillon', date_echeance, notes, types_mission,
  } = body

  if (!client_nom?.trim() || !montant_ht) {
    return NextResponse.json({ error: 'client_nom et montant_ht requis' }, { status: 400 })
  }

  const { data, error: insErr } = await supabaseAdmin
    .from('cabinet_honoraires_factures')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      numero:            numero ?? `HON-${Date.now()}`,
      client_id:         client_id ?? null,
      client_nom,
      mois:              mois ?? null,
      annee:             annee ?? new Date().getFullYear(),
      montant_ht:        parseFloat(montant_ht) || 0,
      taux_tva:          parseFloat(taux_tva) || 18,
      montant_tva:       parseFloat(montant_tva) || 0,
      montant_ttc:       parseFloat(montant_ttc) || 0,
      statut,
      date_emission:     new Date().toISOString(),
      date_echeance:     date_echeance ?? null,
      notes:             notes ?? null,
      types_mission:     types_mission ?? [],
    })
    .select()
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['statut', 'date_paiement', 'date_echeance', 'notes', 'montant_ht', 'montant_tva', 'montant_ttc', 'taux_tva']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) { if (k in updates) patch[k] = updates[k] }

  const { data, error: upErr } = await supabaseAdmin
    .from('cabinet_honoraires_factures')
    .update(patch)
    .eq('id', id)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .select()
    .single()

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
