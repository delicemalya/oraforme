'use client'

import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, Clock, Target, Users, Briefcase, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const SOURCES_DEMO = [
  { label: 'MIAA+ Job IA',    pct: 42, color: '#F59E0B' },
  { label: 'Réseau LinkedIn', pct: 28, color: '#2563EB' },
  { label: 'Bouche-à-oreille',pct: 18, color: '#16A34A' },
  { label: 'Site carrières',  pct: 12, color: '#8B5CF6' },
]

const PIPELINE_DEMO = [
  { label: 'Candidatures reçues', value: 148, color: '#2563EB' },
  { label: 'CV présélectionnés',  value: 62,  color: '#F59E0B' },
  { label: 'Entretiens tenus',    value: 28,  color: '#8B5CF6' },
  { label: 'Offres envoyées',     value: 12,  color: '#16A34A' },
  { label: 'Placements réalisés', value: 9,   color: '#0EA5E9' },
]

export default function AnalyticsRH() {
  const { tenantId, loading: tl } = useTenant()
  const [totals, setTotals] = useState({ offres: 0, candidatures: 0, entretiens: 0, retenus: 0 })
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState<'30j' | '90j' | '1an'>('30j')

  useEffect(() => { if (tenantId) void load() }, [tenantId])

  async function load() {
    if (!tenantId) return
    setLoading(true)
    const [{ count: o }, { count: c }, { count: e }, { count: r }] = await Promise.all([
      supabase.from('offres_emploi').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('entretiens').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'retenu'),
    ])
    setTotals({ offres: o ?? 0, candidatures: c ?? 0, entretiens: e ?? 0, retenus: r ?? 0 })
    setLoading(false)
  }

  const tauxConv = totals.candidatures > 0 ? Math.round((totals.retenus / totals.candidatures) * 100) : 0

  if (tl || loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Analytics RH</h1>
          <p className="text-[11px] text-[#64748B]">KPIs & performance recrutement</p>
        </div>
        <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-xl p-1">
          {(['30j', '90j', '1an'] as const).map(p => (
            <button key={p} onClick={() => setPeriode(p)}
              className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${periode === p ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Briefcase,  label: 'Offres publiées',     value: totals.offres,       color: '#2563EB', suffix: '' },
          { icon: Users,      label: 'Candidatures totales',value: totals.candidatures, color: '#F59E0B', suffix: '' },
          { icon: Clock,      label: 'Entretiens réalisés', value: totals.entretiens,   color: '#8B5CF6', suffix: '' },
          { icon: Target,     label: 'Taux de transformation', value: tauxConv,         color: '#16A34A', suffix: '%' },
        ].map(({ icon: Icon, label, value, color, suffix }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '18' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-extrabold text-[#0F172A]">{value}{suffix}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pipeline de conversion */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4">Pipeline de conversion</h2>
          <div className="space-y-3">
            {PIPELINE_DEMO.map((step, idx) => {
              const pct = Math.round((step.value / PIPELINE_DEMO[0].value) * 100)
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[#374151] font-medium">{step.label}</span>
                    <span className="text-[12px] font-bold text-[#0F172A]">{step.value}</span>
                  </div>
                  <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: step.color }} />
                  </div>
                  {idx < PIPELINE_DEMO.length - 1 && (
                    <p className="text-[9px] text-[#94A3B8] mt-0.5 text-right">
                      {Math.round((step.value / PIPELINE_DEMO[idx + 1]?.value || 1) * 10) / 10}x drop-off
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sources de candidats */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4">Sources de candidats</h2>
          <div className="space-y-3">
            {SOURCES_DEMO.map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-[#374151] font-medium">{s.label}</span>
                  <span className="text-[12px] font-bold" style={{ color: s.color }}>{s.pct}%</span>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-4 text-center">Source : données MIAA+ Job (démonstration)</p>
        </div>

      </div>

      {/* Métriques temps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Délai moyen de recrutement', value: '18 jours', icon: Clock, color: '#F59E0B', desc: 'De la publication au contrat' },
          { label: 'Score moyen des CV',          value: '74/100',  icon: TrendingUp, color: '#2563EB', desc: 'Analysés par MIAA+ Job' },
          { label: 'Candidatures par offre',      value: totals.offres > 0 ? Math.round(totals.candidatures / totals.offres) : 0, icon: BarChart2, color: '#16A34A', desc: 'En moyenne' },
        ].map(({ label, value, icon: Icon, color, desc }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
                <Icon size={15} style={{ color }} />
              </div>
              <p className="text-xs font-semibold text-[#374151]">{label}</p>
            </div>
            <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

    </div>
  )
}
