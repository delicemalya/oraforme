import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../hr/_auth'
import { createWhatsappService } from '@/lib/whatsapp-business'


/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/rh/paie
 * ─────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/rh/paie
 * Crée un bulletin de paie — écritures SYSCOHADA gérées par T9 (migration 136)
 * ─────────────────────────────────────────────────────────────────────────── */
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

  // Verify employee belongs to this tenant and is payable
  const { data: emp } = await supabaseAdmin
    .from('employes')
    .select('id, nom, poste, matricule, statut')
    .eq('id', employe_id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
  if (emp.statut === 'licencie' || emp.statut === 'retraite') {
    return NextResponse.json({
      error: `Impossible de générer un bulletin pour un employé ${emp.statut} (${emp.nom})`
    }, { status: 400 })
  }

  // Check duplicate
  const { data: dup } = await supabaseAdmin
    .from('bulletins_paie')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('employe_id', employe_id)
    .eq('mois', mois)
    .eq('annee', annee)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: `Bulletin ${mois}/${annee} déjà créé pour cet employé` }, { status: 409 })

  /* ── Valeurs numériques ───────────────────────────────────────────────── */
  const numBrut        = Number(brut)
  const numNet         = Number(net)         || numBrut
  const numCnssSalarie = Number(cnss_salarie)  || 0
  const numCnssPatron  = Number(cnss_patronal) || 0
  const numIrpp        = Number(irpp)          || 0
  const numPrimes      = Number(primes)        || 0
  const numHeuresSup   = Number(heures_sup)    || 0
  const numTauxHoraire = Number(taux_horaire)  || 0
  const modePaie       = mode_paiement || 'virement'

  /* ── Insérer le bulletin ─────────────────────────────────────────────── */
  const { data: bulletin, error: bulErr } = await supabaseAdmin
    .from('bulletins_paie')
    .insert({
      tenant_id:      auth.tenantId,
      employe_id,
      mois:           parseInt(mois),
      annee:          parseInt(annee),
      brut:           numBrut,
      cnss_salarie:   numCnssSalarie,
      cnss_patronal:  numCnssPatron,
      irpp:           numIrpp,
      net:            numNet,
      primes:         numPrimes,
      heures_sup:     numHeuresSup,
      taux_horaire:   numTauxHoraire,
      mode_paiement:  modePaie,
      statut:         'generee',
    })
    .select('*, employes(nom, poste, matricule)')
    .single()

  if (bulErr) return NextResponse.json({ error: bulErr.message }, { status: 500 })

  // Moteur comptable — PAI-001 (charge salariale)
  const payDate = `${parseInt(annee)}-${String(parseInt(mois)).padStart(2, '0')}-25`
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     auth.tenantId,
    p_event_type:    'PAI-001',
    p_source_module: 'paie',
    p_source_table:  'bulletins_paie',
    p_source_id:     bulletin.id,
    p_montant_ht:    numBrut,
    p_montant_tva:   0,
    p_montant_ttc:   0,
    p_montant_net:   numNet,
    p_libelle:       `Paie ${String(parseInt(mois)).padStart(2,'0')}/${annee} — ${emp.nom}`,
    p_date_event:    payDate,
    p_fiscal_year:   parseInt(annee),
    p_metadata: {
      cnss_patronal: numCnssPatron,
      cnss_salarie:  numCnssSalarie,
      irpp:          numIrpp,
      employe_nom:   emp.nom,
      mois:          parseInt(mois),
      annee:         parseInt(annee),
      country_code:  'CG',
    },
    p_event_version: 1,
  })

  // WhatsApp — notification bulletin de paie (non bloquant)
  ;(async () => {
    try {
      const { data: empPhone } = await supabaseAdmin
        .from('employes')
        .select('telephone')
        .eq('id', employe_id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle()
      const { data: cfgData } = await supabaseAdmin
        .from('entreprise_config')
        .select('nom')
        .eq('tenant_id', auth.tenantId)
        .maybeSingle()
      if (empPhone?.telephone) {
        const wa = createWhatsappService(auth.tenantId)
        const MOIS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
        await wa.sendPayroll({
          to:           empPhone.telephone,
          toName:       emp.nom,
          employeeName: emp.nom,
          period:       `${MOIS_FULL[parseInt(mois) - 1]} ${annee}`,
          netSalary:    `${numNet.toLocaleString('fr-FR')} FCFA`,
          companyName:  cfgData?.nom ?? 'Votre employeur',
        })
      }
    } catch { /* WhatsApp non configuré — silencieux */ }
  })()

  return NextResponse.json({ success: true, data: bulletin }, { status: 201 })
}
