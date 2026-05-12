import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../_auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: departement_id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { titre, niveau, description } = await req.json()
  if (!titre?.trim()) return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })

  const valid = ['direction', 'cadre', 'technicien', 'agent']
  if (niveau && !valid.includes(niveau)) {
    return NextResponse.json({ error: 'Niveau invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('postes')
    .insert({
      tenant_id:      auth.tenantId,
      departement_id,
      titre:          titre.trim(),
      niveau:         niveau || 'agent',
      description:    description || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: departement_id } = await params
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { poste_id } = await req.json()
  if (!poste_id) return NextResponse.json({ error: 'poste_id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('postes').delete()
    .eq('id', poste_id).eq('departement_id', departement_id).eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
