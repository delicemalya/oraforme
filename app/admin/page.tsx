import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'
import { ModuleRevenueChart, GrowthChart } from '@/components/admin/AdminChartsClient'
import AdminClientsTable from '@/components/admin/AdminClientsTable'
import { Building2, DollarSign, Package, Users, TrendingUp, ShieldAlert } from 'lucide-react'

export default async function AdminPage() {
  // ── Fetch all tenants ──
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, nom_entreprise, plan, modules_actifs, created_at')
    .order('created_at', { ascending: false })

  const tenantIds = (tenants ?? []).map(t => t.id)

  // ── Fetch profiles, factures per tenant ──
  const [profilesRes, facturesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, tenant_id'),
    supabaseAdmin.from('factures').select('id, tenant_id, total, statut, created_at'),
  ])

  const profiles = profilesRes.data ?? []
  const factures = facturesRes.data ?? []

  // ── KPI globals ──
  const nbClients = tenants?.length ?? 0
  const nbUsers   = profiles.length
  const totalCA   = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalModulesSold = (tenants ?? []).reduce((s, t) => s + (t.modules_actifs?.length ?? 0), 0)

  // New clients this month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const newClientsThisMonth = (tenants ?? []).filter(t => t.created_at >= startOfMonth).length

  // ── Module revenue data (MRR) ──
  const moduleRevData = Object.entries(MODULE_PRICES).map(([id, price]) => {
    const clientsWithModule = (tenants ?? []).filter(t => t.modules_actifs?.includes(id)).length
    return {
      module: (MODULE_LABELS[id] ?? id).split(' ')[0], // Short label for chart
      clients: clientsWithModule,
      mrr: clientsWithModule * price,
    }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMRR = moduleRevData.reduce((s, m) => s + m.mrr, 0)

  // ── Growth chart: last 30 days ──
  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const growthData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    d.setHours(0, 0, 0, 0)
    const dayStr = d.toISOString().split('T')[0]
    const inscriptions = (tenants ?? []).filter(t => t.created_at.startsWith(dayStr)).length
    return {
      date: i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '',
      inscriptions,
    }
  })

  // ── Build tenant rows with aggregated data ──
  const tenantRows = (tenants ?? []).map(t => {
    const nbU = profiles.filter(p => p.tenant_id === t.id).length
    const tFactures = factures.filter(f => f.tenant_id === t.id)
    const ca = tFactures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
    return {
      id: t.id,
      nom_entreprise: t.nom_entreprise,
      plan: t.plan,
      modules_actifs: t.modules_actifs ?? [],
      nb_users: nbU,
      nb_factures: tFactures.length,
      ca_genere: ca,
      created_at: t.created_at,
    }
  })

  function KpiCard({ icon: Icon, label, value, sub, color }: {
    icon: React.ElementType; label: string; value: string; sub?: string; color: string
  }) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{label}</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
            <Icon size={15} style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-bold text-[var(--text)] mb-1">{value}</p>
        {sub && <p className="text-xs text-[var(--text-secondary)]">{sub}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
          <ShieldAlert size={18} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Vue globale</h1>
          <p className="text-xs text-[var(--text-secondary)]">Tableau de bord oraforme — données en temps réel</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2} label="Clients actifs" color="#2563EB"
          value={nbClients.toString()}
          sub={newClientsThisMonth > 0 ? `+${newClientsThisMonth} ce mois` : 'Aucun nouveau ce mois'}
        />
        <KpiCard
          icon={DollarSign} label="MRR plateforme" color="#16A34A"
          value={fmtFCFA(totalMRR)}
          sub={`CA total généré: ${fmtFCFA(totalCA)}`}
        />
        <KpiCard
          icon={Package} label="Modules vendus" color="#F59E0B"
          value={totalModulesSold.toString()}
          sub={`Top: ${moduleRevData[0]?.module ?? '—'}`}
        />
        <KpiCard
          icon={Users} label="Utilisateurs" color="#8B5CF6"
          value={nbUsers.toString()}
          sub={`${nbClients > 0 ? (nbUsers / nbClients).toFixed(1) : 0} user/client`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Module revenue bar chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Revenus par module (MRR)</h2>
            <span className="text-xs text-[var(--success)] font-bold">{fmtFCFA(totalMRR)}/mois</span>
          </div>
          <ModuleRevenueChart data={moduleRevData} />
        </div>

        {/* Growth line chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Croissance clients (30 jours)</h2>
            <span className="text-xs text-[var(--text-secondary)]">{nbClients} total</span>
          </div>
          <GrowthChart data={growthData} />
        </div>
      </div>

      {/* Module breakdown detail */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Détail revenus par module</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {moduleRevData.map(m => (
            <div key={m.module} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-secondary)] truncate mb-1">{m.module}</p>
              <p className="text-sm font-bold text-[var(--text)]">{m.clients} client{m.clients > 1 ? 's' : ''}</p>
              <p className="text-xs text-[var(--primary)] font-medium mt-0.5">{fmtFCFA(m.mrr)}/mois</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clients table */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Tous les clients</h2>
        <AdminClientsTable tenants={tenantRows} />
      </div>

    </div>
  )
}
