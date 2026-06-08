'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, ShoppingBag, Users, AlertTriangle, RefreshCw, Loader2, ChevronRight } from 'lucide-react'

interface KPIs {
  ca_aujourd: number; ca_semaine: number; ca_mois: number
  achats_mois: number; resultat_mois: number; ticket_moyen: number
  nb_commandes_mois: number; reservations_aujourd: number
  reservations_confirmees: number; stocks_critiques: number
}
interface Rentabilite { nom: string; categorie: string; prix: number; cout: number; marge: number; marge_pct: number }
interface StockCritique { nom: string; quantite: number; seuil_alerte: number }
interface ByMode { salle: number; livraison: number; emporter: number }
interface ByPaiement { especes: number; airtel: number; mtn: number; carte: number }
interface Histo { mois: number; annee: number; ca: number }

function fmtNum(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }
function fmtMonth(m: number) { return ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][m - 1] }

export default function DirectionRestaurantPage() {
  const [kpis,      setKpis]      = useState<KPIs | null>(null)
  const [renta,     setRenta]     = useState<Rentabilite[]>([])
  const [critiques, setCritiques] = useState<StockCritique[]>([])
  const [byMode,    setByMode]    = useState<ByMode | null>(null)
  const [byPaie,    setByPaie]    = useState<ByPaiement | null>(null)
  const [histo,     setHisto]     = useState<Histo[]>([])
  const [loading,   setLoading]   = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/resto/direction')
    if (res.ok) {
      const d = await res.json()
      setKpis(d.kpis); setRenta(d.rentabilite); setCritiques(d.stocks_critiques)
      setByMode(d.by_mode); setByPaie(d.by_paiement); setHisto(d.historique)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const maxCA = histo.length > 0 ? Math.max(...histo.map(h => h.ca), 1) : 1

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Restaurant
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Direction Générale</h1>
          </div>
          <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
      ) : kpis && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "CA Aujourd'hui", val: fmtNum(kpis.ca_aujourd) + ' FCFA', color: '#F59E0B', icon: TrendingUp },
              { label: 'CA Semaine',     val: fmtNum(kpis.ca_semaine) + ' FCFA', color: '#2563EB', icon: TrendingUp },
              { label: 'CA Mois',        val: fmtNum(kpis.ca_mois) + ' FCFA',    color: '#16A34A', icon: TrendingUp },
              { label: 'Résultat Mois',  val: fmtNum(kpis.resultat_mois) + ' FCFA', color: kpis.resultat_mois >= 0 ? '#16A34A' : '#DC2626', icon: TrendingUp },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-[16px] font-black" style={{ color: k.color }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ticket moyen',     val: fmtNum(kpis.ticket_moyen) + ' FCFA', color: '#7C3AED' },
              { label: 'Commandes / mois', val: String(kpis.nb_commandes_mois),       color: '#0F172A' },
              { label: 'Réservations ce soir', val: String(kpis.reservations_confirmees), color: '#2563EB' },
              { label: 'Stocks critiques',  val: String(kpis.stocks_critiques),        color: kpis.stocks_critiques > 0 ? '#DC2626' : '#16A34A' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm text-center">
                <p className="text-[22px] font-black" style={{ color: k.color }}>{k.val}</p>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Mode commandes */}
            {byMode && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                <h3 className="text-[12px] font-black text-[#0F172A] uppercase tracking-wide mb-3">Commandes par mode</h3>
                <div className="space-y-2">
                  {[['Salle', byMode.salle, '#F59E0B'], ['Livraison', byMode.livraison, '#2563EB'], ["À emporter", byMode.emporter, '#16A34A']].map(([label, val, color]) => {
                    const total = byMode.salle + byMode.livraison + byMode.emporter || 1
                    return (
                      <div key={label as string}>
                        <div className="flex justify-between text-[12px] mb-0.5">
                          <span className="text-[#475569]">{label}</span>
                          <span className="font-bold text-[#0F172A]">{val}</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((val as number) / total) * 100}%`, background: color as string }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Répartition paiements */}
            {byPaie && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                <h3 className="text-[12px] font-black text-[#0F172A] uppercase tracking-wide mb-3">Paiements</h3>
                <div className="space-y-2">
                  {[['Espèces', byPaie.especes, '#F59E0B'], ['Airtel', byPaie.airtel, '#DC2626'], ['MTN', byPaie.mtn, '#F59E0B'], ['Carte', byPaie.carte, '#2563EB']].map(([label, val, color]) => {
                    const total = Object.values(byPaie).reduce((s, v) => s + v, 0) || 1
                    return (
                      <div key={label as string}>
                        <div className="flex justify-between text-[12px] mb-0.5">
                          <span className="text-[#475569]">{label}</span>
                          <span className="font-bold text-[#0F172A]">{fmtNum(val as number)}</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((val as number) / total) * 100}%`, background: color as string }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stocks critiques */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-amber-500" />
                <h3 className="text-[12px] font-black text-[#0F172A] uppercase tracking-wide">Stocks critiques</h3>
              </div>
              {critiques.length === 0 ? (
                <p className="text-[12px] text-[#16A34A] font-semibold">Tous les stocks sont OK</p>
              ) : (
                <div className="space-y-1.5">
                  {critiques.map(s => (
                    <div key={s.nom} className="flex justify-between items-center text-[12px]">
                      <span className="text-[#0F172A] font-medium">{s.nom}</span>
                      <span className="text-[#DC2626] font-bold">{s.quantite} / {s.seuil_alerte}</span>
                    </div>
                  ))}
                  <Link href="/dashboard/restaurant/inventaire" className="flex items-center gap-1 text-[11px] text-amber-600 font-bold mt-2">
                    Voir inventaire <ChevronRight size={11} />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Rentabilité plats */}
          {renta.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <h3 className="text-[12px] font-black text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
                <ShoppingBag size={13} className="text-amber-500" /> Rentabilité plats
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Plat', 'Catégorie', 'Prix vente', 'Coût prod.', 'Marge FCFA', 'Marge %'].map(h => (
                        <th key={h} className="text-left pb-2 pr-4 text-[#94A3B8] font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renta.map(r => (
                      <tr key={r.nom} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="py-2 pr-4 font-semibold text-[#0F172A]">{r.nom}</td>
                        <td className="py-2 pr-4 text-[#64748B]">{r.categorie}</td>
                        <td className="py-2 pr-4 text-[#0F172A]">{fmtNum(r.prix)}</td>
                        <td className="py-2 pr-4 text-[#DC2626]">{fmtNum(r.cout)}</td>
                        <td className="py-2 pr-4 font-bold text-[#16A34A]">{fmtNum(r.marge)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.marge_pct >= 50 ? 'bg-green-100 text-green-700' : r.marge_pct >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {r.marge_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Historique 6 mois */}
          {histo.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <h3 className="text-[12px] font-black text-[#0F172A] uppercase tracking-wide mb-4">CA 6 derniers mois</h3>
              <div className="flex items-end gap-2 h-24">
                {histo.map(h => (
                  <div key={`${h.annee}-${h.mois}`} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-amber-400 rounded-t-lg hover:bg-amber-500 transition-all"
                      style={{ height: `${(h.ca / maxCA) * 80}px`, minHeight: h.ca > 0 ? '4px' : '0' }} />
                    <span className="text-[9px] text-[#94A3B8] font-semibold">{fmtMonth(h.mois)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liens modules */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/dashboard/restaurant', label: 'Caisse POS', icon: '🖥️' },
              { href: '/dashboard/restaurant/reservations', label: 'Réservations', icon: '📅' },
              { href: '/dashboard/restaurant/livraisons', label: 'Livraisons', icon: '🛵' },
              { href: '/dashboard/restaurant/miaa', label: 'MIAA+ IA', icon: '🤖' },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex items-center gap-2 hover:border-amber-300 hover:bg-amber-50 transition-all">
                <span className="text-[18px]">{l.icon}</span>
                <span className="text-[12px] font-bold text-[#0F172A]">{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
