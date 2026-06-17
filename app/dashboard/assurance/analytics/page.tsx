'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { BarChart2, RefreshCw, TrendingUp, TrendingDown, Shield, DollarSign, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const fmt  = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtM = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}k` : String(Math.round(n))

interface ByType { type: string; total: number; actives: number; primes: number }
interface ByAgent { agent: string; code: string; nb_polices: number; commissions: number; paye: number }
interface SinBySt { statut: string; count: number }

const TYPE_LABELS: Record<string,string> = {
  auto:'Auto', vie:'Vie', habitation:'Habitation', sante:'Santé', responsabilite_civile:'RC',
  transport:'Transport', agricole:'Agricole', maritime:'Maritime', aviation:'Aviation', voyage:'Voyage', incendie:'Incendie',
}

const STATUT_COLORS: Record<string,string> = {
  declare:'#F59E0B', en_instruction:'#3B82F6', expertise:'#8B5CF6',
  accepte:'#10B981', refuse:'#EF4444', clos:'#94A3B8',
}

export default function AnalyticsPage() {
  const { tenantId } = useTenantContext()
  const [loading,    setLoading]    = useState(true)
  const [kpis,       setKpis]       = useState({ primes: 0, sinistres_declares: 0, taux_sinistralite: 0, commissions_dues: 0, polices_actives: 0, sinistres_payes: 0 })
  const [byType,     setByType]     = useState<ByType[]>([])
  const [byAgent,    setByAgent]    = useState<ByAgent[]>([])
  const [sinBySt,    setSinBySt]    = useState<SinBySt[]>([])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [policesRes, sinistresRes, commissionsRes] = await Promise.all([
        supabase.from('ass_polices').select('type_police, statut, prime_montant').eq('tenant_id', tenantId),
        supabase.from('ass_sinistres').select('statut, montant_declare, montant_indemnise').eq('tenant_id', tenantId),
        supabase.from('ass_commissions')
          .select('montant, statut_paiement, ass_agents!inner(nom, prenom, code_agent)')
          .eq('tenant_id', tenantId),
      ])

      const polices     = policesRes.data ?? []
      const sinistres   = sinistresRes.data ?? []
      const commissions = commissionsRes.data ?? []

      const primesTotal = polices.filter(p => p.statut === 'active').reduce((s, p) => s + (p.prime_montant ?? 0), 0)
      const sinPaye     = sinistres.filter(s => s.statut === 'accepte').reduce((s, i) => s + (i.montant_indemnise ?? 0), 0)
      const tauxSin     = primesTotal > 0 ? (sinPaye / primesTotal) * 100 : 0
      const commDues    = commissions.filter(c => c.statut_paiement === 'en_attente').reduce((s, c) => s + (c.montant ?? 0), 0)

      setKpis({
        primes: primesTotal,
        sinistres_declares: sinistres.length,
        taux_sinistralite: tauxSin,
        commissions_dues: commDues,
        polices_actives: polices.filter(p => p.statut === 'active').length,
        sinistres_payes: sinPaye,
      })

      // By type
      const typeMap = new Map<string, ByType>()
      polices.forEach(p => {
        if (!typeMap.has(p.type_police)) typeMap.set(p.type_police, { type: p.type_police, total: 0, actives: 0, primes: 0 })
        const t = typeMap.get(p.type_police)!
        t.total++
        if (p.statut === 'active') { t.actives++; t.primes += p.prime_montant ?? 0 }
      })
      setByType(Array.from(typeMap.values()).sort((a, b) => b.primes - a.primes))

      // By sinistre statut
      const stMap = new Map<string, number>()
      sinistres.forEach(s => stMap.set(s.statut, (stMap.get(s.statut) ?? 0) + 1))
      setSinBySt(Array.from(stMap.entries()).map(([statut, count]) => ({ statut, count })))

      // By agent
      const agentMap = new Map<string, ByAgent>()
      commissions.forEach((c: { ass_agents: { nom: string; prenom: string; code_agent: string } | null; montant: number; statut_paiement: string }) => {
        const ag = c.ass_agents
        if (!ag) return
        const key = ag.code_agent
        if (!agentMap.has(key)) agentMap.set(key, { agent: `${ag.prenom} ${ag.nom}`, code: ag.code_agent, nb_polices: 0, commissions: 0, paye: 0 })
        const entry = agentMap.get(key)!
        entry.nb_polices++
        entry.commissions += c.montant ?? 0
        if (c.statut_paiement === 'paye') entry.paye += c.montant ?? 0
      })
      setByAgent(Array.from(agentMap.values()).sort((a, b) => b.commissions - a.commissions).slice(0, 8))
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const maxPrimes = Math.max(...byType.map(t => t.primes), 1)
  const sinTotal  = sinBySt.reduce((s, x) => s + x.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <BarChart2 className="text-[#DC2626]" size={22} /> Analytics
          </h1>
          <p className="text-sm text-[#64748B]">Performance du portefeuille assurance</p>
        </div>
        <button onClick={load} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#DC2626]' : 'text-[#64748B]'} />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Primes actives',        value: fmtM(kpis.primes) + ' FCFA',               sub: `${kpis.polices_actives} polices`,               icon: Shield,        cls: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Sinistres déclarés',    value: String(kpis.sinistres_declares),             sub: 'total portefeuille',                             icon: AlertTriangle, cls: 'text-yellow-600',bg: 'bg-yellow-50' },
          { label: 'Taux sinistralité',     value: kpis.taux_sinistralite.toFixed(1) + '%',    sub: kpis.taux_sinistralite <= 70 ? 'Bon ratio' : 'Attention', icon: kpis.taux_sinistralite <= 70 ? TrendingDown : TrendingUp, cls: kpis.taux_sinistralite <= 70 ? 'text-green-600' : 'text-red-600', bg: kpis.taux_sinistralite <= 70 ? 'bg-green-50' : 'bg-red-50' },
          { label: 'Indemnisations',        value: fmtM(kpis.sinistres_payes) + ' FCFA',       sub: 'sinistres acceptés',                             icon: TrendingDown,  cls: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'Commissions dues',      value: fmtM(kpis.commissions_dues) + ' FCFA',      sub: 'à verser aux agents',                            icon: DollarSign,    cls: 'text-orange-600',bg: 'bg-orange-50' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-2xl border border-gray-100 bg-white p-4 flex items-start gap-3`}>
              <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={k.cls} />
              </div>
              <div>
                <div className="text-lg font-black text-[#0F172A]">{loading ? '—' : k.value}</div>
                <div className="text-xs font-bold text-[#374151]">{k.label}</div>
                <div className="text-xs text-[#94A3B8]">{k.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Primes par type de police — bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-black text-[#0F172A] text-sm mb-4">Primes par type de police</h2>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-[#DC2626]" size={20} /></div>
          ) : byType.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {byType.map(t => (
                <div key={t.type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#374151]">{TYPE_LABELS[t.type] ?? t.type}</span>
                    <span className="text-[#94A3B8]">{fmt(t.primes)} FCFA · {t.actives} active{t.actives !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#DC2626] rounded-full transition-all duration-500"
                      style={{ width: `${(t.primes / maxPrimes) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Répartition sinistres par statut — donut-like */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-black text-[#0F172A] text-sm mb-4">Répartition des sinistres</h2>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-[#DC2626]" size={20} /></div>
          ) : sinBySt.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Aucun sinistre</p>
          ) : (
            <div className="space-y-3">
              {sinBySt.map(s => {
                const pct = sinTotal > 0 ? (s.count / sinTotal) * 100 : 0
                const color = STATUT_COLORS[s.statut] ?? '#94A3B8'
                const labels: Record<string, string> = { declare: 'Déclaré', en_instruction: 'En instruction', expertise: 'Expertise', accepte: 'Accepté', refuse: 'Refusé', clos: 'Clos' }
                return (
                  <div key={s.statut}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#374151]">{labels[s.statut] ?? s.statut}</span>
                      <span className="text-[#94A3B8]">{s.count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top agents */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-black text-[#0F172A] text-sm mb-4">Top agents — commissions générées</h2>
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-[#DC2626]" size={20} /></div>
        ) : byAgent.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Aucun agent</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Agent', 'Code', 'Polices', 'Total commissions', 'Payé', 'En attente'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wide px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byAgent.map((a, i) => (
                  <tr key={a.code} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 text-xs font-bold text-[#94A3B8]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#0F172A]">{a.agent}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-[#DC2626]">{a.code}</td>
                    <td className="px-3 py-2.5 text-[#64748B]">{a.nb_polices}</td>
                    <td className="px-3 py-2.5 font-bold text-[#0F172A]">{fmt(a.commissions)} FCFA</td>
                    <td className="px-3 py-2.5 text-green-600 font-semibold">{fmt(a.paye)} FCFA</td>
                    <td className="px-3 py-2.5 text-yellow-600 font-semibold">{fmt(a.commissions - a.paye)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ratio card */}
      <div className={`rounded-2xl border p-5 ${kpis.taux_sinistralite <= 70 ? 'bg-green-50 border-green-200' : kpis.taux_sinistralite <= 85 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black ${kpis.taux_sinistralite <= 70 ? 'bg-green-100 text-green-700' : kpis.taux_sinistralite <= 85 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {loading ? '—' : `${kpis.taux_sinistralite.toFixed(0)}%`}
          </div>
          <div>
            <div className="font-black text-[#0F172A]">Taux de sinistralité global</div>
            <div className="text-sm text-[#64748B]">
              {loading ? '...' : kpis.taux_sinistralite <= 70
                ? 'Portefeuille sain — ratio sinistres/primes dans la norme (<70%)'
                : kpis.taux_sinistralite <= 85
                ? 'Ratio en vigilance — surveiller les sinistres entrants (70–85%)'
                : 'Ratio critique — action correctrice recommandée (>85%)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
