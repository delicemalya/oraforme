import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant, assertResourceOwnership } from '@/lib/tenant-guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { ctx, error } = await requireTenant()
  if (error) return error

  // Verify the product belongs to the authenticated user's tenant
  const ownershipError = await assertResourceOwnership('products', id, ctx.tenantId)
  if (ownershipError) return ownershipError

  const { data: stock, error: rpcError } = await supabaseAdmin.rpc('get_product_stock', { p_id: id })
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  return NextResponse.json({ stock: stock ?? 0 })
}
