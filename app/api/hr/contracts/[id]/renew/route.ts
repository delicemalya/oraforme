import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../_auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { type_contrat, date_debut, date_fin, salaire_base, motif } = body

  // Load original contract
  const { data: original, error: loadErr } = await supabaseAdmin
    .from('contrats')
    .select('*')
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .single()
  if (loadErr || !original) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  // Mark original as expired
  await supabaseAdmin.from('contrats').update({ statut: 'expire' }).eq('id', id)

  // Create new contract
  const { data: nouveau, error: createErr } = await supabaseAdmin
    .from('contrats')
    .insert({
      tenant_id:            auth.tenantId,
      employe_id:           original.employe_id,
      type_contrat:         type_contrat || original.type_contrat,
      date_debut:           date_debut || new Date().toISOString().slice(0, 10),
      date_fin:             date_fin || null,
      salaire_base:         Number(salaire_base) || original.salaire_base,
      primes:               original.primes,
      periode_essai:        0,
      lieu_travail:         original.lieu_travail,
      description:          motif ? `Renouvellement — ${motif}` : `Renouvellement du contrat du ${original.date_debut}`,
      statut:               'actif',
      contrat_precedent_id: id,
      created_by:           auth.user.id,
    })
    .select('*, employes(nom, poste)')
    .single()

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

  // Sync salary to employee
  await supabaseAdmin.from('employes')
    .update({
      salaire_base: Number(salaire_base) || original.salaire_base,
      contrat: type_contrat || original.type_contrat,
      statut: 'actif',
    })
    .eq('id', original.employe_id).eq('tenant_id', auth.tenantId)

  return NextResponse.json({ success: true, data: nouveau }, { status: 201 })
}
