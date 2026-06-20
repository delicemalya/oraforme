'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  BarChart2, RefreshCw, Loader2, TrendingUp, TrendingDown,
} from 'lucide-react'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface VenteRow {
  created_at: string
  total: number
  mode_paiement: string
  nb_articles: number
}

interface LigneRow {
  produit_nom: string
  qte: number
  sous_total: number
  ventes: { created_at: string; tenant_id: string } | null
}

export default function CommerceAnalyticsPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [loading,  setLoading]  = useState(true)
  const [annee,    setAnnee]    = useState(new Date().getFullYear())
  const [ventes,   setVentes]   = useState<VenteRow[]>([])
  const [lignes,   setLignes]   = useState<LigneRow[]>([])

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const debut = `${annee}-01-01`
    const fin   = `${annee + 1}-01-01`

    const [{ data: v }, { data: l }] = await Promise.all([
      supabase.from('ventes').select('created_at, total, mode_paiement, nb_articles')
        .eq('tenant_id', tid).eq('statut', 'validee').gte('created_at', debut).lt('created_at', fin),
      supabase.from('vente_lignes').select('produit_nom, qte, sous_total, ventes(created_at, tenant_id)')
        .filter('ventes.tenant_id', 'eq', tid).filter('ventes.created_at', 'gte', debut).filter('ventes.created_at', 'lt', fin).limit(5000),
    ])
    setVentes((v ?? []) as VenteRow[])
    setLignes((l ?? []) as unknown as LigneRow[])
    setLoading(false)
  }, [tid, annee])

  useEffect(() => { load() }, [load])

  // Stats par mois
  const statsMois = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const prefix = `${annee}-${m}`
    const mv = ventes.filter(v => v.created_at?.startsWith(prefix))
    return {
      mois: i + 1,
      ca: mv.reduce((s, v) => s + v.total, 0),
      tickets: mv.length,
      articles: mv.reduce((s, v) => s + (v.nb_articles ?? 0), 0),
    }
  })

  const totalCA      = ventes.reduce((s, v) => s + v.total, 0)
  const totalTickets = ventes.length
  const panierMoyen  = totalTickets > 0 ? totalCA / totalTickets : 0

  const now = new Date()
  const moisCourant = String(now.getMonth() + 1).padStart(2, '0')
  const prevMois    = String(now.getMonth()).padStart(2, '0') || '12'
  const caMois      = ventes.filter(v => v.created_at?.startsWith(`${annee}-${moisCourant}`)).reduce((s, v) => s + v.total, 0)
  const caPrevMois  = ventes.filter(v => v.created_at?.startsWith(`${annee}-${prevMois}`)).reduce((s, v) => s + v.total, 0)
  const evolMois    = caPrevMois > 0 ? (caMois - caPrevMois) / caPrevMois * 100 : 0

  // Top produits
  const byProduit: Record<string, { ca: number; qte: number }> = {}
  lignes.forEach(l => {
    if (!byProduit[l.produit_nom]) byProduit[l.produit_nom] = { ca: 0, qte: 0 }
    byProduit[l.produit_nom].ca  += l.sous_total ?? 0
    byProduit[l.produit_nom].qte += l.qte ?? 0
  })
  const topProduits = Object.entries(byProduit).sort((a, b) => b[1].ca - a[1].ca).slice(0, 8)

  // Top modes de paiement
  const byMode: Record<string, number> = {}
  ventes.forEach(v => { byMode[v.mode_paiement] = (byMode[v.mode_paiement] ?? 0) + v.total })
  const topModes = Object.entries(byMode).sort((a, b) => b[1] - a[1])

  const maxBar = Math.max(...statsMois.map(s => s.ca), 1)
  const moisActuel = now.getMonth() + 1

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/commerce" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Commerce</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
            <div className="flex bg-[#F1F5F9] rounded-xl p-1">
              {[annee - 1, annee].map(y => (
                <button key={y} onClick={() => setAnnee(y)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${y === annee ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">CA {annee}</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(totalCA)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Ce mois</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(caMois)}</p>
            {evolMois !== 0 && (
              <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${evolMois > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {evolMois > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {evolMois > 0 ? '+' : ''}{evolMois.toFixed(1)}%
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Tickets</p>
            <p className="text-[20px] font-black text-[#0F172A]">{totalTickets}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Panier moyen</p>
            <p className="text-[20px] font-black text-[#0F172A]">{panierMoyen > 0 ? fmt(panierMoyen) : '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Graphe mensuel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-[13px] font-black text-[#0F172A] mb-4">CA mensuel · {annee}</h3>
            <div className="flex items-end gap-1.5 h-48">
              {statsMois.map(s => (
                <div key={s.mois} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                    {s.ca > 0 && (
                      <div className="w-full rounded-t-lg transition-all" style={{ height: `${(s.ca / maxBar) * 160}px`, background: s.mois === moisActuel && annee === now.getFullYear() ? '#DC2626' : '#FCA5A5' }} />
                    )}
                  </div>
                  <span className={`text-[9px] font-semibold ${s.mois === moisActuel && annee === now.getFullYear() ? 'text-red-600' : 'text-[#94A3B8]'}`}>
                    {MOIS[s.mois - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top modes paiement */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-[13px] font-black text-[#0F172A] mb-4">Modes de paiement</h3>
            {topModes.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] text-center py-8">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {topModes.map(([mode, ca]) => (
                  <div key={mode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#374151] capitalize">{mode}</span>
                      <span className="text-[12px] font-black text-[#0F172A]">{fmt(ca)}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${(ca / (topModes[0]?.[1] ?? 1)) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{totalCA > 0 ? `${(ca / totalCA * 100).toFixed(1)}%` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top produits */}
        {topProduits.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-[13px] font-black text-[#0F172A] mb-4">Top 8 produits · {annee}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Produit</th>
                    <th className="text-right px-3 py-2">Qté vendue</th>
                    <th className="text-right px-3 py-2">CA généré</th>
                    <th className="text-right px-3 py-2">% du CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {topProduits.map(([nom, data], i) => (
                    <tr key={nom} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white inline-flex ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-[#94A3B8]' : i === 2 ? 'bg-amber-700' : 'bg-[#CBD5E1]'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-[#0F172A]">{nom}</td>
                      <td className="px-3 py-2.5 text-right text-[#64748B]">{data.qte.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-[#0F172A]">{fmt(data.ca)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-semibold">{totalCA > 0 ? `${(data.ca / totalCA * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tableau mensuel */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-[13px] font-black text-[#0F172A]">Détail mensuel {annee}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-4 py-2.5">Mois</th>
                  <th className="text-right px-4 py-2.5">Tickets</th>
                  <th className="text-right px-4 py-2.5">Articles</th>
                  <th className="text-right px-4 py-2.5">CA</th>
                  <th className="text-right px-4 py-2.5">Panier moyen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {statsMois.map(s => {
                  const isCurrentMois = s.mois === moisActuel && annee === now.getFullYear()
                  return (
                    <tr key={s.mois} className={`hover:bg-[#F8FAFC] ${isCurrentMois ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-semibold text-[#374151]">
                        {MOIS[s.mois - 1]}
                        {isCurrentMois && <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">En cours</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{s.tickets || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{s.articles || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-black text-[#0F172A]">{s.ca > 0 ? fmt(s.ca) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{s.tickets > 0 ? fmt(s.ca / s.tickets) : '—'}</td>
                    </tr>
                  )
                })}
                <tr className="bg-[#F8FAFC] font-black border-t-2 border-[#E2E8F0]">
                  <td className="px-4 py-2.5">Total {annee}</td>
                  <td className="px-4 py-2.5 text-right">{totalTickets}</td>
                  <td className="px-4 py-2.5 text-right">{ventes.reduce((s, v) => s + (v.nb_articles ?? 0), 0)}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(totalCA)}</td>
                  <td className="px-4 py-2.5 text-right">{panierMoyen > 0 ? fmt(panierMoyen) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
