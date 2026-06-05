import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug requis' }, { status: 400 })

  const { data: offre, error } = await supabaseAdmin
    .from('offres_emploi')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !offre) {
    return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
  }

  if (offre.statut !== 'active') {
    return NextResponse.json({ error: 'Cette offre n\'est plus disponible', expired: true }, { status: 410 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('nom, secteur')
    .eq('id', offre.tenant_id)
    .maybeSingle()

  return NextResponse.json({ ...offre, tenant_nom: tenant?.nom ?? 'Entreprise', tenant_secteur: tenant?.secteur ?? null })
}
