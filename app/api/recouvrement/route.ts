import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/recouvrement — liste factures impayées + métriques
 * POST /api/recouvrement — enregistrer une relance + recalcul score client
 */
export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const today = new Date().toISOString().split('T')[0]

  // Factures impayées
  const { data: factures, error: facErr } = await supabaseAdmin
    .from('factures')
    .select('id, invoice_number, client_name, client_id, total, due_date, date, statut')
    .eq('tenant_id', ctx.tenantId)
    .in('statut', ['envoyee', 'retard', 'partiellement_payee'])
    .order('due_date', { ascending: true })

  if (facErr) return NextResponse.json({ error: facErr.message }, { status: 500 })

  const todayDate = new Date(today)
  const items = (factures ?? []).map(f => {
    const due = f.due_date ? new Date(f.due_date) : null
    const retard_jours = due ? Math.max(0, Math.ceil((todayDate.getTime() - due.getTime()) / 86400000)) : 0
    return { ...f, retard_jours }
  }).filter(f => f.retard_jours > 0)
    .sort((a, b) => b.retard_jours - a.retard_jours)

  // Relances liées
  const ids = items.map(f => f.id)
  let relances: unknown[] = []
  if (ids.length > 0) {
    const { data: r } = await supabaseAdmin
      .from('relances')
      .select('id, facture_id, type, niveau, statut, date_relance, created_at, retard_jours')
      .eq('tenant_id', ctx.tenantId)
      .in('facture_id', ids)
      .order('created_at', { ascending: false })
    relances = r ?? []
  }

  // Métriques
  const totalImpaye = items.reduce((s, f) => s + f.total, 0)
  const nbCritiques = items.filter(f => f.retard_jours > 30).length
  const nbSansRelance = items.filter(f => !(relances as {facture_id:string}[]).some(r => r.facture_id === f.id)).length

  return NextResponse.json({
    factures: items,
    relances,
    metriques: {
      total_impaye: totalImpaye,
      nb_factures:  items.length,
      nb_critiques: nbCritiques,
      nb_sans_relance: nbSansRelance,
      montant_critique: items.filter(f => f.retard_jours > 30).reduce((s, f) => s + f.total, 0),
    },
  })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { facture_id, client_id, type, niveau, message, montant_concerne, retard_jours } = body

  if (!facture_id || !type || !niveau) {
    return NextResponse.json({ error: 'facture_id, type et niveau requis' }, { status: 400 })
  }

  // Vérifier que la facture appartient au tenant
  const { data: fac } = await supabaseAdmin
    .from('factures')
    .select('id, client_id, client_name, statut')
    .eq('id', facture_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!fac) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  // Créer la relance
  const { data: relance, error: relErr } = await supabaseAdmin
    .from('relances')
    .insert({
      tenant_id:       ctx.tenantId,
      facture_id,
      client_id:       client_id ?? fac.client_id ?? null,
      type,
      niveau:          Number(niveau),
      statut:          'envoye',
      date_relance:    new Date().toISOString().split('T')[0],
      message:         message ?? null,
      montant_concerne: montant_concerne ?? null,
      retard_jours:    retard_jours ?? null,
    })
    .select()
    .single()

  if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 })

  // Mise à jour statut facture → 'retard' si ce n'est pas déjà le cas
  if (fac.statut === 'envoyee') {
    await supabaseAdmin.from('factures').update({ statut: 'retard' }).eq('id', facture_id).eq('tenant_id', ctx.tenantId)
  }

  // Activité CRM si client lié
  const cid = client_id ?? fac.client_id
  if (cid) {
    await supabaseAdmin.from('crm_activites').insert({
      tenant_id:    ctx.tenantId,
      client_id:    cid,
      type:         'relance',
      titre:        `Relance niveau ${niveau} (${type}) — Facture ${facture_id.slice(0, 8)}`,
      date_activite: new Date().toISOString(),
      fait:          true,
    })

    // Recalcul score risque client via la fonction SQL
    await supabaseAdmin.rpc('recalc_client_score', { p_client_id: cid, p_tenant_id: ctx.tenantId })
  }

  return NextResponse.json({
    success: true,
    relance_id: relance.id,
    message: `Relance niveau ${niveau} enregistrée`,
  }, { status: 201 })
}
