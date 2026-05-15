import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../_auth'

export async function GET() {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('employes')
    .select('*, departements(nom, couleur)')
    .eq('tenant_id', auth.tenantId)
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!['owner', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Accès refusé — rôle insuffisant' }, { status: 403 })
  }

  const body = await req.json()
  const {
    nom, poste, email, telephone, salaire_base, contrat, statut, cnss,
    date_embauche, date_naissance, date_fin_contrat, notes,
    nationalite, adresse, departement_id, manager_id, agent_code, ville,
  } = body

  if (!nom?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  // Block duplicate CNSS within same tenant
  if (cnss?.trim()) {
    const { data: dup } = await supabaseAdmin
      .from('employes').select('id')
      .eq('tenant_id', auth.tenantId).eq('cnss', cnss.trim()).maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'Un employé avec ce numéro CNSS existe déjà' }, { status: 409 })
    }
  }

  // Auto-generate matricule
  const { data: matricule } = await supabaseAdmin.rpc('generate_matricule', {
    p_tenant_id: auth.tenantId,
  })

  const { data, error } = await supabaseAdmin
    .from('employes')
    .insert({
      tenant_id:       auth.tenantId,
      matricule:       matricule ?? null,
      agent_code:      agent_code?.trim() || null,   // trigger fills this if null
      ville:           ville?.trim() || 'PNR',
      nom:             nom.trim(),
      poste:           poste?.trim() || null,
      email:           email?.trim() || null,
      telephone:       telephone?.trim() || null,
      salaire_base:    Number(salaire_base) || 0,
      contrat:         contrat || 'cdi',
      statut:          statut || 'actif',
      cnss:            cnss?.trim() || null,
      date_embauche:   date_embauche || null,
      date_naissance:  date_naissance || null,
      date_fin_contrat: date_fin_contrat || null,
      solde_conges:    26,
      notes:           notes || null,
      nationalite:     nationalite || 'Congolaise',
      adresse:         adresse || null,
      departement_id:  departement_id || null,
      manager_id:      manager_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
