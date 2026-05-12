import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { product_id, warehouse_id, type, quantite, reference, note } = await req.json()

  if (!product_id || !type || quantite == null) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  if (!['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'].includes(type)) {
    return NextResponse.json({ error: 'Type de mouvement invalide' }, { status: 400 })
  }

  // Prevent negative stock on OUT movements
  if (type === 'OUT') {
    const { data: currentStock } = await supabaseAdmin.rpc('get_product_stock', { p_id: product_id })
    const stock = Number(currentStock ?? 0)
    if (stock < Number(quantite)) {
      return NextResponse.json({ error: `Stock insuffisant — disponible : ${stock}` }, { status: 422 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('stock_movements')
    .insert({
      tenant_id:    profile.tenant_id,
      product_id,
      warehouse_id: warehouse_id ?? null,
      type,
      quantite:     Number(quantite),
      reference:    reference ?? null,
      note:         note ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
