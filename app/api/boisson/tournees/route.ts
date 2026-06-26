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

  // Emit BOI-001 uniquement lors de la première transition vers 'terminee' (fire-and-forget — P-003)
  // Guard : current.statut !== 'terminee' évite le double-emit sur re-PATCH (ANOM-06).
  // Congo: TTC = HT × 1.189 (TVA 18% + CA 5%/TVA). montant_collecte = TTC.
  if (updates.statut === 'terminee' && Number(updates.montant_collecte) > 0) {
    const { data: current } = await supabaseAdmin
      .from('boisson_tournees')
      .select('statut, date_tournee, chauffeur_nom, zone')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()

    if (current && current.statut !== 'terminee') {
      const montantTTC = Number(updates.montant_collecte)
      const montantHT  = Math.round(montantTTC / 1.189)
      const montantTVA = montantTTC - montantHT

      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'BOI-001',
        p_source_module: 'boisson',
        p_source_table:  'boisson_tournees',
        p_source_id:     id,
        p_montant_ht:    montantHT,
        p_montant_tva:   montantTVA,
        p_montant_ttc:   montantTTC,
        p_libelle:       `Tournée — ${updates.chauffeur_nom ?? current.chauffeur_nom}${current.zone ? ` — ${current.zone}` : ''}`,
        p_date_event:    updates.date_tournee ?? current.date_tournee ?? new Date().toISOString().split('T')[0],
        p_fiscal_year:   new Date().getFullYear(),
        p_metadata:      {
          mode_paiement: 'especes',
          chauffeur_nom: updates.chauffeur_nom ?? current.chauffeur_nom,
          zone:          current.zone ?? null,
        },
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
