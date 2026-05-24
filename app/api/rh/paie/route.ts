import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../hr/_auth'

export async function GET(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mois   = searchParams.get('mois')
  const annee  = searchParams.get('annee')
  const statut = searchParams.get('statut')
  const limit  = parseInt(searchParams.get('limit') || '100')

  let query = supabaseAdmin
    .from('bulletins_paie')
    .select('*, employes(nom, poste, matricule, departement)')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (mois)   query = query.eq('mois', parseInt(mois))
  if (annee)  query = query.eq('annee', parseInt(annee))
  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    employe_id, mois, annee,
    brut, cnss_salarie, cnss_patronal, irpp, net,
    primes, heures_sup, taux_horaire,
    mode_paiement,
  } = body

  if (!employe_id) return NextResponse.json({ error: 'employe_id requis' }, { status: 400 })
  if (!mois || !annee) return NextResponse.json({ error: 'mois et annee requis' }, { status: 400 })
  if (!brut || Number(brut) < 0) return NextResponse.json({ error: 'brut invalide' }, { status: 400 })

  // Verify employee belongs to this tenant
  const { data: emp } = await supabaseAdmin
    .from('employes').select('id, nom').eq('id', employe_id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })

  // Check duplicate
  const { data: dup } = await supabaseAdmin
    .from('bulletins_paie')
    .select('id').eq('tenant_id', auth.tenantId)
    .eq('employe_id', employe_id).eq('mois', mois).eq('annee', annee)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: `Bulletin ${mois}/${annee} déjà créé pour cet employé` }, { status: 409 })

  const { data, error } = await supabaseAdmin
    .from('bulletins_paie')
    .insert({
      tenant_id:      auth.tenantId,
      employe_id,
      mois:           parseInt(mois),
      annee:          parseInt(annee),
      brut:           Number(brut),
      cnss_salarie:   Number(cnss_salarie)  || 0,
      cnss_patronal:  Number(cnss_patronal) || 0,
      irpp:           Number(irpp)          || 0,
      net:            Number(net)           || Number(brut),
      primes:         Number(primes)        || 0,
      heures_sup:     Number(heures_sup)    || 0,
      taux_horaire:   Number(taux_horaire)  || 0,
      mode_paiement:  mode_paiement || 'virement',
      statut:         'generee',
    })
    .select('*, employes(nom, poste, matricule)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
