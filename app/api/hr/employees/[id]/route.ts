import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../_auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'nom', 'poste', 'email', 'telephone', 'salaire_base', 'contrat', 'statut',
    'cnss', 'date_embauche', 'date_naissance', 'date_fin_contrat', 'notes',
    'nationalite', 'adresse', 'departement_id', 'manager_id', 'agent_code',
    'solde_conges', 'date_retraite_prevue',
    'situation_matrimoniale', 'nb_enfants', 'photo_url',
  ]
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  const { data, error } = await supabaseAdmin
    .from('employes')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Prevent deleting an employee who manages others
  const { count } = await supabaseAdmin
    .from('employes').select('id', { count: 'exact', head: true })
    .eq('manager_id', id).eq('tenant_id', auth.tenantId)
  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Cet employé est manager de ' + count + ' collaborateur(s). Réassignez-les avant de le supprimer.' },
      { status: 409 }
    )
  }

  const { error } = await supabaseAdmin
    .from('employes').delete().eq('id', id).eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
