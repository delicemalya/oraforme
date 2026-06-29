import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { buildDgAlerts, buildRhAlerts, buildEcoleAlerts, buildHotelAlerts } from '@/lib/analytics/alerts-engine'
import { growthPct } from '@/lib/analytics/formatters'
import type { DgKpis, RhKpis, EcoleKpis, HotelKpis, RestoKpis } from '@/lib/analytics/types'
import { computePayrollSummary, BULLETIN_SELECT } from '@/lib/erp-core/compute/payroll'
import { computeCA } from '@/lib/erp-core/compute/ca'

/**
 * GET /api/bi/insights?module=dg|rh|ecole|hotel|resto&year=2026
 * Returns structured BI data for the requested module.
 * Always tenant-isolated via RLS + explicit tenant_id filter.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const tid = profile.tenant_id
  const url = new URL(req.url)
  const moduleKey = url.searchParams.get('module') ?? 'dg'
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const monthKeys: string[] = []
  for (let m = 1; m <= 12; m++) {
    monthKeys.push(`${year}-${String(m).padStart(2, '0')}`)
  }

  const lastUpdated = new Date().toISOString()

  // ── DG (Direction Générale) ────────────────────────────────────────────────
  if (moduleKey === 'dg') {
    const [
      { data: txAll },
      { data: txMois },
      { data: txPrev },
      { data: factures },
      { data: employes },
      { data: bulletins },
      { data: contrats },
      { data: comptesBanque },
      { data: caisses },
      { data: wallets },
    ] = await Promise.all([
      supabaseAdmin.from('transactions').select('montant,type,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabaseAdmin.from('transactions').select('montant,type').eq('tenant_id', tid).gte('date', monthStart),
      supabaseAdmin.from('transactions').select('montant,type').eq('tenant_id', tid).gte('date', prevStart).lte('date', prevEnd),
      supabaseAdmin.from('factures').select('total,statut,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabaseAdmin.from('employes').select('statut,salaire_base').eq('tenant_id', tid),
      supabaseAdmin.from('bulletins_paie').select(BULLETIN_SELECT).eq('tenant_id', tid).eq('annee', year),
      supabaseAdmin.from('contrats_employes').select('date_fin').eq('tenant_id', tid).eq('statut', 'actif'),
      supabaseAdmin.from('comptes_bancaires').select('solde').eq('tenant_id', tid).eq('actif', true),
      supabaseAdmin.from('caisses').select('solde').eq('tenant_id', tid).eq('actif', true),
      supabaseAdmin.from('mobile_money_wallets').select('solde_actuel').eq('tenant_id', tid).eq('actif', true),
    ])

    const tx         = txAll ?? []
    const txM        = txMois ?? []
    const txP        = txPrev ?? []
    const facs       = factures ?? []
    const emps       = employes ?? []
    const buls       = bulletins ?? []
    const cons       = contrats ?? []

    const _ca        = computeCA(tx, facs, year)
    const caAnnee    = _ca.ca_encaisse
    const depAnnee   = _ca.dep_encaisse
    const caMois     = txM.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const depMois    = txM.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
    const caPrevMois  = txP.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const depPrevMois = txP.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)

    const resultatNet  = _ca.solde_treso
    const margeNetPct  = caAnnee > 0 ? Math.round((resultatNet / caAnnee) * 100) : 0

    const tresoB = (comptesBanque ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)
    const tresoC = (caisses ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)
    const tresoW = (wallets ?? []).reduce((s: number, c: { solde_actuel: number }) => s + (c.solde_actuel ?? 0), 0)
    const tresoTotale = tresoB + tresoC + tresoW

    const creancesClients    = _ca.creances
    const nbFacturesOuvertes = facs.filter(f => !['payee', 'annulee'].includes(f.statut ?? '')).length
    const nbFacturesRetard   = facs.filter(f => f.statut === 'en_retard' || f.statut === 'envoyee').length

    const _payrollDG    = computePayrollSummary(buls.filter(b => b.statut === 'payee'), year)
    const salairesAnnee = _payrollDG.net || emps.filter(e => e.statut === 'actif').reduce((s, e) => s + (e.salaire_base ?? 0), 0) * 12

    const effectifActif = emps.filter(e => e.statut === 'actif').length
    const effectifTotal = emps.length

    const contratsExpirant30 = cons.filter(c => {
      if (!c.date_fin) return false
      const diff = (new Date(c.date_fin).getTime() - Date.now()) / 86_400_000
      return diff >= 0 && diff <= 30
    }).length

    const kpis: DgKpis = {
      caAnnee, caMois, caPrevMois, depAnnee, depMois, depPrevMois,
      resultatNet, margeNetPct, tresoTotale, creancesClients,
      nbFacturesOuvertes, nbFacturesRetard, salairesAnnee,
      effectifActif, effectifTotal, contratsExpirant30,
    }

    const monthlyTrend = _ca.mensuel.map(m => ({ month: m.month, entrees: m.entrees, sorties: m.sorties, net: m.net }))

    const revenueBySource = [
      { name: 'Facturation', value: _ca.ca_facture, color: '#DC2626' },
      { name: 'Trésorerie',  value: tx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0), color: '#0F172A' },
    ].filter(s => s.value > 0)

    return NextResponse.json({
      module: 'dg', year,
      kpis,
      charts: { monthlyTrend, revenueBySource },
      alerts: buildDgAlerts(kpis),
      growth: {
        ca: growthPct(caMois, caPrevMois),
        dep: growthPct(depMois, depPrevMois),
      },
      lastUpdated,
    })
  }

  // ── RH ────────────────────────────────────────────────────────────────────
  if (moduleKey === 'rh') {
    const [
      { data: emps },
      { data: buls },
      { data: cons },
      { data: abs },
      { data: recrut },
    ] = await Promise.all([
      supabaseAdmin.from('employes').select('statut,salaire_base').eq('tenant_id', tid),
      supabaseAdmin.from('bulletins_paie').select(BULLETIN_SELECT).eq('tenant_id', tid).eq('annee', year),
      supabaseAdmin.from('contrats_employes').select('date_fin,statut').eq('tenant_id', tid).eq('statut', 'actif'),
      supabaseAdmin.from('presences').select('statut,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabaseAdmin.from('recrutements').select('statut,created_at').eq('tenant_id', tid).gte('created_at', yearStart).lte('created_at', yearEnd),
    ])

    const employees   = emps ?? []
    const bulletins   = buls ?? []
    const contrats    = cons ?? []
    const presences   = abs ?? []
    const recrutements = recrut ?? []

    const effectifActif = employees.filter(e => e.statut === 'actif').length
    const effectifTotal = employees.length
    const nbConges      = employees.filter(e => e.statut === 'conge').length

    const _payrollRH    = computePayrollSummary(bulletins.filter(b => b.statut === 'payee'), year)
    const masseSalMois  = _payrollRH.mensuel[now.getMonth()].net
    const masseSalAnnee = _payrollRH.net || employees.filter(e => e.statut === 'actif').reduce((s, e) => s + (e.salaire_base ?? 0), 0) * 12

    const nbRecrutements = recrutements.filter(r => r.statut === 'embauche').length
    const nbDemissions   = recrutements.filter(r => r.statut === 'demission').length

    const presTotal  = presences.length
    const presAbsent = presences.filter(p => p.statut === 'absent').length
    const tauxPresence = presTotal > 0 ? Math.round(((presTotal - presAbsent) / presTotal) * 100) : 100

    const contratsExpirant30 = contrats.filter(c => {
      if (!c.date_fin) return false
      const diff = (new Date(c.date_fin).getTime() - Date.now()) / 86_400_000
      return diff >= 0 && diff <= 30
    }).length

    const nbAbsencesTotal = presAbsent

    const kpis: RhKpis = {
      effectifActif, effectifTotal, nbConges, masseSalMois, masseSalAnnee,
      nbRecrutements, nbDemissions, tauxPresence, contratsExpirant30, nbAbsencesTotal,
    }

    const masseSalMensuelle = _payrollRH.mensuel.map(m => ({ month: m.month, masse: m.net }))

    const absencesParMois = monthKeys.map(mk => {
      const mo = mk.slice(0, 7)
      const count = presences.filter(p => p.statut === 'absent' && p.date?.startsWith(mo)).length
      return { month: new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' }), absences: count }
    })

    return NextResponse.json({
      module: 'rh', year, kpis,
      charts: { masseSalMensuelle, absencesParMois },
      alerts: buildRhAlerts(kpis),
      lastUpdated,
    })
  }

  // ── École ─────────────────────────────────────────────────────────────────
  if (moduleKey === 'ecole') {
    const [
      { data: eleves },
      { data: paies },
      { data: absences },
    ] = await Promise.all([
      supabaseAdmin.from('etudiants').select('id,statut,created_at').eq('tenant_id', tid),
      supabaseAdmin.from('paiements_scolaires').select('montant,date_paiement,etudiant_id,statut').eq('tenant_id', tid).gte('date_paiement', yearStart).lte('date_paiement', yearEnd),
      supabaseAdmin.from('absences_etudiants').select('id,date_absence').eq('tenant_id', tid).gte('date_absence', yearStart).lte('date_absence', yearEnd),
    ])

    const elevs  = eleves ?? []
    const pais   = paies ?? []
    const abs    = absences ?? []

    const nbEleves = elevs.filter(e => e.statut === 'actif').length
    const nbElevesMois = elevs.filter(e => e.created_at?.startsWith(monthStart.slice(0, 7))).length

    const scolAnnee = pais.reduce((s, p) => s + p.montant, 0)
    const scolMois  = pais.filter(p => p.date_paiement?.startsWith(monthStart.slice(0, 7))).reduce((s, p) => s + p.montant, 0)

    const paidIds = new Set(pais.map(p => p.etudiant_id))
    const nbImpayesFamilles = nbEleves > 0 ? Math.max(0, nbEleves - paidIds.size) : 0
    const txPaiement = nbEleves > 0 ? Math.round((paidIds.size / nbEleves) * 100) : 0

    const allFamilyDebt = scolAnnee > 0
      ? Math.max(0, (nbImpayesFamilles * (scolAnnee / (paidIds.size || 1))))
      : 0

    const kpis: EcoleKpis = {
      nbEleves, nbElevesMois, scolAnnee, scolMois,
      nbImpayesFamilles, montantImpayes: allFamilyDebt,
      txPaiement, nbAbsences: abs.length, nbClassements: 0,
    }

    const scolParMois = monthKeys.map(mk => {
      const mo = mk.slice(0, 7)
      const val = pais.filter(p => p.date_paiement?.startsWith(mo)).reduce((s, p) => s + p.montant, 0)
      return { month: new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' }), montant: val }
    })

    const absencesParMois = monthKeys.map(mk => {
      const mo = mk.slice(0, 7)
      const count = abs.filter(a => a.date_absence?.startsWith(mo)).length
      return { month: new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' }), absences: count }
    })

    const paiementsStatus = [
      { name: 'À jour',     value: paidIds.size,          color: '#16A34A' },
      { name: 'Impayés',    value: nbImpayesFamilles,      color: '#DC2626' },
    ].filter(s => s.value > 0)

    return NextResponse.json({
      module: 'ecole', year, kpis,
      charts: { scolParMois, absencesParMois, paiementsStatus },
      alerts: buildEcoleAlerts(kpis),
      lastUpdated,
    })
  }

  // ── Hôtel ──────────────────────────────────────────────────────────────────
  if (moduleKey === 'hotel') {
    const [{ data: chambres }, { data: reservations }] = await Promise.all([
      supabaseAdmin.from('chambres').select('id,statut,prix_nuit').eq('tenant_id', tid),
      supabaseAdmin.from('reservations').select('montant_total,statut,date_debut,date_fin').eq('tenant_id', tid).gte('date_debut', yearStart),
    ])

    const chbs = chambres ?? []
    const ress = reservations ?? []

    const nbChambres       = chbs.length
    const chambresOccupees = chbs.filter(c => c.statut === 'occupee').length
    const tauxOccupation   = nbChambres > 0 ? Math.round((chambresOccupees / nbChambres) * 100) : 0
    const revenuAnnee      = ress.filter(r => r.statut === 'termine' || r.statut === 'confirmee').reduce((s, r) => s + (r.montant_total ?? 0), 0)
    const revenuMois       = ress.filter(r => r.date_debut?.startsWith(monthStart.slice(0, 7))).reduce((s, r) => s + (r.montant_total ?? 0), 0)
    const nbReservations   = ress.length
    const revParChambre    = nbChambres > 0 ? Math.round(revenuAnnee / nbChambres) : 0

    const kpis: HotelKpis = { nbChambres, chambresOccupees, tauxOccupation, revenuAnnee, revenuMois, nbReservations, revParChambre }

    return NextResponse.json({
      module: 'hotel', year, kpis,
      alerts: buildHotelAlerts(kpis),
      lastUpdated,
    })
  }

  // ── Restaurant ─────────────────────────────────────────────────────────────
  if (moduleKey === 'resto') {
    const [{ data: commandes }] = await Promise.all([
      supabaseAdmin.from('commandes_resto').select('total,statut,created_at').eq('tenant_id', tid).gte('created_at', yearStart).lte('created_at', yearEnd),
    ])

    const cmds = commandes ?? []
    const terminees = cmds.filter(c => c.statut === 'termine' || c.statut === 'servi')

    const ventesTotales = terminees.reduce((s, c) => s + (c.total ?? 0), 0)
    const ventesMois    = terminees.filter(c => c.created_at?.startsWith(monthStart.slice(0, 7))).reduce((s, c) => s + (c.total ?? 0), 0)
    const nbCommandes   = terminees.length
    const ticketMoyen   = nbCommandes > 0 ? Math.round(ventesTotales / nbCommandes) : 0

    const kpis: RestoKpis = { ventesTotales, ventesMois, nbCommandes, ticketMoyen, topPlat: '—', heureFort: '—' }

    return NextResponse.json({ module: 'resto', year, kpis, alerts: [], lastUpdated })
  }

  return NextResponse.json({ error: 'Module inconnu' }, { status: 400 })
}
