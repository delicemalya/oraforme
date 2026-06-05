'use client'

import { useState, useEffect } from 'react'
import { Bot, TrendingUp, Users, Target, Loader2, Star, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface TopCandidat {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  score_global: number
  competences: string[] | null
  formation: string | null
}

interface Stats {
  totalCandidats: number
  totalCandidatures: number
  offresActives: number
  scoreMoyen: number
  topCandidats: TopCandidat[]
  repartitionStatuts: Record<string, number>
  scoreDistribution: { label: string; count: number; color: string }[]
}

const STATUT_LABELS: Record<string, string> = {
  recu: 'Reçus', en_examen: 'En examen', entretien: 'Entretien', retenu: 'Retenus', rejete: 'Rejetés',
}
const STATUT_COLORS: Record<string, string> = {
  recu: '#64748B', en_examen: '#2563EB', entretien: '#F59E0B', retenu: '#16A34A', rejete: '#DC2626',
}

export default function MiaaJobPage() {
  const { tenantId, loading } = useTenant()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    async function load() {
      setLoadingData(true)
      const [candRes, candaturesRes, offresRes] = await Promise.all([
        supabase.from('candidats').select('id,nom,prenom,email,score_global,competences,formation').eq('tenant_id', tenantId),
        supabase.from('candidatures').select('id,statut,score_ia').eq('tenant_id', tenantId),
        supabase.from('offres_emploi').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'active'),
      ])

      const candidats: TopCandidat[] = candRes.data ?? []
      const candidatures = candaturesRes.data ?? []

      const scoreMoyen = candidatures.length > 0
        ? Math.round(candidatures.reduce((s, c) => s + (c.score_ia ?? 0), 0) / candidatures.length)
        : 0

      const repartition: Record<string, number> = {}
      for (const c of candidatures) {
        repartition[c.statut] = (repartition[c.statut] ?? 0) + 1
      }

      const distribution = [
        { label: 'Excellent (80-100)', count: candidats.filter(c => (c.score_global ?? 0) >= 80).length, color: '#16A34A' },
        { label: 'Bon (60-79)', count: candidats.filter(c => (c.score_global ?? 0) >= 60 && (c.score_global ?? 0) < 80).length, color: '#F59E0B' },
        { label: 'Moyen (40-59)', count: candidats.filter(c => (c.score_global ?? 0) >= 40 && (c.score_global ?? 0) < 60).length, color: '#2563EB' },
        { label: 'Faible (<40)', count: candidats.filter(c => (c.score_global ?? 0) < 40).length, color: '#DC2626' },
      ]

      setStats({
        totalCandidats: candidats.length,
        totalCandidatures: candidatures.length,
        offresActives: offresRes.count ?? 0,
        scoreMoyen,
        topCandidats: [...candidats].sort((a, b) => (b.score_global ?? 0) - (a.score_global ?? 0)).slice(0, 5),
        repartitionStatuts: repartition,
        scoreDistribution: distribution,
      })
      setLoadingData(false)
    }
    load()
  }, [tenantId])

  if (loading || loadingData) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  if (!stats) return null

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
          <Bot size={22} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">MIAA Job</h1>
          <p className="text-xs text-[#64748B]">Tableau de bord Intelligence Artificielle — Recrutement</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Offres actives', value: stats.offresActives, icon: Target, color: '#F59E0B' },
          { label: 'Candidats analysés', value: stats.totalCandidats, icon: Users, color: '#2563EB' },
          { label: 'Candidatures', value: stats.totalCandidatures, icon: TrendingUp, color: '#16A34A' },
          { label: 'Score IA moyen', value: `${stats.scoreMoyen}/100`, icon: Star, color: '#8B5CF6' },
        ].map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#64748B]">{kpi.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                  <Icon size={15} style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">{kpi.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top candidats */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-[#F59E0B]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Top 5 candidats</h2>
          </div>
          {stats.topCandidats.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-6 text-center">Aucun candidat analysé</p>
          ) : (
            <div className="space-y-3">
              {stats.topCandidats.map((c, i) => {
                const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.email || 'Inconnu'
                const sc = c.score_global ?? 0
                const color = sc >= 70 ? '#16A34A' : sc >= 50 ? '#F59E0B' : '#DC2626'
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-base shrink-0 w-6 text-center">{medals[i]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{nom}</p>
                        <span className="text-xs font-bold ml-2 shrink-0" style={{ color }}>{sc}/100</span>
                      </div>
                      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${sc}%`, background: color }} />
                      </div>
                      {c.formation && (
                        <p className="text-[10px] text-[#94A3B8] mt-0.5 truncate">{c.formation}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4">Pipeline de recrutement</h2>
          {Object.keys(stats.repartitionStatuts).length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-6 text-center">Aucune candidature</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.repartitionStatuts).map(([statut, count]) => {
                const total = stats.totalCandidatures || 1
                const pct = Math.round((count / total) * 100)
                const c = STATUT_COLORS[statut] ?? '#94A3B8'
                return (
                  <div key={statut}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#64748B]">{STATUT_LABELS[statut] ?? statut}</span>
                      <span className="font-bold text-[#0F172A]">
                        {count} <span className="font-normal text-[#94A3B8]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Distribution scores */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
        <h2 className="text-sm font-bold text-[#0F172A] mb-4">Distribution des scores IA</h2>
        {stats.totalCandidats === 0 ? (
          <p className="text-xs text-[#94A3B8] text-center py-4">Aucun candidat analysé</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.scoreDistribution.map(d => (
              <div key={d.label} className="text-center p-3 rounded-xl border border-[#E2E8F0]">
                <p className="text-2xl font-bold mb-1" style={{ color: d.color }}>{d.count}</p>
                <p className="text-[10px] text-[#64748B] font-semibold">{d.label}</p>
                <div className="mt-2 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: stats.totalCandidats > 0 ? `${Math.round((d.count / stats.totalCandidats) * 100)}%` : '0%',
                    background: d.color,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
