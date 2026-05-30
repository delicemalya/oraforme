import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { buildDgAlerts } from '@/lib/analytics/alerts-engine'
import { growthPct } from '@/lib/analytics/formatters'
import type { DgInsights } from '@/lib/analytics/types'
import BiDgClient from './BiDgClient'

export const dynamic = 'force-dynamic'

export default async function BiDgPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profile?.tenant_id) redirect('/login')

  const tid = profile.tenant_id
  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const monthKeys: string[] = []
  for (let m = 1; m <= 12; m++) monthKeys.push(`${year}-${String(m).padStart(2, '0')}`)

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
    supabaseAdmin.from('factures').select('montant_ttc,statut,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
    supabaseAdmin.from('employes').select('statut,salaire_base').eq('tenant_id', tid),
    supabaseAdmin.from('bulletins_paie').select('net,statut').eq('tenant_id', tid).gte('created_at', yearStart).lte('created_at', yearEnd),
    supabaseAdmin.from('contrats_employes').select('date_fin').eq('tenant_id', tid).eq('statut', 'actif'),
    supabaseAdmin.from('comptes_bancaires').select('solde').eq('tenant_id', tid).eq('actif', true),
    supabaseAdmin.from('caisses').select('solde').eq('tenant_id', tid).eq('actif', true),
    supabaseAdmin.from('mobile_money_wallets').select('solde').eq('tenant_id', tid).eq('actif', true),
  ])

  const tx  = txAll ?? []
  const txM = txMois ?? []
  const txP = txPrev ?? []
  const facs = factures ?? []
  const emps = employes ?? []
  const buls = bulletins ?? []
  const cons = contrats ?? []

  const caAnnee    = tx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const depAnnee   = tx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const caMois     = txM.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const depMois    = txM.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const caPrevMois  = txP.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const depPrevMois = txP.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const resultatNet = caAnnee - depAnnee
  const margeNetPct = caAnnee > 0 ? Math.round((resultatNet / caAnnee) * 100) : 0

  const tresoB = (comptesBanque ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)
  const tresoC = (caisses ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)
  const tresoW = (wallets ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)
  const tresoTotale = tresoB + tresoC + tresoW

  const facsOuvertes = facs.filter(f => !['payee', 'annulee'].includes(f.statut ?? ''))
  const creancesClients = facsOuvertes.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const nbFacturesOuvertes = facsOuvertes.length
  const nbFacturesRetard   = facs.filter(f => f.statut === 'en_retard' || f.statut === 'envoyee').length

  const salairesAnnee = buls.filter(b => b.statut === 'payee').reduce((s, b) => s + b.net, 0)
    || emps.filter(e => e.statut === 'actif').reduce((s, e) => s + (e.salaire_base ?? 0), 0) * 12

  const effectifActif = emps.filter(e => e.statut === 'actif').length
  const effectifTotal = emps.length

  const contratsExpirant30 = cons.filter(c => {
    if (!c.date_fin) return false
    const diff = (new Date(c.date_fin).getTime() - Date.now()) / 86_400_000
    return diff >= 0 && diff <= 30
  }).length

  const kpis = {
    caAnnee, caMois, caPrevMois, depAnnee, depMois, depPrevMois,
    resultatNet, margeNetPct, tresoTotale, creancesClients,
    nbFacturesOuvertes, nbFacturesRetard, salairesAnnee,
    effectifActif, effectifTotal, contratsExpirant30,
  }

  const monthlyTrend = monthKeys.map(mk => {
    const mo = mk.slice(0, 7)
    const entrees = tx.filter(t => t.type === 'entree' && t.date?.startsWith(mo)).reduce((s, t) => s + t.montant, 0)
    const sorties = tx.filter(t => t.type === 'sortie' && t.date?.startsWith(mo)).reduce((s, t) => s + t.montant, 0)
    return { month: new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' }), entrees, sorties, net: entrees - sorties }
  })

  const revenueBySource = [
    { name: 'Facturation', value: facs.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ttc ?? 0), 0), color: '#DC2626' },
    { name: 'Trésorerie',  value: caAnnee, color: '#0F172A' },
  ].filter(s => s.value > 0)

  const initial: DgInsights = {
    kpis,
    charts: { monthlyTrend, revenueBySource },
    alerts: buildDgAlerts(kpis),
    lastUpdated: new Date().toISOString(),
  }

  return <BiDgClient initial={initial} year={year} />
}
