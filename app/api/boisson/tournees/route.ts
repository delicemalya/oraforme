import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')

  let query = supabaseAdmin
    .from('boisson_tournees')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_tournee', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)
  if (from)   query = query.gte('date_tournee', from)
  if (to)     query = query.lte('date_tournee', to)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { chauffeur_nom, vehicule, zone, date_tournee, montant_prevu = 0, nombre_clients = 0, notes } = body

  if (!chauffeur_nom?.trim()) return NextResponse.json({ error: 'Chauffeur requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('boisson_tournees')
    .insert({
      tenant_id:     ctx.tenantId,
      chauffeur_nom: chauffeur_nom.trim(),
      vehicule:      vehicule     || null,
      zone:          zone         || null,
      date_tournee:  date_tournee || new Date().toISOString().split('T')[0],
      montant_prevu,
      nombre_clients,
      notes:         notes        || null,
      statut:        'planifiee',
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

  const allowed = ['chauffeur_nom','vehicule','zone','date_tournee','statut','montant_prevu','montant_collecte','nombre_clients','notes']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  // Si tournée terminée → enregistrer dans trésorerie
  if (updates.statut === 'terminee' && updates.montant_collecte > 0) {
    const { data: t } = await supabaseAdmin.from('boisson_tournees').select('montant_collecte, date_tournee, chauffeur_nom').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (t && updates.montant_collecte !== t.montant_collecte) {
      await supabaseAdmin.from('transactions').insert({
        tenant_id:     ctx.tenantId,
        type:          'entree',
        categorie:     'Ventes Boissons',
        description:   `Tournée — ${updates.chauffeur_nom ?? t.chauffeur_nom}`,
        montant:       updates.montant_collecte,
        date:          updates.date_tournee ?? t.date_tournee,
        mode_paiement: 'especes',
        source:        'boisson',
        source_id:     id,
      })
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from('boisson_tournees')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
