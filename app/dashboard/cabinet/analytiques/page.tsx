'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  TrendingUp, Users, DollarSign, BarChart3, RefreshCw,
  Loader2, ArrowUpRight, ArrowDownRight, Calendar,
  Building2, PieChart, Target, Zap, Award,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CabinetClient {
  id: string; nom_entreprise: string; statut: string; type_compte: string | null
  honoraires_mensuel: number; frais_oraforme: number
  secteur_activite: string | null; created_at: string
}

interface Facture {
  montant_ttc: number; statut: string; mois: number | null; annee: number; created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const TYPE_COLORS: Record<string, string> = {
  comptable: '#2563EB', fiscal: '#7C3AED', audit: '#DC2626',
  conseil: '#16A34A', juridique: '#F59E0B', mixte: '#0F172A',
}

function Pct({ val, prev }: { val: number; prev: number }) {
  if (!prev) return null
  const p = Math.round(((val - prev) / prev) * 100)
  const pos = p >= 0
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${pos ? 'text-green-600' : 'text-red-600'}`}>
      {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(p)}%
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetAnalytiquesPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [clients,  setClients]  = useState<CabinetClient[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading,  setLoading]  = useState(true)
  const [year,     setYear]     = useState(new Date().getFullYear())

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: cl }, { data: fa }] = await Promise.all([
      supabase.from('cabinet_clients').select('*').eq('cabinet_tenant_id', tid),
      supabase.from('cabinet_honoraires_factures').select('montant_ttc, statut, mois, annee, created_at').eq('cabinet_tenant_id', tid),
    ])
    setClients((cl ?? []) as CabinetClient[])
    setFactures((fa ?? []) as Facture[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen gap-2 text-[#94A3B8]">
      <Loader2 size={20} className="animate-spin" /> Chargement...
    </div>
  )

  const now = new Date()
  const prevYear = year - 1

  // Revenus par mois (année sélectionnée)
  const revParMois = Array.from({ length: 12 }, (_, i) => ({
    mois:    i + 1,
    actuel:  factures.filter(f => f.mois === i+1 && f.annee === year  && f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0),
    prev:    factures.filter(f => f.mois === i+1 && f.annee === prevYear && f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0),
  }))
  const maxRev = Math.max(...revParMois.map(m => Math.max(m.actuel, m.prev)), 1)

  // Totaux
  const totalAnnee     = revParMois.reduce((s, m) => s + m.actuel, 0)
  const totalPrevAnnee = revParMois.reduce((s, m) => s + m.prev, 0)
  const moisActuel     = now.getMonth() + 1
  const revMoisAct     = revParMois.find(m => m.mois === moisActuel)?.actuel ?? 0
  const revMoisPrev    = revParMois.find(m => m.mois === moisActuel)?.prev ?? 0

  // Clients
  const actifs    = clients.filter(c => c.statut === 'actif')
  const prospects = clients.filter(c => c.statut === 'prospect')
  const honMensuel = actifs.reduce((s, c) => s + c.honoraires_mensuel, 0)

  // Par type de mission
  const parType = clients.reduce<Record<string, number>>((acc, c) => {
    const t = c.type_compte ?? 'comptable'
    acc[t] = (acc[t] ?? 0) + 1; return acc
  }, {})

  // Par secteur client
  const parSecteur = actifs.reduce<Record<string, number>>((acc, c) => {
    const s = c.secteur_activite ?? 'Non défini'
    acc[s] = (acc[s] ?? 0) + 1; return acc
  }, {})
  const topSecteurs = Object.entries(parSecteur).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Croissance clients par mois
  const croissanceClients = Array.from({ length: 12 }, (_, i) => ({
    mois:  i + 1,
    total: clients.filter(c => {
      const d = new Date(c.created_at)
      return d.getFullYear() === year && d.getMonth() <= i
    }).length,
  }))
  const maxClients = Math.max(...croissanceClients.map(m => m.total), 1)

  // Potentiel non réalisé
  const potentielMensuel = actifs.reduce((s, c) => s + c.honoraires_mensuel, 0)
  const potentielAnnuel  = potentielMensuel * 12
  const txRecouvrement   = potentielAnnuel > 0 ? Math.round((totalAnnee / potentielAnnuel) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/cabinet" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Cabinet</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Analytiques</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white font-semibold">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs principaux */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: `CA Encaissé ${year}`,
              value: `${fmt(totalAnnee)} F`,
              sub: `${year-1}: ${fmt(totalPrevAnnee)} F`,
              color: '#0F172A',
              diff: { val: totalAnnee, prev: totalPrevAnnee },
              icon: DollarSign,
            },
            {
              label: `Mois de ${MOIS[moisActuel-1]}`,
              value: `${fmt(revMoisAct)} F`,
              sub: `${year-1}: ${fmt(revMoisPrev)} F`,
              color: '#F59E0B',
              diff: { val: revMoisAct, prev: revMoisPrev },
              icon: Calendar,
            },
            {
              label: 'Clients actifs',
              value: actifs.length,
              sub: `${prospects.length} prospects`,
              color: '#2563EB',
              diff: null,
              icon: Users,
            },
            {
              label: 'Honoraires/mois',
              value: `${fmt(honMensuel)} F`,
              sub: `Potentiel annuel: ${fmt(potentielAnnuel)} F`,
              color: '#16A34A',
              diff: null,
              icon: Target,
            },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <Icon size={13} style={{ color: k.color }} />
                  </div>
                  {k.diff && <Pct val={k.diff.val} prev={k.diff.prev} />}
                </div>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-[18px] font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{k.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Graphiques principaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Revenus mensuels comparaison N vs N-1 */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2">
                <TrendingUp size={14} className="text-amber-500" /> CA mensuel — {year} vs {prevYear}
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />{year}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] inline-block" />{prevYear}</span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-24">
              {revParMois.map((m, i) => {
                const hAct  = Math.max(2, Math.round((m.actuel / maxRev) * 96))
                const hPrev = Math.max(2, Math.round((m.prev   / maxRev) * 96))
                const isNow = i + 1 === moisActuel && year === now.getFullYear()
                return (
                  <div key={i} className="flex items-end gap-0.5 flex-1">
                    <div className="w-1/2 rounded-t-md" style={{ height: hPrev, background: '#E2E8F0' }}
                      title={`${MOIS[i]} ${prevYear}: ${fmt(m.prev)} F`} />
                    <div className="w-1/2 rounded-t-md" style={{ height: hAct, background: isNow ? '#F59E0B' : '#FDE68A' }}
                      title={`${MOIS[i]} ${year}: ${fmt(m.actuel)} F`} />
                  </div>
                )
              })}
            </div>
            <div className="flex mt-1 gap-1">
              {MOIS.map((m, i) => (
                <p key={i} className={`flex-1 text-center text-[8px] font-bold ${i + 1 === moisActuel && year === now.getFullYear() ? 'text-amber-600' : 'text-[#CBD5E1]'}`}>
                  {m.slice(0, 1)}
                </p>
              ))}
            </div>
          </div>

          {/* Croissance portefeuille clients */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2 mb-4">
              <Users size={14} className="text-blue-500" /> Portefeuille clients — {year}
            </p>
            <div className="flex items-end gap-1 h-24">
              {croissanceClients.map((m, i) => {
                const h = Math.max(2, Math.round((m.total / maxClients) * 96))
                const isNow = i + 1 === moisActuel && year === now.getFullYear()
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 flex-1"
                    title={`${MOIS[i]}: ${m.total} clients`}>
                    <div className="w-full rounded-t-md" style={{ height: h, background: isNow ? '#2563EB' : '#BFDBFE' }} />
                    <span className={`text-[8px] font-bold ${isNow ? 'text-blue-700' : 'text-[#CBD5E1]'}`}>{MOIS[i].slice(0,1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Taux de recouvrement + répartition */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Taux recouvrement */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2 mb-4">
              <Zap size={14} className="text-amber-500" /> Taux de recouvrement
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                  <circle cx="50" cy="50" r="38" fill="none"
                    stroke={txRecouvrement >= 80 ? '#16A34A' : txRecouvrement >= 50 ? '#F59E0B' : '#DC2626'}
                    strokeWidth="12"
                    strokeDasharray={`${(txRecouvrement / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-black text-[#0F172A]">{txRecouvrement}%</span>
                  <span className="text-[10px] text-[#94A3B8]">encaissé</span>
                </div>
              </div>
              <div className="w-full space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-[#64748B]">Potentiel annuel</span><span className="font-bold">{fmt(potentielAnnuel)} F</span></div>
                <div className="flex justify-between"><span className="text-[#64748B]">Encaissé</span><span className="font-bold text-green-700">{fmt(totalAnnee)} F</span></div>
                <div className="flex justify-between"><span className="text-[#64748B]">Non recouvré</span><span className="font-bold text-red-700">{fmt(Math.max(0, potentielAnnuel - totalAnnee))} F</span></div>
              </div>
            </div>
          </div>

          {/* Répartition par type */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2 mb-4">
              <PieChart size={14} className="text-purple-500" /> Répartition par type de mission
            </p>
            <div className="space-y-2.5">
              {Object.entries(parType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[type] ?? '#94A3B8' }} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[12px] font-semibold text-[#374151] capitalize">{type}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / clients.length) * 100}%`, background: TYPE_COLORS[type] ?? '#94A3B8' }} />
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(parType).length === 0 && (
                <p className="text-[12px] text-[#94A3B8] text-center py-4">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Top secteurs clients */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2 mb-4">
              <Award size={14} className="text-amber-500" /> Top secteurs clients
            </p>
            <div className="space-y-2.5">
              {topSecteurs.map(([secteur, count], i) => (
                <div key={secteur} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[12px] font-semibold text-[#374151]">{secteur}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / Math.max(actifs.length, 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {topSecteurs.length === 0 && (
                <p className="text-[12px] text-[#94A3B8] text-center py-4">Aucune donnée</p>
              )}
            </div>
          </div>
        </div>

        {/* Tableau top clients par revenus */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <p className="text-[13px] font-black text-[#0F172A] flex items-center gap-2">
              <Building2 size={13} className="text-amber-500" /> Top clients par honoraires
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {['#', 'Client', 'Secteur', 'Type', 'Honoraires/mois', 'Annuel'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {actifs.sort((a, b) => b.honoraires_mensuel - a.honoraires_mensuel).slice(0, 10).map((c, i) => (
                  <tr key={c.id} className="hover:bg-[#FFFBEB]">
                    <td className="px-4 py-3">
                      <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/cabinet/clients/${c.id}`}
                        className="font-semibold text-[13px] text-amber-700 hover:underline">{c.nom_entreprise}</Link>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#64748B]">{c.secteur_activite ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: (TYPE_COLORS[c.type_compte ?? ''] ?? '#94A3B8') + '18', color: TYPE_COLORS[c.type_compte ?? ''] ?? '#94A3B8' }}>
                        {c.type_compte ?? 'comptable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-[14px] text-[#0F172A]">{fmt(c.honoraires_mensuel)} F</td>
                    <td className="px-4 py-3 font-bold text-[12px] text-amber-700">{fmt(c.honoraires_mensuel * 12)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
