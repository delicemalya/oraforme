import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant, assertResourceOwnership } from '@/lib/tenant-guard'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { product_id, warehouse_id, type, quantite, reference, note } = await req.json()

  if (!product_id || !type || quantite == null) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  if (!['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'].includes(type)) {
    return NextResponse.json({ error: 'Type de mouvement invalide' }, { status: 400 })
  }

  // Verify the product belongs to the authenticated user's tenant
  const ownershipError = await assertResourceOwnership('stock_articles', product_id, ctx.tenantId)
  if (ownershipError) return ownershipError

  // Prevent negative stock on OUT movements
  if (type === 'OUT') {
    const { data: currentStock } = await supabaseAdmin.rpc('get_product_stock', { p_id: product_id })
    const stock = Number(currentStock ?? 0)
    if (stock < Number(quantite)) {
      return NextResponse.json({ error: `Stock insuffisant — disponible : ${stock}` }, { status: 422 })
    }
  }

  const { data, error: insertError } = await supabaseAdmin
    .from('stock_movements')
    .insert({
      tenant_id:    ctx.tenantId,
      product_id,
      warehouse_id: warehouse_id ?? null,
      type,
      quantite:     Number(quantite),
      reference:    reference ?? null,
      note:         note ?? null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Emit STK-002 — Sortie stock consommation (601/311 HT) — fire-and-forget P-003
  if (type === 'OUT') {
    const { data: prod } = await supabaseAdmin
      .from('products')
      .select('prix_achat')
      .eq('id', product_id)
      .single()

    const montantHT = (prod?.prix_achat ?? 0) * Number(quantite)
    if (montantHT > 0) {
      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'STK-002',
        p_source_module: 'stocks',
        p_source_table:  'stock_movements',
        p_source_id:     data.id,
        p_montant_ht:    montantHT,
        p_montant_tva:   0,
        p_montant_ttc:   montantHT,
        p_libelle:       `Sortie stock — ${reference ?? data.id}`,
        p_date_event:    new Date().toISOString().split('T')[0],
        p_fiscal_year:   new Date().getFullYear(),
        p_metadata:      { product_id, warehouse_id: warehouse_id ?? null, quantite: Number(quantite), reference: reference ?? null },
      })
    }
  }

  return NextResponse.json({ success: true, data })
}
