import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  const { data, error } = await supabaseAdmin
    .from('resto_menu')
    .select('id,nom,categorie,prix,emoji,disponible')
    .eq('tenant_id', tenantId)
    .eq('disponible', true)
    .order('categorie')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise')
    .eq('id', tenantId)
    .maybeSingle()

  return NextResponse.json({ items: data ?? [], restaurant: tenant?.nom_entreprise ?? 'Restaurant' })
}
