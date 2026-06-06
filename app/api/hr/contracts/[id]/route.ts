import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../_auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('contrats')
    .select('*, employes(nom, poste, matricule, cnss, nationalite, adresse, email, telephone, photo_url)')
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'type_contrat', 'date_debut', 'date_fin', 'salaire_base', 'primes',
    'periode_essai', 'lieu_travail', 'description', 'clauses', 'statut', 'signe_le',
    'signe_employe', 'signe_employeur', 'avantages', 'notes',
  ]
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  const { data, error } = await supabaseAdmin
    .from('contrats').update(patch)
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync salary to employee when contract is active
  if (patch.statut === 'actif' && patch.salaire_base !== undefined) {
    const { data: contrat } = await supabaseAdmin
      .from('contrats').select('employe_id').eq('id', id).single()
    if (contrat?.employe_id) {
      await supabaseAdmin.from('employes')
        .update({ salaire_base: Number(patch.salaire_base) })
        .eq('id', contrat.employe_id).eq('tenant_id', auth.tenantId)
    }
  }

  return NextResponse.json({ success: true, data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('contrats').delete().eq('id', id).eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
