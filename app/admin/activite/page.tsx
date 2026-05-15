import { supabaseAdmin } from '@/lib/supabase-server'
import { fmtFCFA } from '@/lib/admin-config'
import { Activity, TrendingDown, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

const TYPE_STYLE = {
  entree: { label: 'Entrée', color: '#2EA043', bg: '#2EA04310', border: '#2EA04330', icon: ArrowUpRight },
  sortie: { label: 'Sortie', color: '#F85149', bg: '#F8514910', border: '#F8514930', icon: ArrowDownRight },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'à l'instant'
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days < 7)   return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function riskLevel(lastDate: string | undefined): 'ok' | 'warn' | 'danger' {
  if (!lastDate) return 'danger'
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
  if (days <= 7)  return 'ok'
  if (days <= 21) return 'warn'
  return 'danger'
}

export default async function AdminActivitePage() {
  const now = new Date()
  const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfWeek = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  // ── Fetch data in parallel ─────────────────────────────────────────────
  const [tenantsRes, recentTxRes, txActivityRes, todayTxRes, weekTxRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, nom_entreprise, plan, modules_actifs')
      .order('nom_entreprise'),
    // Last 40 transactions — the live activity feed
    supabaseAdmin
      .from('transactions')
      .select('id, tenant_id, type, categorie, description, montant, date, mode_paiement, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
    // 300 latest transactions to compute "last activity per tenant"
    supabaseAdmin
      .from('transactions')
      .select('tenant_id, created_at, type')
      .order('created_at', { ascending: false })
      .limit(300),
    // Today's totals
    supabaseAdmin
      .from('transactions')
      .select('id, type, montant')
      .gte('created_at', startOfDay),
    // This week's totals
    supabaseAdmin
      .from('transactions')
      .select('id, type, montant')
      .gte('created_at', startOfWeek),
  ])

  const tenants    = tenantsRes.data   ?? []
  const recentTx   = recentTxRes.data  ?? []
  const txActivity = txActivityRes.data ?? []
  const todayTx    = todayTxRes.data   ?? []
  const weekTx     = weekTxRes.data    ?? []

  // ── Build tenant map ───────────────────────────────────────────────────
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t]))

  // ── Last activity per tenant (first occurrence = max in DESC order) ────
  const lastActivity: Record<string, string> = {}
  const txCountPerTenant: Record<string, number> = {}
  txActivity.forEach(tx => {
    if (!lastActivity[tx.tenant_id]) lastActivity[tx.tenant_id] = tx.created_at
    txCountPerTenant[tx.tenant_id] = (txCountPerTenant[tx.tenant_id] ?? 0) + 1
  })

  // ── KPIs ───────────────────────────────────────────────────────────────
  const todayIn  = todayTx.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
  const todayOut = todayTx.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)
  const weekCount = weekTx.length

  const inactiveCount = tenants.filter(t => riskLevel(lastActivity[t.id]) === 'danger').length
  const warnCount     = tenants.filter(t => riskLevel(lastActivity[t.id]) === 'warn').length

  // Most active tenant (most transactions in the 300 sample)
  const mostActiveTenantId = Object.entries(txCountPerTenant).sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostActiveTenant   = mostActiveTenantId ? tenantMap[mostActiveTenantId]?.nom_entreprise : '—'

  // ── Tenant rows for the health table ──────────────────────────────────
  const tenantRows = tenants.map(t => ({
    ...t,
    lastDate:  lastActivity[t.id],
    txCount:   txCountPerTenant[t.id] ?? 0,
    risk:      riskLevel(lastActivity[t.id]),
  })).sort((a, b) => {
    // Sort: active first, then warn, then inactive, then by last date
    const order = { ok: 0, warn: 1, danger: 2 }
    if (order[a.risk] !== order[b.risk]) return order[a.risk] - order[b.risk]
    const da = a.lastDate ? new Date(a.lastDate).getTime() : 0
    const db = b.lastDate ? new Date(b.lastDate).getTime() : 0
    return db - da
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#388BFD]/10 border border-[#388BFD]/20 flex items-center justify-center">
          <Activity size={18} className="text-[#388BFD]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Activité en temps réel</h1>
          <p className="text-xs text-[#484F58]">Vue opérateur — toutes les entreprises abonnées</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider mb-3">Entrées aujourd'hui</p>
          <p className="text-2xl font-bold text-[#2EA043]">{fmtFCFA(todayIn)}</p>
          <p className="text-xs text-[#484F58] mt-1">{todayTx.filter(t => t.type === 'entree').length} transactions</p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider mb-3">Sorties aujourd'hui</p>
          <p className="text-2xl font-bold text-[#F85149]">{fmtFCFA(todayOut)}</p>
          <p className="text-xs text-[#484F58] mt-1">{todayTx.filter(t => t.type === 'sortie').length} transactions</p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider mb-3">Activité 7 jours</p>
          <p className="text-2xl font-bold text-[#E6EDF3]">{weekCount}</p>
          <p className="text-xs text-[#484F58] mt-1">transactions toutes entreprises</p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider mb-3">Plus actif</p>
          <p className="text-lg font-bold text-[#F0A30A] truncate">{mostActiveTenant}</p>
          <p className="text-xs text-[#484F58] mt-1">
            {inactiveCount > 0
              ? `⚠ ${inactiveCount} inactif${inactiveCount > 1 ? 's' : ''} +21j`
              : 'Tous actifs ✓'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Activity feed — 3/5 */}
        <div className="lg:col-span-3 bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E6EDF3]">Flux d'activité</h2>
            <span className="text-xs text-[#484F58]">{recentTx.length} dernières opérations</span>
          </div>
          <div className="divide-y divide-[#21262D] max-h-[520px] overflow-y-auto">
            {recentTx.length === 0 && (
              <div className="py-12 text-center text-[#484F58] text-sm">Aucune activité enregistrée</div>
            )}
            {recentTx.map(tx => {
              const style = TYPE_STYLE[tx.type as keyof typeof TYPE_STYLE] ?? TYPE_STYLE.sortie
              const Icon  = style.icon
              const tenant = tenantMap[tx.tenant_id]
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#21262D]/40 transition-colors">
                  {/* Type icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                  >
                    <Icon size={13} style={{ color: style.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#8B949E] truncate max-w-[100px]">
                        {tenant?.nom_entreprise ?? tx.tenant_id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-[#484F58]">·</span>
                      <span className="text-xs text-[#484F58] truncate">{tx.categorie ?? tx.type}</span>
                    </div>
                    <p className="text-sm text-[#E6EDF3] truncate">{tx.description || '—'}</p>
                  </div>

                  {/* Amount + time */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: style.color }}>
                      {tx.type === 'entree' ? '+' : '-'}{fmtFCFA(tx.montant ?? 0)}
                    </p>
                    <p className="text-[10px] text-[#484F58]">{timeAgo(tx.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tenant health — 2/5 */}
        <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E6EDF3]">Santé des clients</h2>
            {(inactiveCount + warnCount) > 0 && (
              <div className="flex items-center gap-1 text-[#F0A30A]">
                <AlertTriangle size={12} />
                <span className="text-xs font-medium">{inactiveCount + warnCount}</span>
              </div>
            )}
          </div>
          <div className="divide-y divide-[#21262D] max-h-[520px] overflow-y-auto">
            {tenantRows.length === 0 && (
              <div className="py-12 text-center text-[#484F58] text-sm">Aucun client</div>
            )}
            {tenantRows.map(t => {
              const RISK = {
                ok:     { color: '#2EA043', icon: CheckCircle2, label: 'Actif' },
                warn:   { color: '#F0A30A', icon: AlertTriangle, label: '+7j sans activité' },
                danger: { color: '#F85149', icon: TrendingDown,  label: t.lastDate ? '+21j inactif' : 'Jamais utilisé' },
              }
              const r = RISK[t.risk]
              const RIcon = r.icon
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#21262D]/40 transition-colors">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: r.color + '15', border: `1px solid ${r.color}30` }}
                  >
                    <RIcon size={13} style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E6EDF3] truncate">{t.nom_entreprise}</p>
                    <p className="text-xs" style={{ color: r.color }}>{r.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#E6EDF3] font-medium">{t.txCount} ops</p>
                    <p className="text-[10px] text-[#484F58]">
                      {t.lastDate ? timeAgo(t.lastDate) : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tenant activity breakdown table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4">Tableau de bord opérateur</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D]">
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Entreprise</th>
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Plan</th>
                <th className="text-right py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Modules</th>
                <th className="text-right py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Opérations</th>
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Dernière activité</th>
                <th className="text-left py-2 px-3 text-xs text-[#484F58] uppercase tracking-wider font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262D]">
              {tenantRows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-[#484F58]">Aucun client</td></tr>
              )}
              {tenantRows.map(t => {
                const RISK_BADGE = {
                  ok:     'text-[#2EA043] bg-[#2EA043]/10 border-[#2EA043]/30',
                  warn:   'text-[#F0A30A] bg-[#F0A30A]/10 border-[#F0A30A]/30',
                  danger: 'text-[#F85149] bg-[#F85149]/10 border-[#F85149]/30',
                }
                const RISK_LABEL = {
                  ok: 'Actif',
                  warn: 'Attention',
                  danger: 'Inactif',
                }
                return (
                  <tr key={t.id} className="hover:bg-[#21262D]/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#E6EDF3] truncate max-w-[160px]">{t.nom_entreprise}</td>
                    <td className="py-2.5 px-3 text-[#8B949E] capitalize">{t.plan ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right text-[#E6EDF3]">{(t.modules_actifs ?? []).length}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-[#E6EDF3]">{t.txCount}</td>
                    <td className="py-2.5 px-3 text-[#8B949E] text-xs">
                      {t.lastDate
                        ? new Date(t.lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Jamais'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RISK_BADGE[t.risk]}`}>
                        {RISK_LABEL[t.risk]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
