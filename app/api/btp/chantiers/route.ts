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
    .from('btp_chantiers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
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
  const { nom, client_nom, client_id, description, adresse, budget, date_debut, date_fin, chef_projet, notes } = body

  if (!nom?.trim()) return NextResponse.json({ error: 'Nom du chantier requis' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('btp_chantiers')
    .insert({
      tenant_id:   ctx.tenantId,
      nom:         nom.trim(),
      client_nom:  client_nom  || null,
      client_id:   client_id   || null,
      description: description || null,
      adresse:     adresse     || null,
      budget:      budget      ?? 0,
      date_debut:  date_debut  || null,
      date_fin:    date_fin    || null,
      chef_projet: chef_projet || null,
      notes:       notes       || null,
      statut:      'planifie',
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Émettre BTP-001 : 411 Clients / 722 Travaux exécutés (devis initial = travaux planifiés)
  if (budget && budget > 0) {
    const montantHT  = Number(budget)
    const montantTVA = Math.round(montantHT * 0.189 * 100) / 100
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_event_type:    'BTP-001',
      p_tenant_id:     ctx.tenantId,
      p_montant_ht:    montantHT,
      p_montant_tva:   montantTVA,
      p_montant_ttc:   Math.round((montantHT + montantTVA) * 100) / 100,
      p_date_event:    date_debut || new Date().toISOString().split('T')[0],
      p_fiscal_year:   new Date().getFullYear(),
      p_libelle:       `Chantier BTP : ${nom}`,
      p_source_module: 'btp',
      p_source_table:  'btp_chantiers',
      p_source_id:     data.id,
      p_metadata:      JSON.stringify({ client_nom: client_nom || null, chef_projet: chef_projet || null }),
    })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['nom','client_nom','description','adresse','budget','montant_depense','avancement_pct','statut','date_debut','date_fin','chef_projet','notes']
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) payload[k] = updates[k]

  const { error: updErr } = await supabaseAdmin
    .from('btp_chantiers')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Émettre BTP-002 : encaissement règlement client quand chantier terminé
  if (updates.statut === 'termine') {
    const { data: chantier } = await supabaseAdmin
      .from('btp_chantiers')
      .select('budget, nom, client_nom')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()
    const budget = chantier?.budget ?? 0
    if (budget > 0) {
      const montantHT  = Number(budget)
      const montantTTC = Math.round(montantHT * 1.189 * 100) / 100
      await supabaseAdmin.rpc('emit_accounting_event', {
        p_event_type:    'BTP-002',
        p_tenant_id:     ctx.tenantId,
        p_montant_ht:    montantHT,
        p_montant_tva:   Math.round((montantTTC - montantHT) * 100) / 100,
        p_montant_ttc:   montantTTC,
        p_date_event:    new Date().toISOString().split('T')[0],
        p_fiscal_year:   new Date().getFullYear(),
        p_libelle:       `Règlement chantier : ${chantier?.nom ?? id}`,
        p_source_module: 'btp',
        p_source_table:  'btp_chantiers',
        p_source_id:     id,
        p_metadata:      JSON.stringify({ client_nom: chantier?.client_nom || null, mode_paiement: updates.mode_paiement || 'virement' }),
      })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error: delErr } = await supabaseAdmin
    .from('btp_chantiers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
