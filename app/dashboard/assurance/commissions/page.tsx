'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { DollarSign, RefreshCw, CheckCircle2, Clock, XCircle, Search, TrendingUp } from 'lucide-react'

interface Commission {
  id: string
  agent_id: string
  police_id: string
  montant: number
  taux: number
  statut_paiement: 'en_attente' | 'paye' | 'annule'
  date_paiement: string | null
  created_at: string
  ass_agents?: { nom: string; prenom: string; code_agent: string }
  ass_polices?: { numero_police: string; assure_nom: string; type_police: string }
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const STATUT_CONFIG = {
  en_attente: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paye:       { label: 'Payé',       cls: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  annule:     { label: 'Annulé',     cls: 'bg-red-100 text-red-700',       icon: XCircle },
}

export default function CommissionsPage() {
  const { tenantId } = useTenantContext()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [updating,    setUpdating]    = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterSt,    setFilterSt]    = useState<string>('')
  const [kpis,        setKpis]        = useState({ total_a_payer: 0, total_paye: 0, nb_en_attente: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/assurance/commissions')
      const json = await res.json()
      setCommissions(json.data ?? [])
      setKpis({ total_a_payer: json.total_a_payer ?? 0, total_paye: json.total_paye ?? 0, nb_en_attente: json.nb_en_attente ?? 0 })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  const updateStatut = async (id: string, statut: string) => {
    setUpdating(id)
    await fetch('/api/assurance/commissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut_paiement: statut }),
    })
    setUpdating(null)
    load()
  }

  const displayed = commissions.filter(c => {
    const agentName = `${c.ass_agents?.prenom ?? ''} ${c.ass_agents?.nom ?? ''}`.toLowerCase()
    const policeNum = c.ass_polices?.numero_police?.toLowerCase() ?? ''
    const assure    = c.ass_polices?.assure_nom?.toLowerCase() ?? ''
    const matchSearch = !search || agentName.includes(search.toLowerCase()) || policeNum.includes(search.toLowerCase()) || assure.includes(search.toLowerCase())
    const matchSt     = !filterSt || c.statut_paiement === filterSt
    return matchSearch && matchSt
  })

  const kpiCards = [
    { label: 'À payer', value: fmt(kpis.total_a_payer) + ' FCFA', sub: `${kpis.nb_en_attente} commission${kpis.nb_en_attente !== 1 ? 's' : ''}`, cls: 'border-yellow-200 bg-yellow-50', vCls: 'text-yellow-700' },
    { label: 'Déjà payé', value: fmt(kpis.total_paye) + ' FCFA', sub: 'total versé', cls: 'border-green-200 bg-green-50', vCls: 'text-green-700' },
    { label: 'Total portefeuille', value: fmt(kpis.total_a_payer + kpis.total_paye) + ' FCFA', sub: `${commissions.length} lignes`, cls: 'border-blue-200 bg-blue-50', vCls: 'text-blue-700' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <DollarSign className="text-[#DC2626]" size={22} /> Commissions agents
          </h1>
          <p className="text-sm text-[#64748B]">Suivi des commissions et paiements</p>
        </div>
        <button onClick={load} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 self-start">
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#DC2626]' : 'text-[#64748B]'} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.cls}`}>
            <div className={`text-lg font-black mb-0.5 ${k.vCls}`}>{k.value}</div>
            <div className="text-xs font-bold text-[#374151]">{k.label}</div>
            <div className="text-xs text-[#94A3B8]">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par agent, police, assuré..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
        </div>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="paye">Payé</option>
          <option value="annule">Annulé</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-[#DC2626]" size={24} /></div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingUp size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucune commission trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Agent', 'Police', 'Assuré', 'Taux', 'Montant', 'Statut', 'Date paiement', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map(c => {
                  const sc = STATUT_CONFIG[c.statut_paiement]
                  const Icon = sc.icon
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#0F172A]">{c.ass_agents?.prenom} {c.ass_agents?.nom}</div>
                        <div className="text-xs text-[#94A3B8] font-mono">{c.ass_agents?.code_agent}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-mono font-bold text-[#DC2626]">{c.ass_polices?.numero_police ?? '—'}</div>
                        <div className="text-xs text-[#64748B] capitalize">{c.ass_polices?.type_police}</div>
                      </td>
                      <td className="px-4 py-3 text-[#374151]">{c.ass_polices?.assure_nom ?? '—'}</td>
                      <td className="px-4 py-3 text-[#374151]">{c.taux}%</td>
                      <td className="px-4 py-3 font-bold text-[#0F172A]">{fmt(c.montant)} FCFA</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 ${sc.cls}`}>
                          <Icon size={10} />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">
                        {c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {c.statut_paiement === 'en_attente' && (
                            <>
                              <button onClick={() => updateStatut(c.id, 'paye')} disabled={updating === c.id}
                                className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center gap-1">
                                {updating === c.id ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Payer
                              </button>
                              <button onClick={() => updateStatut(c.id, 'annule')} disabled={updating === c.id}
                                className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg disabled:opacity-50 transition-colors">
                                Annuler
                              </button>
                            </>
                          )}
                          {c.statut_paiement === 'paye' && (
                            <span className="text-xs text-[#94A3B8]">Traité</span>
                          )}
                          {c.statut_paiement === 'annule' && (
                            <button onClick={() => updateStatut(c.id, 'en_attente')} disabled={updating === c.id}
                              className="text-xs font-semibold px-2.5 py-1 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg disabled:opacity-50 transition-colors">
                              Réactiver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
