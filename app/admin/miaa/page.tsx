import { supabaseAdmin } from '@/lib/supabase-server'
import { fmtFCFA } from '@/lib/admin-config'
import { Bot, MessageSquare, Zap, DollarSign, TrendingUp } from 'lucide-react'

// Haiku pricing (per 1M tokens): input $0.80, output $4.00
const HAIKU_INPUT_PRICE_PER_1M = 0.80
const HAIKU_OUTPUT_PRICE_PER_1M = 4.00
const USD_TO_FCFA = 600

export default async function AdminMIAAPage() {
  // Count tenants with bizbot module active
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, nom_entreprise, modules_actifs')

  const allTenants = tenants ?? []
  const tenantsWithMIAA = allTenants.filter(t => (t.modules_actifs ?? []).includes('bizbot'))
  const nbTenantsWithMIAA = tenantsWithMIAA.length

  // Estimated usage metrics (no conversation logging table yet)
  const convPerUserPerDay = 3
  const avgMsgPerConv = 5
  const avgInputTokens = 800
  const avgOutputTokens = 400
  const nbUsersWithMIAA = nbTenantsWithMIAA * 2

  const dailyConversations = nbUsersWithMIAA * convPerUserPerDay
  const monthlyConversations = dailyConversations * 30
  const monthlyMessages = monthlyConversations * avgMsgPerConv

  const monthlyInputTokens  = monthlyMessages * avgInputTokens
  const monthlyOutputTokens = monthlyMessages * avgOutputTokens

  const monthlyCostUSD = (monthlyInputTokens / 1_000_000 * HAIKU_INPUT_PRICE_PER_1M)
                       + (monthlyOutputTokens / 1_000_000 * HAIKU_OUTPUT_PRICE_PER_1M)
  const monthlyCostFCFA = monthlyCostUSD * USD_TO_FCFA

  const mrrMIAA = nbTenantsWithMIAA * 6000
  const margeIA = mrrMIAA - monthlyCostFCFA

  // Simulated daily conversations chart (last 7 days)
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const weekData = DAYS.map(day => ({
    day,
    conversations: Math.round(dailyConversations * (0.7 + Math.random() * 0.6)),
  }))

  // Common question categories (estimated)
  const topCategories = [
    { label: 'Fiscal Congo (TVA, CNSS, IRPP)', pct: 38 },
    { label: 'Facturation & devis', pct: 25 },
    { label: 'RH & paie', pct: 18 },
    { label: 'Gestion stock', pct: 11 },
    { label: 'Autres questions', pct: 8 },
  ]

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#8B0070]/10 border border-[#8B0070]/20 flex items-center justify-center">
          <Bot size={18} className="text-[#8B0070]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">MIAA+ Stats</h1>
          <p className="text-xs text-[#484F58]">
            {nbTenantsWithMIAA} client{nbTenantsWithMIAA > 1 ? 's' : ''} avec MIAA+ actif · Claude Haiku 4.5
          </p>
        </div>
      </div>

      {/* Note about estimations */}
      <div className="bg-[#8B0070]/5 border border-[#8B0070]/20 rounded-xl p-4 text-xs text-[#8B949E]">
        <span className="text-[#8B0070] font-medium">Note : </span>
        Les métriques de conversations sont des estimations basées sur les moyennes d&apos;usage.
        Pour des statistiques réelles, ajoute une table <code className="bg-[#1a2d50] px-1 py-0.5 rounded">miaa_conversations</code> pour logger les échanges.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Bot,           label: 'Clients actifs',     value: nbTenantsWithMIAA.toString(),             color: '#8B0070', sub: 'module bizbot actif' },
          { icon: MessageSquare, label: 'Convs/mois (est.)',  value: monthlyConversations.toLocaleString('fr'), color: '#F08900', sub: `${dailyConversations} /jour` },
          { icon: Zap,           label: 'Tokens/mois (est.)', value: `${Math.round((monthlyInputTokens + monthlyOutputTokens) / 1_000_000)}M`, color: '#F08900', sub: 'Claude Haiku 4.5' },
          { icon: DollarSign,    label: 'Coût API/mois',      value: `$${monthlyCostUSD.toFixed(2)}`,          color: '#F51E33', sub: fmtFCFA(monthlyCostFCFA) },
        ].map(k => (
          <div key={k.label} className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider">{k.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.color + '20' }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#FFFFFF]">{k.value}</p>
            <p className="text-xs text-[#484F58] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Financial analysis */}
        <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#8B0070]" />
            Analyse financière MIAA+
          </h2>
          <div className="space-y-3">
            {[
              { label: 'MRR MIAA+', value: fmtFCFA(mrrMIAA), color: '#2EA043', note: `${nbTenantsWithMIAA} × 6 000 FCFA` },
              { label: 'Coût API estimé', value: fmtFCFA(monthlyCostFCFA), color: '#F51E33', note: `$${monthlyCostUSD.toFixed(2)} × 600 FCFA/$` },
              { label: 'Marge brute', value: fmtFCFA(Math.max(margeIA, 0)), color: margeIA >= 0 ? '#2EA043' : '#F51E33', note: `${mrrMIAA > 0 ? Math.round((margeIA / mrrMIAA) * 100) : 0}% de marge` },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-3 py-2.5 bg-[#142850] rounded-lg border border-[#1a2d50]">
                <div>
                  <p className="text-sm text-[#FFFFFF]">{r.label}</p>
                  <p className="text-xs text-[#484F58]">{r.note}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: r.color }}>{r.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top question categories */}
        <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">Catégories de questions (estimé)</h2>
          <div className="space-y-3">
            {topCategories.map(c => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8B949E]">{c.label}</span>
                  <span className="text-[#FFFFFF] font-medium">{c.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#1a2d50] rounded-full overflow-hidden">
                  <div className="h-full bg-[#8B0070] rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clients with MIAA+ */}
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">
          Clients utilisant MIAA+ ({nbTenantsWithMIAA})
        </h2>
        {tenantsWithMIAA.length === 0 ? (
          <p className="text-sm text-[#484F58] text-center py-8">Aucun client avec MIAA+ actif</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenantsWithMIAA.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-3 bg-[#142850] border border-[#1a2d50] rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-[#8B0070]/20 border border-[#8B0070]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#8B0070] text-sm font-bold">
                    {t.nom_entreprise.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#FFFFFF] truncate">{t.nom_entreprise}</p>
                  <p className="text-xs text-[#484F58]">{(t.modules_actifs ?? []).length} modules</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tech info */}
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">Configuration technique</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Modèle', value: 'Claude Haiku 4.5', color: '#8B0070' },
            { label: 'Max tokens', value: '1 024 out', color: '#F08900' },
            { label: 'Historique', value: '10 messages', color: '#F08900' },
            { label: 'Context', value: 'Congo fiscal', color: '#2EA043' },
          ].map(c => (
            <div key={c.label} className="bg-[#142850] border border-[#1a2d50] rounded-lg p-3">
              <p className="text-xs text-[#484F58] mb-1">{c.label}</p>
              <p className="text-sm font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
