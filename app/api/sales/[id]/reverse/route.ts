import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * POST /api/sales/:id/reverse — annulation d'une vente (C6-IMPLEMENTATION-DESIGN §11).
 *
 * Réutilise fn_reverse_accounting_event (générique, migration 138) — aucun
 * second moteur de reverse créé. Ordre obligatoire si la vente était à
 * crédit et déjà réglée : VTE-002 (règlement) extournée AVANT VTE-001 (vente),
 * pour que le solde 411 reste cohérent à chaque étape intermédiaire.
 *
 * Stock : un mouvement type='retour' par ligne, retrouvé via
 * stock_movements.reference = ventes.id (pas en recalculant depuis
 * vente_lignes, qui ne porte pas l'origine utilisée à la vente).
 *
 * Idempotence (C6-POST-REVIEW-FIX, anomalie C1 de
 * docs/C6-PRE-PRODUCTION-REVIEW.md §11) : un second appel sur la même vente
 * ne doit ni recréditer le stock ni créer une seconde extourne comptable.
 * Côté comptable, le mécanisme existe déjà (accounting_event_extournes.
 * UNIQUE(original_event_id), migration 138) — on l'utilise en filtrant les
 * événements déjà 'reversed' AVANT d'appeler fn_reverse_accounting_event
 * (qui lèverait une exception sinon), plutôt qu'en l'invoquant à l'aveugle.
 * Côté stock, aucun mécanisme n'existait avant cette mission : migration 186
 * ajoute stock_movements.reversed_movement_id + une contrainte UNIQUE
 * partielle — même patron que idempotency_key (185), INSERT d'abord, 23505
 * traité comme un no-op, jamais un SELECT préalable non protégé.
 *
 * Limite résiduelle, documentée, pas cachée : ces étapes restent plusieurs
 * appels RPC indépendants, pas une seule transaction Postgres — une
 * défaillance après la première extourne laisse un état partiel (comptabilité
 * extournée, stock pas encore retourné), à corriger manuellement si elle
 * survient. Le second appel, lui, ne duplique plus rien (c'est la propriété
 * d'idempotence recherchée ici, pas l'atomicité du premier appel).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason ?? 'Vente annulée'

  const { data: vente, error: venteErr } = await supabaseAdmin
    .from('ventes').select('id').eq('id', id).eq('tenant_id', ctx.tid).maybeSingle()
  if (venteErr) return NextResponse.json({ error: venteErr.message }, { status: 500 })
  if (!vente) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })

  const { data: events, error: evErr } = await supabaseAdmin
    .from('accounting_events')
    .select('id, event_type, status')
    .eq('tenant_id', ctx.tid)
    .eq('source_table', 'ventes')
    .eq('source_id', id)
    .in('status', ['processed', 'reversed'])

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
  if (!events || events.length === 0) {
    return NextResponse.json({ error: 'Aucun événement comptable traité pour cette vente' }, { status: 400 })
  }

  // VTE-002 (règlement) avant VTE-001 (vente) si les deux existent.
  const ordered = [...events].sort((a, b) =>
    (a.event_type === 'VTE-002' ? -1 : 0) - (b.event_type === 'VTE-002' ? -1 : 0))

  const reversed: string[] = []
  const alreadyReversed: string[] = []
  const failed: string[] = []
  for (const ev of ordered) {
    if (ev.status === 'reversed') {
      // Déjà extourné lors d'un appel précédent — aucun effet supplémentaire.
      alreadyReversed.push(ev.event_type)
      continue
    }
    const { error } = await supabaseAdmin.rpc('fn_reverse_accounting_event', {
      p_event_id:   ev.id,
      p_reason:     reason,
      p_created_by: ctx.profileId,
    })
    if (error) failed.push(`${ev.event_type} : ${error.message}`)
    else reversed.push(ev.event_type)
  }

  // Retours de stock — un par mouvement original de cette vente, avec son id
  // pour lier le retour via reversed_movement_id (idempotence, migration 186).
  const { data: mouvements } = await supabaseAdmin
    .from('stock_movements')
    .select('id, product_id, warehouse_id, quantite, origine, purchase_item_id')
    .eq('tenant_id', ctx.tid)
    .eq('reference', id)
    .eq('type', 'sortie')

  const stockRetours: string[] = []
  const stockDejaRetournes: string[] = []
  const stockEchecs: string[] = []
  for (const m of mouvements ?? []) {
    const { error } = await supabaseAdmin.rpc('fn_stock_move', {
      p_tenant_id:            ctx.tid,
      p_product_id:           m.product_id,
      p_type:                 'retour',
      p_quantite:             m.quantite,
      p_warehouse_id:          m.warehouse_id,
      p_reference:            id,
      p_notes:                `Retour sur annulation vente ${id} — ${reason}`,
      p_origine:              m.origine ?? null,
      p_purchase_item_id:     m.purchase_item_id ?? null,
      p_reversed_movement_id: m.id,
    })
    if (error) {
      if (error.code === '23505') {
        // idx_stock_movements_reversed_movement : ce mouvement a déjà été
        // retourné par un appel précédent — no-op, pas un échec.
        stockDejaRetournes.push(m.product_id)
      } else {
        stockEchecs.push(`${m.product_id} : ${error.message}`)
      }
    } else {
      stockRetours.push(m.product_id)
    }
  }

  if (failed.length > 0 || stockEchecs.length > 0) {
    return NextResponse.json({
      reversed, alreadyReversed, stockRetours, stockDejaRetournes,
      warning: `Extourne partielle — comptable échouée: [${failed.join('; ')}], stock échoué: [${stockEchecs.join('; ')}]`,
    }, { status: 207 })
  }

  return NextResponse.json({ reversed, alreadyReversed, stockRetours, stockDejaRetournes })
}
