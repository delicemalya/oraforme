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
  const { type_resiliation, date_resiliation, motif, preavis_jours } = body

  const { data: contrat, error: loadErr } = await supabaseAdmin
    .from('contrats')
    .select('employe_id')
    .eq('id', id).eq('tenant_id', auth.tenantId)
    .single()
  if (loadErr || !contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const dateRes = date_resiliation || new Date().toISOString().slice(0, 10)

  // Mark contract as resilié
  const { error: updateErr } = await supabaseAdmin
    .from('contrats')
    .update({
      statut:   'resilie',
      date_fin: dateRes,
      notes:    `Résiliation (${type_resiliation ?? 'autre'}) le ${dateRes}${motif ? ` — ${motif}` : ''}${preavis_jours ? ` · Préavis : ${preavis_jours}j` : ''}`,
    })
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Update employee status
  const statutEmploye = type_resiliation === 'demission' ? 'actif'
    : type_resiliation === 'licenciement' ? 'licencie'
    : 'inactif'

  await supabaseAdmin.from('employes')
    .update({ statut: statutEmploye, date_fin_contrat: dateRes })
    .eq('id', contrat.employe_id).eq('tenant_id', auth.tenantId)

  return NextResponse.json({ success: true })
}
