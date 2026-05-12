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

  const { nom, description, couleur } = await req.json()
  if (!nom?.trim()) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('departements')
    .update({ nom: nom.trim(), description: description || null, couleur: couleur || '#8B5CF6' })
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .select().single()

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

  const { count } = await supabaseAdmin
    .from('employes').select('id', { count: 'exact', head: true })
    .eq('departement_id', id).eq('tenant_id', auth.tenantId)
  if (count && count > 0) {
    return NextResponse.json(
      { error: `Ce département contient ${count} employé(s). Réassignez-les avant de le supprimer.` },
      { status: 409 }
    )
  }

  // Delete positions first
  await supabaseAdmin.from('postes').delete().eq('departement_id', id).eq('tenant_id', auth.tenantId)

  const { error } = await supabaseAdmin
    .from('departements').delete().eq('id', id).eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
