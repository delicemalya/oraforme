import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('candidatures')
    .select(`
      id, statut, created_at, score_ia,
      candidats(nom, prenom, email),
      offres_emploi(titre, localisation, type_contrat, tenant_id)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 })

  const offre = data.offres_emploi as unknown as { titre: string; localisation: string | null; type_contrat: string | null; tenant_id: string } | null
  let entrepriseNom = 'Entreprise'
  if (offre?.tenant_id) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('nom').eq('id', offre.tenant_id).maybeSingle()
    entrepriseNom = tenant?.nom ?? 'Entreprise'
  }

  return NextResponse.json({
    id: data.id,
    statut: data.statut,
    created_at: data.created_at,
    score_ia: data.score_ia ?? 0,
    offre: offre ? { titre: offre.titre, localisation: offre.localisation, type_contrat: offre.type_contrat } : null,
    candidat: data.candidats as unknown as { nom: string | null; prenom: string | null; email: string | null } | null,
    entreprise: entrepriseNom,
  })
}
