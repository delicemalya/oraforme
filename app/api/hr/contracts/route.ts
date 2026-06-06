import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../_auth'

export async function GET(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employe_id = searchParams.get('employe_id')

  let query = supabaseAdmin
    .from('contrats')
    .select('*, employes(nom, poste, matricule, email, telephone, photo_url)')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  if (employe_id) query = query.eq('employe_id', employe_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    employe_id, type_contrat, date_debut, date_fin,
    salaire_base, primes, periode_essai, lieu_travail,
    description, clauses, statut, signe_le,
    signe_employe, signe_employeur, avantages, notes,
  } = body

  if (!employe_id) return NextResponse.json({ error: 'employe_id requis' }, { status: 400 })
  if (!date_debut) return NextResponse.json({ error: 'date_debut requise' }, { status: 400 })
  if (salaire_base === undefined || Number(salaire_base) < 0) {
    return NextResponse.json({ error: 'salaire_base invalide' }, { status: 400 })
  }

  const { data: emp } = await supabaseAdmin
    .from('employes').select('id, nom').eq('id', employe_id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('contrats')
    .insert({
      tenant_id:       auth.tenantId,
      employe_id,
      type_contrat:    type_contrat || 'cdi',
      date_debut,
      date_fin:        date_fin || null,
      salaire_base:    Number(salaire_base),
      primes:          Number(primes) || 0,
      periode_essai:   Number(periode_essai) || 0,
      lieu_travail:    lieu_travail || null,
      description:     description || null,
      clauses:         clauses || null,
      statut:          statut || 'actif',
      signe_le:        signe_le || null,
      signe_employe:   Boolean(signe_employe),
      signe_employeur: Boolean(signe_employeur),
      avantages:       avantages || [],
      notes:           notes || null,
      created_by:      auth.user.id,
    })
    .select('*, employes(nom, poste, matricule)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ((statut || 'actif') === 'actif') {
    await supabaseAdmin.from('employes')
      .update({ salaire_base: Number(salaire_base), contrat: type_contrat || 'cdi' })
      .eq('id', employe_id).eq('tenant_id', auth.tenantId)
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
