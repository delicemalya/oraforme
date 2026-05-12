import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../_auth'

export async function GET() {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('departements')
    .select('*, postes(id, titre, niveau)')
    .eq('tenant_id', auth.tenantId)
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach employee count per department
  const { data: empCounts } = await supabaseAdmin
    .from('employes')
    .select('departement_id')
    .eq('tenant_id', auth.tenantId)
    .not('departement_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const e of empCounts ?? []) {
    if (e.departement_id) countMap[e.departement_id] = (countMap[e.departement_id] ?? 0) + 1
  }

  const enriched = (data ?? []).map(d => ({ ...d, nb_employes: countMap[d.id] ?? 0 }))
  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { nom, description, couleur } = await req.json()
  if (!nom?.trim()) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('departements')
    .insert({
      tenant_id:   auth.tenantId,
      nom:         nom.trim(),
      description: description || null,
      couleur:     couleur || '#8B5CF6',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
