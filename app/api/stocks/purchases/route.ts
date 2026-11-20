import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// ── POST /api/stocks/purchases ───────────────────────────────────────────────
// BOI-004 — Crée un achat (purchases + purchase_items), statut 'brouillon'.
// Aucune écriture comptable ici : le fait générateur de la dette fournisseur
// est la réception (voir PATCH ci-dessous), pas la simple intention d'achat —
// sinon un achat annulé après brouillon aurait été comptabilisé pour rien.
interface PurchaseLine { product_id: string; quantite: number; prix: number }

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { supplier_id, reference, date, notes, lines }: {
    supplier_id?: string | null
    reference?:   string | null
    date?:        string
    notes?:       string | null
    lines:        PurchaseLine[]
  } = body

  const validLines = (lines || []).filter(l => l.product_id && l.quantite > 0)
  if (validLines.length === 0) {
    return NextResponse.json({ error: 'Au moins un produit requis' }, { status: 400 })
  }

  const montantTotal = validLines.reduce((s, l) => s + l.quantite * l.prix, 0)
  const dateAchat = date || new Date().toISOString().split('T')[0]

  const { data: purchase, error: pErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      tenant_id:     ctx.tenantId,
      supplier_id:   supplier_id || null,
      reference:     reference?.trim() || `ACH-${Date.now()}`,
      date:          dateAchat,
      statut:        'brouillon',
      montant_total: montantTotal,
      notes:         notes?.trim() || null,
    })
    .select('id, reference')
    .single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { error: itemsErr } = await supabaseAdmin
    .from('purchase_items')
    .insert(validLines.map(l => ({
      purchase_id: purchase.id,
      product_id:  l.product_id,
      quantite:    l.quantite,
      prix:        l.prix,
    })))

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  return NextResponse.json({ id: purchase.id, reference: purchase.reference }, { status: 201 })
}

// ── PATCH /api/stocks/purchases ──────────────────────────────────────────────
// Transition de statut sur un achat existant. BOI-004 :
//   → 'reçu' : entrée physique en stock (fn_stock_move, une fois par ligne)
//              + ACH-001 (601/401 HT), le fait générateur comptable réel.
//              Ne déclenche PAS STK-001 (311/401) : émettre les deux pour le
//              même événement doublerait le crédit fournisseur. STK-001 reste
//              défini dans accounting_event_rules mais volontairement non
//              câblé ici (méthode de l'inventaire intermittent, cohérente
//              avec ACH-001, seule méthode déjà prouvée fonctionnelle avant
//              cette mission — voir docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md).
//   → 'payé' : ACH-002 (401/521), remplace l'ancien writeComptaEntry()
//              (dette technique EXM-JE-003) par le moteur événementiel
//              déjà utilisé par le flux achats legacy.
//   → autre  : simple changement de statut (brouillon/commandé/annulé…).
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, statut } = body as { id?: string; statut?: string }

  if (!id || !statut) return NextResponse.json({ error: 'id et statut requis' }, { status: 400 })

  const { data: purchase, error: fetchErr } = await supabaseAdmin
    .from('purchases')
    .select('id, reference, supplier_id, montant_total, statut, date')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (fetchErr || !purchase) return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
  if (purchase.statut === statut) return NextResponse.json({ error: 'Statut déjà atteint' }, { status: 409 })

  const { error: updErr } = await supabaseAdmin
    .from('purchases')
    .update({ statut })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const today = new Date().toISOString().split('T')[0]

  if (statut === 'reçu') {
    const { data: pItems, error: itemsErr } = await supabaseAdmin
      .from('purchase_items')
      .select('id, product_id, quantite, prix')
      .eq('purchase_id', id)

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    // BOI-010 : chaque réception est explicitement tracée à sa ligne d'achat
    // (purchase_item_id) et marquée origine='achat_fournisseur' — jamais
    // déduite, toujours déclarée, conformément à BOI-006/007. La chaîne
    // stock_movements → purchase_items → purchases → suppliers reste
    // entièrement navigable par FK, sans dupliquer ces données sur products.
    for (const item of pItems || []) {
      const { error: mvtErr } = await supabaseAdmin.rpc('fn_stock_move', {
        p_tenant_id:        ctx.tenantId,
        p_product_id:       item.product_id,
        p_type:             'reception',
        p_quantite:         item.quantite,
        p_warehouse_id:     null,
        p_unit_cost:        item.prix,
        p_reference:        purchase.reference,
        p_notes:            `Réception achat ${purchase.reference}`,
        p_origine:          'achat_fournisseur',
        p_purchase_item_id: item.id,
      })
      if (mvtErr) return NextResponse.json({ error: mvtErr.message }, { status: 500 })
    }

    const montantHT = Number(purchase.montant_total)
    if (montantHT > 0) {
      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'ACH-001',
        p_source_module: 'stocks',
        p_source_table:  'purchases',
        p_source_id:     purchase.id,
        p_montant_ht:    montantHT,
        p_montant_tva:   0,
        p_montant_ttc:   montantHT,
        p_libelle:       `Achat fournisseur — ${purchase.reference}`,
        p_date_event:    purchase.date || today,
        p_fiscal_year:   new Date(purchase.date || today).getFullYear(),
        p_metadata:      { supplier_id: purchase.supplier_id || null },
      })
    }
  }

  if (statut === 'payé') {
    const montantHT = Number(purchase.montant_total)
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'ACH-002',
      p_source_module: 'stocks',
      p_source_table:  'purchases',
      p_source_id:     purchase.id,
      p_montant_ht:    montantHT,
      p_montant_tva:   0,
      p_montant_ttc:   montantHT,
      p_libelle:       `Règlement fournisseur — ${purchase.reference}`,
      p_date_event:    today,
      p_fiscal_year:   new Date(today).getFullYear(),
      p_metadata:      { supplier_id: purchase.supplier_id || null },
    })
  }

  return NextResponse.json({ success: true })
}
