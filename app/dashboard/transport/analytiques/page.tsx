'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  BarChart2, TrendingUp, TrendingDown, RefreshCw, Loader2,
  Truck, Fuel, Users, Activity,
} from 'lucide-react'

interface StatMensuelle {
  mois:    number
  annee:   number
  recettes: number
  carburant: number
  nb_courses: number
}

function StatCard({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[20px] font-black text-[#0F172A]">{value}</p>
      {sub !== undefined && (
        <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${up === true ? 'text-green-600' : up === false ? 'text-red-600' : 'text-[#94A3B8]'}`}>
          {up === true && <TrendingUp size={11} />}
          {up === false && <TrendingDown size={11} />}
          {sub}
        </p>
      )}
    </div>
  )
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default function TransportAnalytiquesPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [loading,   setLoading]   = useState(true)
  const [annee,     setAnnee]     = useState(new Date().getFullYear())
  const [courses,   setCourses]   = useState<Array<{ date: string; montant: number; chauffeur_nom: string | null; statut: string }>>([])
  const [carburant, setCarburant] = useState<Array<{ date: string; total: number }>>([])
  const [vehicules, setVehicules] = useState<{ total: number; actifs: number }>({ total: 0, actifs: 0 })
  const [chauffeurs,setChauffeurs]= useState<Array<{ nom: string; total: number; nb: number }>>([])

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const debut = `${annee}-01-01`
    const fin   = `${annee}-12-31`

    const [{ data: c }, { data: fuel }, { data: vAll }, { data: vActifs }] = await Promise.all([
      supabase.from('courses').select('date, montant, chauffeur_nom, statut').eq('tenant_id', tid)
        .gte('date', debut).lte('date', fin),
      supabase.from('transport_carburant').select('date, total').eq('tenant_id', tid)
        .gte('date', debut).lte('date', fin),
      supabase.from('transport_vehicules').select('id').eq('tenant_id', tid),
      supabase.from('transport_vehicules').select('id').eq('tenant_id', tid).eq('statut', 'actif'),
    ])

    setCourses((c ?? []) as typeof courses)
    setCarburant((fuel ?? []) as typeof carburant)
    setVehicules({ total: (vAll ?? []).length, actifs: (vActifs ?? []).length })

    // Top chauffeurs
    const byChauffeur: Record<string, { total: number; nb: number }> = {}
    ;(c ?? []).forEach((r: { chauffeur_nom: string | null; montant: number }) => {
      const k = r.chauffeur_nom ?? 'Inconnu'
      if (!byChauffeur[k]) byChauffeur[k] = { total: 0, nb: 0 }
      byChauffeur[k].total += r.montant ?? 0
      byChauffeur[k].nb += 1
    })
    setChauffeurs(Object.entries(byChauffeur).map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.total - a.total).slice(0, 8))
    setLoading(false)
  }, [tid, annee])

  useEffect(() => { load() }, [load])

  // Build monthly stats
  const statsParMois: StatMensuelle[] = Array.from({ length: 12 }, (_, i) => {
    const moisN = i + 1
    const recettes   = courses.filter(c => parseInt(c.date?.split('-')[1] ?? '0') === moisN).reduce((s, r) => s + (r.montant ?? 0), 0)
    const carburantM = carburant.filter(c => parseInt(c.date?.split('-')[1] ?? '0') === moisN).reduce((s, r) => s + (r.total ?? 0), 0)
    const nb_courses = courses.filter(c => parseInt(c.date?.split('-')[1] ?? '0') === moisN).length
    return { mois: moisN, annee, recettes, carburant: carburantM, nb_courses }
  })

  const totalRecettes   = courses.reduce((s, r) => s + (r.montant ?? 0), 0)
  const totalCarburant  = carburant.reduce((s, r) => s + (r.total ?? 0), 0)
  const benefice        = totalRecettes - totalCarburant
  const totalCourses    = courses.length
  const coursesPaye     = courses.filter(c => c.statut === 'terminee' || c.statut === 'payee').length
  const tauxCompletion  = totalCourses > 0 ? Math.round((coursesPaye / totalCourses) * 100) : 0

  const maxBar = Math.max(...statsParMois.map(s => s.recettes), 1)
  const moisActuel = new Date().getMonth() + 1

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/transport" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Transport</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Analytiques</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
            <div className="flex bg-[#F1F5F9] rounded-xl p-1">
              {[annee - 1, annee, annee + 1].map(y => (
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
          <StatCard label="Recettes totales" value={fmt(totalRecettes)} />
          <StatCard label="Coût carburant"   value={fmt(totalCarburant)} sub={`${totalRecettes > 0 ? ((totalCarburant / totalRecettes) * 100).toFixed(1) : 0}% des recettes`} />
          <StatCard label="Bénéfice net"     value={fmt(benefice)} sub={benefice >= 0 ? 'Positif' : 'Déficitaire'} up={benefice >= 0} />
          <StatCard label="Taux complétion"  value={`${tauxCompletion}%`} sub={`${coursesPaye}/${totalCourses} courses`} />
        </div>

        {/* Fleet summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase">Flotte</p>
              <p className="text-[16px] font-black text-[#0F172A]">{vehicules.total} <span className="text-[12px] font-normal text-[#94A3B8]">véhicules</span></p>
              <p className="text-[10px] text-green-600 font-semibold">{vehicules.actifs} en service</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase">Chauffeurs</p>
              <p className="text-[16px] font-black text-[#0F172A]">{chauffeurs.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Activity size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase">Courses</p>
              <p className="text-[16px] font-black text-[#0F172A]">{totalCourses}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <Fuel size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase">Rendement</p>
              <p className="text-[16px] font-black text-[#0F172A]">{totalRecettes > 0 ? `${(benefice / totalRecettes * 100).toFixed(0)}%` : '—'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Graphe mensuel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-[13px] font-black text-[#0F172A] mb-4">Recettes vs Carburant · {annee}</h3>
            <div className="flex items-end gap-1.5 h-40">
              {statsParMois.map(s => (
                <div key={s.mois} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '120px' }}>
                    <div className="w-full rounded-t-sm" style={{ height: `${(s.recettes / maxBar) * 120}px`, background: '#DC2626' }} />
                  </div>
                  <div className="w-full rounded-t-sm -mt-0.5" style={{ height: `${(s.carburant / maxBar) * 120 * 0.8}px`, background: '#FCA5A5', marginTop: '-120px', opacity: 0.7 }} />
                  <span className={`text-[9px] font-semibold mt-0.5 ${s.mois === moisActuel && s.annee === new Date().getFullYear() ? 'text-red-600' : 'text-[#94A3B8]'}`}>
                    {MOIS[s.mois - 1]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]"><div className="w-3 h-3 rounded bg-red-600" /> Recettes</div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]"><div className="w-3 h-3 rounded bg-red-300" /> Carburant</div>
            </div>
          </div>

          {/* Top chauffeurs */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-[13px] font-black text-[#0F172A] mb-4">Top chauffeurs</h3>
            {chauffeurs.length === 0 ? (
              <div className="text-center py-8 text-[#94A3B8] text-[12px]">Aucune donnée</div>
            ) : (
              <div className="space-y-3">
                {chauffeurs.map((ch, i) => (
                  <div key={ch.nom} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-[#94A3B8]' : i === 2 ? 'bg-amber-700' : 'bg-[#CBD5E1]'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#0F172A] truncate">{ch.nom}</p>
                      <p className="text-[10px] text-[#94A3B8]">{ch.nb} courses</p>
                    </div>
                    <span className="text-[12px] font-black text-[#0F172A] flex-shrink-0">{fmt(ch.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats mensuelles */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-[13px] font-black text-[#0F172A]">Détail mensuel {annee}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-4 py-2.5">Mois</th>
                  <th className="text-right px-4 py-2.5">Courses</th>
                  <th className="text-right px-4 py-2.5">Recettes</th>
                  <th className="text-right px-4 py-2.5">Carburant</th>
                  <th className="text-right px-4 py-2.5">Bénéfice</th>
                  <th className="text-right px-4 py-2.5">Marge %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {statsParMois.map(s => {
                  const ben = s.recettes - s.carburant
                  const marge = s.recettes > 0 ? (ben / s.recettes) * 100 : 0
                  const isCurrentMois = s.mois === moisActuel && annee === new Date().getFullYear()
                  return (
                    <tr key={s.mois} className={`hover:bg-[#F8FAFC] ${isCurrentMois ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-4 py-2.5 font-semibold text-[#374151]">
                        {MOIS[s.mois - 1]}
                        {isCurrentMois && <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">En cours</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{s.nb_courses}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#0F172A]">{s.recettes > 0 ? fmt(s.recettes) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{s.carburant > 0 ? fmt(s.carburant) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${ben >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.recettes > 0 ? fmt(ben) : '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.recettes > 0 ? `${marge.toFixed(0)}%` : '—'}</td>
                    </tr>
                  )
                })}
                <tr className="bg-[#F8FAFC] font-black border-t-2 border-[#E2E8F0]">
                  <td className="px-4 py-2.5">Total {annee}</td>
                  <td className="px-4 py-2.5 text-right">{totalCourses}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(totalRecettes)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{fmt(totalCarburant)}</td>
                  <td className={`px-4 py-2.5 text-right ${benefice >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(benefice)}</td>
                  <td className={`px-4 py-2.5 text-right ${benefice >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalRecettes > 0 ? `${(benefice / totalRecettes * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
