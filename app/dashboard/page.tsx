import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

const MODULE_LABELS: Record<string, string> = {
  facturation:  'FacturePro',           tresorerie:   'Trésorerie',
  comptabilite: 'Comptabilité',         mobilemoney:  'Mobile Money',
  stock:        'Stock & Inventaire',   rh:           'RH Premium',
  ecole:        'École & Université',   restaurant:   'Resto POS',
  achats:       'Achats & Fournisseurs',depenses:     'Dépenses',
  rapports:     'Rapports IA',          hotel:        'Hôtel & Hébergement',
  transport:    'Transport VTC',        bizbot:       'MIAA+ Assistant',
}

const MODULE_COLORS = [
  '#F0A30A', '#388BFD', '#2EA043', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F59E0B', '#EF4444', '#84CC16', '#F97316',
]

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Profil + tenant + rôle dynamique ─────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(nom_entreprise, modules_actifs, plan, secteur_activite), dynamic_role_id, ecole_role_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || !profile.tenant_id) redirect('/onboarding')

  const tenant = profile.tenants as {
    nom_entreprise: string; modules_actifs: string[]
    plan: string; secteur_activite: string | null
  } | null

  const tid       = profile.tenant_id
  const secteur   = tenant?.secteur_activite ?? null
  const ecoleRole = (profile as { ecole_role_name?: string | null }).ecole_role_name ?? null

  // ── Résoudre isFinancial depuis le rôle dynamique ─────────────────────────
  // DIRECTION_GENERALE is treated as financial — same full access as owner
  const isDirectionGenerale = ecoleRole === 'DIRECTION_GENERALE'
  let isFinancial = profile.role === 'owner' || isDirectionGenerale

  if (!isFinancial && profile.dynamic_role_id) {
    const { data: roleData } = await supabase
      .from('roles')
      .select('is_financial')
      .eq('id', profile.dynamic_role_id)
      .maybeSingle()
    isFinancial = roleData?.is_financial ?? false
  }


  // ── Modules actifs ────────────────────────────────────────────────────────
  const { data: tmRows } = await supabase
    .from('tenant_modules')
    .select('module_key')
    .eq('tenant_id', tid)
    .eq('enabled', true)

  const modulesActifs: string[] =
    (tmRows && tmRows.length > 0)
      ? tmRows.map((r: { module_key: string }) => r.module_key)
      : (tenant?.modules_actifs ?? [])

  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // ── KPIs financiers (uniquement pour les rôles financiers) ───────────────
  let revenuMois    = 0
  let nbPending     = 0
  let pendingAmount = 0
  let recentActivity: { id: string; client_nom: string; total: number; statut: string; created_at: string }[] = []
  let daily: { day: string; montant: number; count: number }[]  = []
  let moduleBreakdown: { name: string; value: number; color: string }[] = []
  let nbAlertes = 0

  if (isFinancial) {
    const [pendingRes, revenuRes, recentRes, activityRes, statusRes] = await Promise.all([
      supabase.from('factures').select('id, total', { count: 'exact' })
        .eq('tenant_id', tid).in('statut', ['brouillon', 'envoyee']),
      supabase.from('factures').select('total').eq('tenant_id', tid).eq('statut', 'payee')
        .gte('created_at', startOfMonth.toISOString()),
      supabase.from('factures').select('id, client_nom, total, statut, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(10),
      supabase.from('factures').select('created_at, total').eq('tenant_id', tid)
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase.from('factures').select('statut').eq('tenant_id', tid),
    ])

    nbPending     = pendingRes.count ?? 0
    pendingAmount = pendingRes.data?.reduce((s, f) => s + (f.total ?? 0), 0) ?? 0
    revenuMois    = revenuRes.data?.reduce((s, f) => s + (f.total ?? 0), 0) ?? 0
    recentActivity = (recentRes.data ?? []).map(f => ({
      id: f.id, client_nom: f.client_nom ?? 'Client',
      total: f.total ?? 0, statut: f.statut, created_at: f.created_at,
    }))

    const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dayStr = d.toISOString().split('T')[0]
      const items = activityRes.data?.filter(f => f.created_at.startsWith(dayStr)) ?? []
      return { day: DAYS_FR[d.getDay()], montant: items.reduce((s, f) => s + (f.total ?? 0), 0), count: items.length }
    })

    const counts = { brouillon: 0, envoyee: 0, payee: 0, annulee: 0 }
    statusRes.data?.forEach(f => { if (f.statut in counts) counts[f.statut as keyof typeof counts]++ })
    const totalInvoices = Object.values(counts).reduce((s, v) => s + v, 0)
    moduleBreakdown = totalInvoices > 0
      ? ([
          { name: 'Payées',     value: counts.payee,    color: '#2EA043' },
          { name: 'Envoyées',   value: counts.envoyee,  color: '#388BFD' },
          { name: 'Brouillons', value: counts.brouillon,color: '#484F58' },
          { name: 'Annulées',   value: counts.annulee,  color: '#F85149' },
        ] as { name: string; value: number; color: string }[]).filter(d => d.value > 0)
      : modulesActifs.map((m, i) => ({ name: MODULE_LABELS[m] ?? m, value: 1, color: MODULE_COLORS[i % MODULE_COLORS.length] }))

    nbAlertes = nbPending
  } else {
    // Pour les non-financiers : graphe vide avec modules
    const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return { day: DAYS_FR[d.getDay()], montant: 0, count: 0 }
    })
    moduleBreakdown = modulesActifs.map((m, i) => ({
      name: MODULE_LABELS[m] ?? m, value: 1, color: MODULE_COLORS[i % MODULE_COLORS.length],
    }))
  }

  // ── KPIs communs (employés, stock) ────────────────────────────────────────
  const [empRes, stockRes, stockZeroRes] = await Promise.all([
    supabase.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    supabase.from('stock_articles').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    supabase.from('stock_articles').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('quantite', 0),
  ])

  const nbEmployes  = empRes.count  ?? 0
  const nbArticles  = stockRes.count ?? 0
  const nbStockZero = stockZeroRes.count ?? 0
  if (!isFinancial) nbAlertes = nbStockZero > 0 ? 1 : 0
  else nbAlertes += nbStockZero > 0 ? 1 : 0

  // ── KPIs école (données selon rôle) ──────────────────────────────────────
  let ecoleKpis: { nbEtudiants: number; nbActifs: number; nbSuspendus: number; nbAbsences: number } | null = null
  let daacKpis:  { sessionsEnCours: number; diplomesEnAttente: number; nbSoutenances: number } | null = null
  let rhKpis:    { nbActifs: number; nbConges: number } | null = null
  let ecoleFinancials: { revenusMois: number; nbPaiementsMois: number; nbImpayesDossiers: number; montantImpayeTotal: number } | null = null

  if (secteur === 'ecole') {
    const moisCourant = now.getMonth() + 1
    const anneeCourante = now.getFullYear()

    const [etuRes, etuActifRes, etuSusp, absRes, sesRes, dipRes, defRes, empActifRes, empCongeRes] =
      await Promise.all([
        supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
        supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'actif'),
        supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'suspendu'),
        supabase.from('absences_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
        supabase.from('sessions_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'en_cours'),
        supabase.from('diplomas').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'en_attente'),
        supabase.from('defenses').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'planifie'),
        supabase.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'actif'),
        supabase.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'conge'),
      ])
    ecoleKpis = {
      nbEtudiants: etuRes.count     ?? 0,
      nbActifs:    etuActifRes.count ?? 0,
      nbSuspendus: etuSusp.count    ?? 0,
      nbAbsences:  absRes.count     ?? 0,
    }
    daacKpis = {
      sessionsEnCours:   sesRes.count ?? 0,
      diplomesEnAttente: dipRes.count ?? 0,
      nbSoutenances:     defRes.count ?? 0,
    }
    rhKpis = {
      nbActifs: empActifRes.count ?? 0,
      nbConges: empCongeRes.count ?? 0,
    }

    // Données financières scolaires (uniquement pour les rôles financiers)
    if (isFinancial) {
      const [paieRes, impayesRes] = await Promise.all([
        supabase.from('paiements_scolaires').select('montant')
          .eq('tenant_id', tid).eq('mois', moisCourant).eq('annee', anneeCourante),
        supabase.from('paiements_scolaires').select('montant')
          .eq('tenant_id', tid).eq('statut', 'en_attente'),
      ])
      ecoleFinancials = {
        revenusMois:         paieRes.data?.reduce((s, p) => s + Number(p.montant ?? 0), 0) ?? 0,
        nbPaiementsMois:     paieRes.data?.length ?? 0,
        nbImpayesDossiers:   impayesRes.data?.length ?? 0,
        montantImpayeTotal:  impayesRes.data?.reduce((s, p) => s + Number(p.montant ?? 0), 0) ?? 0,
      }
    }
  }

  return (
    <DashboardClient
      data={{
        tenant: {
          nom_entreprise: tenant?.nom_entreprise ?? 'Votre entreprise',
          modules_actifs: modulesActifs,
          plan:           tenant?.plan ?? 'starter',
        },
        kpis:          { revenuMois, nbEmployes, nbArticles, nbAlertes },
        alerts:        { pendingCount: nbPending, pendingAmount, lowStockCount: nbStockZero },
        recentActivity,
        chartData:     { daily, moduleBreakdown },
        // Extensions pour le RBAC
        isFinancial,
        secteur,
        ecoleRole,
        ecoleKpis,
        daacKpis,
        rhKpis,
        ecoleFinancials,
      }}
    />
  )
}
