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

  const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const moisLabel   = MOIS_LABELS[data.mois] ?? `M${data.mois}`
  const employeNom  = (data.employes as { nom?: string } | null)?.nom ?? 'Employé'

  // PAI-001 — Constatation salaire (moteur comptable central, migration 141)
  // Remplace les 4 écritures de trg_bulletins_paie (supprimé migration 141)
  if (statut === 'validee') {
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     auth.tenantId,
      p_event_type:    'PAI-001',
      p_source_module: 'paie',
      p_source_table:  'bulletins_paie',
      p_source_id:     data.id,
      p_montant_ht:    Number(data.brut)  || 0,
      p_montant_tva:   0,
      p_montant_ttc:   Number(data.net)   || 0,
      p_montant_net:   Number(data.net)   || 0,
      p_libelle:       `Bulletin paie ${moisLabel} ${data.annee} — ${employeNom} — constatation`,
      p_date_event:    new Date().toISOString().slice(0, 10),
      p_fiscal_year:   data.annee,
      p_metadata: {
        employe_nom:   employeNom,
        mois:          data.mois,
        annee:         data.annee,
        cnss_patronal: Number(data.cnss_patronal) || 0,
        cnss_salarie:  Number(data.cnss_salarie)  || 0,
        irpp:          Number(data.irpp)           || 0,
      },
    })
  }

  // PAI-002 — Paiement net (moteur comptable central, migration 141)
  if (statut === 'payee') {
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     auth.tenantId,
      p_event_type:    'PAI-002',
      p_source_module: 'paie',
      p_source_table:  'bulletins_paie',
      p_source_id:     data.id,
      p_montant_ht:    0,
      p_montant_tva:   0,
      p_montant_ttc:   Number(data.net)   || 0,
      p_libelle:       `Paiement salaire ${moisLabel} ${data.annee} — ${employeNom}`,
      p_date_event:    (updates.date_paiement as string) ?? new Date().toISOString().slice(0, 10),
      p_fiscal_year:   data.annee,
      p_metadata: {
        employe_nom:   employeNom,
        mois:          data.mois,
        annee:         data.annee,
        mode_paiement: (data.mode_paiement as string | null) ?? 'virement',
      },
    })
  }

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
