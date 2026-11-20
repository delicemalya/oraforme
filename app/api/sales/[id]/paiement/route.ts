import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * POST /api/sales/:id/paiement — règlement d'une vente à crédit (D3).
 *
 * Réutilise la structure FAC-002 (521(resolver)/411, montant_ttc) sous
 * l'event_type VTE-002 — aucun nouveau mécanisme de paiement créé. Règlement
 * intégral uniquement en V1 (pas de règlement partiel — aucun écran de
 * recouvrement n'existe encore, C6-PRODUCT-DECISIONS §7/§11).
 *
 * A2 (C6-POST-REVIEW-FIX, anomalie A2 de docs/C6-PRE-PRODUCTION-REVIEW.md §5) :
 * VTE-002 ne doit jamais être émis si VTE-001 n'a pas atteint
 * accounting_events.status='processed'. Ne JAMAIS déduire ceci d'un statut
 * envoyé par le client, ni du seul fait que la vente existe — emit_accounting
 * _event peut retourner sans erreur alors que fn_ae_execute_event a échoué en
 * interne (elle intercepte ses propres exceptions, migration 138) : la seule
 * source fiable est une relecture de accounting_events après coup.
 *
 * Idempotence : un retry sur une vente déjà réglée ('solde') renvoie l'état
 * actuel avec replay:true plutôt que de retenter l'émission comptable.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const modePaiementReel: string = body.mode_paiement_reel ?? 'especes'

  const { data: vente, error: venteErr } = await supabaseAdmin
    .from('ventes')
    .select('id, total, statut_paiement, mode_paiement')
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (venteErr) return NextResponse.json({ error: venteErr.message }, { status: 500 })
  if (!vente) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
  if (vente.mode_paiement !== 'credit') {
    return NextResponse.json({ error: 'Cette vente n\'a pas été émise à crédit' }, { status: 400 })
  }
  if (vente.statut_paiement === 'solde') {
    return NextResponse.json({ data: vente, replay: true }, { status: 200 })
  }
  if (vente.statut_paiement !== 'du') {
    return NextResponse.json({ error: `Vente au statut "${vente.statut_paiement}" — rien à régler` }, { status: 400 })
  }

  // VTE-001 doit exister et être 'processed' — jamais supposé parce que la
  // vente existe (voir note d'en-tête, anomalie A2).
  const { data: vte001, error: vte001Err } = await supabaseAdmin
    .from('accounting_events')
    .select('id, status')
    .eq('tenant_id', ctx.tid)
    .eq('source_table', 'ventes')
    .eq('source_id', id)
    .eq('event_type', 'VTE-001')
    .maybeSingle()

  if (vte001Err) return NextResponse.json({ error: vte001Err.message }, { status: 500 })
  if (!vte001 || vte001.status !== 'processed') {
    return NextResponse.json({
      error: `Règlement refusé : VTE-001 ${vte001 ? `au statut "${vte001.status}"` : 'absent'} pour cette vente — la vente n'est pas comptabilisée avec succès.`,
    }, { status: 409 })
  }

  const { data: vte002Id, error: aeErr } = await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tid,
    p_event_type:    'VTE-002',
    p_source_module: 'commerce',
    p_source_table:  'ventes',
    p_source_id:     vente.id,
    p_montant_ht:    0,
    p_montant_tva:   0,
    p_montant_ttc:   vente.total,
    p_libelle:       `Règlement vente ${vente.id}`,
    p_date_event:    new Date().toISOString().split('T')[0],
    p_fiscal_year:   new Date().getFullYear(),
    p_metadata:      { mode_paiement: modePaiementReel, reference: vente.id },
  })

  if (aeErr) return NextResponse.json({ error: aeErr.message }, { status: 500 })

  // Même principe que pour VTE-001 : emit_accounting_event sans erreur ne
  // garantit pas que fn_ae_execute_event a réussi (voir note d'en-tête).
  if (vte002Id) {
    const { data: vte002 } = await supabaseAdmin
      .from('accounting_events').select('status').eq('id', vte002Id).maybeSingle()
    if (!vte002 || vte002.status !== 'processed') {
      return NextResponse.json({
        error: `Règlement VTE-002 émis mais non comptabilisé (statut="${vte002?.status ?? 'introuvable'}") — statut_paiement non modifié.`,
      }, { status: 409 })
    }
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('ventes')
    .update({ statut_paiement: 'solde' })
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .select('*')
    .single()

  if (updErr) {
    // L'écriture comptable a déjà été émise et ne peut pas être annulée
    // silencieusement — on le signale plutôt que de masquer l'incohérence.
    return NextResponse.json({
      warning: `Règlement comptabilisé (VTE-002) mais statut_paiement non mis à jour — ${updErr.message}`,
    }, { status: 207 })
  }

  return NextResponse.json({ data: updated })
}
