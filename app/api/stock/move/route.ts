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
  return NextResponse.json({ success: true, data })
}
