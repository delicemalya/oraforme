import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

// GET /api/analytics/summary?year=2026&months=6
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id, role, ecole_role_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const tid = profile.tenant_id
  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const months = Math.min(parseInt(url.searchParams.get('months') ?? '12'), 12)

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // Build monthly date array
  const monthKeys: string[] = []
  for (let m = 1; m <= months; m++) {
    monthKeys.push(`${year}-${String(m).padStart(2, '0')}`)
  }

  const [
    txRes,
    facRes,
    empRes,
    bpRes,
    absRes,
    stRes,
    psRes,
    coRes,
    notifRes,
    taskRes,
  ] = await Promise.all([
    supabaseAdmin.from('transactions').select('montant,type,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
    supabaseAdmin.from('factures').select('total,montant_ht,statut,date').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
    supabaseAdmin.from('employes').select('statut,salaire_base,departement_id').eq('tenant_id', tid),
    supabaseAdmin.from('bulletins_paie').select('net,statut,periode_mois').eq('tenant_id', tid),
    supabaseAdmin.from('absences_etudiants').select('id,date_absence').eq('tenant_id', tid).gte('date_absence', yearStart).lte('date_absence', yearEnd),
    supabaseAdmin.from('stock_articles').select('nom,quantite,quantite_min,prix_unitaire').eq('tenant_id', tid),
    supabaseAdmin.from('paiements_scolaires').select('montant,date_paiement').eq('tenant_id', tid).gte('date_paiement', yearStart).lte('date_paiement', yearEnd),
    supabaseAdmin.from('contrats_employes').select('statut,date_fin').eq('tenant_id', tid).eq('statut', 'actif'),
    supabaseAdmin.from('notifications').select('id,read,created_at').eq('tenant_id', tid).gte('created_at', yearStart).lte('created_at', yearEnd),
    supabaseAdmin.from('scheduled_tasks').select('status,task_type,created_at').eq('tenant_id', tid).gte('created_at', yearStart).lte('created_at', yearEnd),
  ])

  const transactions = txRes.data ?? []
  const factures     = facRes.data ?? []
  const employes     = empRes.data ?? []
  const bulletins    = bpRes.data ?? []
  const absences     = absRes.data ?? []
  const articles     = stRes.data ?? []
  const paiements    = psRes.data ?? []
  const contrats     = coRes.data ?? []
  const notifications = notifRes.data ?? []
  const tasks        = taskRes.data ?? []

  // ── Monthly revenue & expense trend ──────────────────────────
  const monthlyTrend = monthKeys.map(mk => {
    const mo = mk.slice(0, 7)
    const entrees  = transactions.filter(t => t.type === 'entree' && t.date?.startsWith(mo)).reduce((s, t) => s + t.montant, 0)
    const sorties  = transactions.filter(t => t.type === 'sortie' && t.date?.startsWith(mo)).reduce((s, t) => s + t.montant, 0)
    const facPay   = factures.filter(f => f.statut === 'payee' && f.date?.startsWith(mo)).reduce((s, f) => s + (f.montant_ht ?? 0), 0)
    const scol     = paiements.filter(p => p.date_paiement?.startsWith(mo)).reduce((s, p) => s + p.montant, 0)
    const label    = new Date(mo + '-01').toLocaleDateString('fr-FR', { month: 'short' })
    return { month: label, entrees, sorties, facturation: facPay, scolarite: scol }
  })

  // ── Financial summary ─────────────────────────────────────────
  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const totalFactures = factures.reduce((s, f) => s + (f.total ?? 0), 0)
  const totalFactPay  = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalCreances = factures.filter(f => !['payee','annulee'].includes(f.statut ?? '')).reduce((s, f) => s + (f.total ?? 0), 0)
  const totalScol     = paiements.reduce((s, p) => s + p.montant, 0)
  const txPaiement    = factures.length > 0 ? Math.round((factures.filter(f => f.statut === 'payee').length / factures.length) * 100) : 0

  // ── HR summary ────────────────────────────────────────────────
  const nbActifs   = employes.filter(e => e.statut === 'actif').length
  const nbConges   = employes.filter(e => e.statut === 'conge').length
  const masseSal   = bulletins.filter(b => b.statut === 'payee').reduce((s, b) => s + b.net, 0)
    || employes.filter(e => e.statut === 'actif').reduce((s, e) => s + (e.salaire_base ?? 0), 0)

  const contratsExpirant30 = contrats.filter(c => {
    if (!c.date_fin) return false
    const d = new Date(c.date_fin)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }).length

  // Payroll trend by month
  const masseSalMensuelle = monthKeys.map(mk => {
    const mo = mk.slice(0, 7)
    const val = bulletins.filter(b => b.periode_mois?.startsWith(mo)).reduce((s, b) => s + b.net, 0)
    const label = new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' })
    return { month: label, masse: val }
  })

  // ── Academic summary ──────────────────────────────────────────
  const nbAbsences    = absences.length
  const absParMois    = monthKeys.map(mk => {
    const mo = mk.slice(0, 7)
    const count = absences.filter(a => a.date_absence?.startsWith(mo)).length
    const label = new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' })
    return { month: label, absences: count }
  })
  const scolParMois   = monthKeys.map(mk => {
    const mo = mk.slice(0, 7)
    const val = paiements.filter(p => p.date_paiement?.startsWith(mo)).reduce((s, p) => s + p.montant, 0)
    const label = new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'short' })
    return { month: label, montant: val }
  })

  // ── Stock summary ─────────────────────────────────────────────
  const articlesRupture = articles.filter(a => a.quantite <= 0).length
  const articlesCritiques = articles.filter(a => a.quantite > 0 && a.quantite < (a.quantite_min ?? 5)).length
  const valeurStock = articles.reduce((s, a) => s + (a.quantite * (a.prix_unitaire ?? 0)), 0)

  // Top 5 articles en stock value
  const topArticles = [...articles]
    .sort((a, b) => (b.quantite * (b.prix_unitaire ?? 0)) - (a.quantite * (a.prix_unitaire ?? 0)))
    .slice(0, 5)
    .map(a => ({ nom: a.nom, valeur: a.quantite * (a.prix_unitaire ?? 0), quantite: a.quantite }))

  // ── Automation stats ──────────────────────────────────────────
  const tasksDone  = tasks.filter(t => t.status === 'done').length
  const tasksPend  = tasks.filter(t => t.status === 'pending').length
  const tasksError = tasks.filter(t => t.status === 'error').length
  const notifUnread = notifications.filter(n => !n.read).length

  // Factures by status donut
  const facturesByStatus = [
    { name: 'Payées',    value: factures.filter(f => f.statut === 'payee').length,    color: '#16A34A' },
    { name: 'En attente', value: factures.filter(f => f.statut === 'envoyee').length, color: '#DC2626' },
    { name: 'Brouillon',  value: factures.filter(f => f.statut === 'brouillon').length,color: '#64748B' },
    { name: 'Annulées',   value: factures.filter(f => f.statut === 'annulee').length, color: '#F85149' },
  ].filter(s => s.value > 0)

  return NextResponse.json({
    year,
    // Financial
    financial: {
      totalEntrees, totalSorties, soldeTresorerie: totalEntrees - totalSorties,
      totalFactures, totalFactPay, totalCreances, totalScol, txPaiement,
      nbFactures: factures.length, nbFactPay: factures.filter(f => f.statut === 'payee').length,
    },
    // HR
    rh: { nbActifs, nbConges, nbTotal: employes.length, masseSal, contratsExpirant30 },
    // Academic
    ecole: { nbAbsences, totalScol },
    // Stock
    stock: { articlesRupture, articlesCritiques, valeurStock, nbArticles: articles.length, topArticles },
    // Automation
    automation: { tasksDone, tasksPend, tasksError, notifUnread, nbNotifs: notifications.length },
    // Charts
    charts: {
      monthlyTrend,
      masseSalMensuelle,
      absParMois,
      scolParMois,
      facturesByStatus,
    },
  })
}
