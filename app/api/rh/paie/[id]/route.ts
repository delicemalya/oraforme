import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../hr/_auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('bulletins_paie')
    .select('*, employes(nom, poste, matricule, departement, cnss, adresse)')
    .eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('bulletins_paie').select('id, statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (existing.statut === 'payee') {
    return NextResponse.json({ error: 'Bulletin déjà payé — non modifiable' }, { status: 400 })
  }

  const body = await req.json()
  const { statut, mode_paiement, date_paiement } = body

  // Validate transitions
  if (statut) {
    const transitions: Record<string, string[]> = {
      'generee':  ['validee'],
      'validee':  ['payee'],
    }
    const allowed = transitions[existing.statut] || []
    if (!allowed.includes(statut)) {
      return NextResponse.json({
        error: `Transition invalide: ${existing.statut} → ${statut}`
      }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (statut)         updates.statut         = statut
  if (mode_paiement)  updates.mode_paiement  = mode_paiement
  if (date_paiement)  updates.date_paiement  = date_paiement
  if (statut === 'payee' && !date_paiement) {
    updates.date_paiement = new Date().toISOString().slice(0, 10)
  }

  const { data, error } = await supabaseAdmin
    .from('bulletins_paie').update(updates).eq('id', id).eq('tenant_id', auth.tenantId)
    .select('*, employes(nom, poste)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('bulletins_paie').select('statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (existing.statut !== 'generee') {
    return NextResponse.json({ error: 'Seuls les bulletins en statut "generee" peuvent être supprimés' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('bulletins_paie').delete().eq('id', id).eq('tenant_id', auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
