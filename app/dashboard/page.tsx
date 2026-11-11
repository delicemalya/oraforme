import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { normalizeSecteur } from '@/lib/erp-sectors'

// Values are i18n keys — resolved client-side in ModuleChart
const MODULE_LABELS: Record<string, string> = {
  facturation:  'nav.facturation',  tresorerie:   'nav.tresorerie',
  comptabilite: 'nav.comptabilite', mobilemoney:  'nav.mobilemoney',
  stock:        'nav.stock',        rh:           'nav.rh',
  ecole:        'nav.ecole',        achats:       'nav.achats',
  depenses:     'nav.depenses',     rapports:     'nav.rapports',
  hotel:        'nav.hotel',        bizbot:       'nav.bizbot',
}

const MODULE_COLORS = [
  '#F59E0B', '#2563EB', '#16A34A', '#DC2626',
  '#8B5CF6', '#0891B2', '#EA580C', '#D97706', '#059669', '#7C3AED',
]

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Profil + tenant + rôle dynamique ─────────────────────────────────────
  // CRITICAL FIX (multi-tenant isolation): same as TenantContext — order by
  // created_at so the primary (oldest) profile wins when a user belongs to
  // multiple tenants. Prevents "wrong company on refresh" regression.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(nom_entreprise, plan, secteur_activite), dynamic_role_id, ecole_role_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile || !profile.tenant_id) redirect('/onboarding')

  const tenant = profile.tenants as {
    nom_entreprise: string
    plan: string; secteur_activite: string | null
  } | null

  const firstName  = (profile as { prenom?: string | null }).prenom ?? null
  const lastName   = (profile as { nom?: string | null }).nom ?? null
  const userName   = firstName ? [firstName, lastName].filter(Boolean).join(" ") : null
  const tid        = profile.tenant_id
  const secteur   = normalizeSecteur(tenant?.secteur_activite)
  const ecoleRole = (profile as { ecole_role_name?: string | null }).ecole_role_name ?? null

  // Sector-specific dashboards — redirect to dedicated experience
  if (secteur === 'ecole')     redirect('/dashboard/ecole')
  if (secteur === 'sante')     redirect('/dashboard/sante')

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
    .limit(200)

  // tenant_modules est la seule source de vérité — pas de fallback vers modules_actifs
  const modulesActifs: string[] = (tmRows ?? []).map((r: { module_key: string }) => r.module_key)

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
        .gte('created_at', startOfMonth.toISOString()).limit(200),
      supabase.from('factures').select('id, client_nom, total, statut, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(10),
      supabase.from('factures').select('created_at, total').eq('tenant_id', tid)
        .gte('created_at', sevenDaysAgo.toISOString()).limit(200),
      supabase.from('factures').select('statut').eq('tenant_id', tid).limit(200),
    ])

    nbPending     = pendingRes.count ?? 0
    pendingAmount = pendingRes.data?.reduce((s, f) => s + (f.total ?? 0), 0) ?? 0
    revenuMois    = revenuRes.data?.reduce((s, f) => s + (f.total ?? 0), 0) ?? 0
    recentActivity = (recentRes.data ?? []).map(f => ({
      id: f.id, client_nom: f.client_nom ?? 'Client',
      total: f.total ?? 0, statut: f.statut, created_at: f.created_at,
    }))

    daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dayStr = d.toISOString().split('T')[0]
      const items = activityRes.data?.filter(f => f.created_at.startsWith(dayStr)) ?? []
      return { day: String(d.getDay()), montant: items.reduce((s, f) => s + (f.total ?? 0), 0), count: items.length }
    })

    const counts = { brouillon: 0, envoyee: 0, payee: 0, annulee: 0 }
    statusRes.data?.forEach(f => { if (f.statut in counts) counts[f.statut as keyof typeof counts]++ })
    const totalInvoices = Object.values(counts).reduce((s, v) => s + v, 0)
    moduleBreakdown = totalInvoices > 0
      ? ([
          { name: 'Payées',     statut: 'payee',    value: counts.payee,    color: '#16A34A' },
          { name: 'Envoyées',   statut: 'envoyee',  value: counts.envoyee,  color: '#2563EB' },
          { name: 'Brouillons', statut: 'brouillon',value: counts.brouillon,color: '#64748B' },
          { name: 'Annulées',   statut: 'annulee',  value: counts.annulee,  color: '#DC2626' },
        ] as { name: string; statut: string; value: number; color: string }[]).filter(d => d.value > 0)
      : modulesActifs.map((m, i) => ({ name: MODULE_LABELS[m] ?? m, value: 1, color: MODULE_COLORS[i % MODULE_COLORS.length] }))

    nbAlertes = nbPending
  } else {
    // Pour les non-financiers : graphe vide avec modules
    daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return { day: String(d.getDay()), montant: 0, count: 0 }
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

  // Les KPIs école ne sont jamais calculés ici : un tenant école est redirigé
  // vers /dashboard/ecole plus haut (code mort retiré lors de la refonte 2026-11).
  const ecoleKpis = null
  const daacKpis = null
  const rhKpis = null
  const ecoleFinancials = null

  return (
    <DashboardClient
      userName={userName ?? undefined}
      data={{
        tenant: {
          nom_entreprise: tenant?.nom_entreprise ?? 'Votre entreprise',
          modulesActifs:  modulesActifs,
          plan:           tenant?.plan ?? 'starter',
        },
        tenantId: tid,
        kpis:          { revenuMois, nbEmployes, nbArticles, nbAlertes },
        alerts:        { pendingCount: nbPending, pendingAmount, lowStockCount: nbStockZero },
        recentActivity,
        chartData:     { daily, moduleBreakdown },
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
