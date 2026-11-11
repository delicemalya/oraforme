import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/sales/:id — détail d'une vente (ticket), scopé au tenant de session.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('ventes')
    .select('*, vente_lignes(*)')
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}
