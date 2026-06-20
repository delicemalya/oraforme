'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Search, Loader2, UserRound, Sparkles, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Candidat {
  id: string; nom: string | null; prenom: string | null; email: string | null
  score_global: number; competences: string[] | null; created_at: string
  cv_text: string | null; nb_candidatures?: number
}

function scoreCls(s: number) {
  if (s >= 80) return { bg: '#F0FDF4', color: '#16A34A' }
  if (s >= 60) return { bg: '#FFFBEB', color: '#D97706' }
  if (s > 0)   return { bg: '#FEF2F2', color: '#DC2626' }
  return { bg: '#F1F5F9', color: '#94A3B8' }
}

export default function CVtheque() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score')
  const [selected, setSelected] = useState<Candidat | null>(null)

  async function load() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('candidats')
      .select('id, nom, prenom, email, score_global, competences, created_at, cv_text')
      .eq('tenant_id', tenantId)
      .order('score_global', { ascending: false })
      .limit(100)
    if (data && data.length > 0) {
      const ids = data.map(c => c.id)
      const { data: counts } = await supabase
        .from('candidatures')
        .select('candidat_id')
        .in('candidat_id', ids)
        .eq('tenant_id', tenantId)
      const countMap: Record<string, number> = {}
      for (const c of counts ?? []) countMap[c.candidat_id] = (countMap[c.candidat_id] ?? 0) + 1
      setCandidats(data.map(c => ({ ...c, nb_candidatures: countMap[c.id] ?? 0 })))
    } else {
      setCandidats([])
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tenantId) void load() }, [tenantId])

  const filtered = candidats
    .filter(c => !search || [c.prenom, c.nom, c.email, ...(c.competences ?? [])].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'score' ? b.score_global - a.score_global : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (tl) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">CV-thèque</h1>
          <p className="text-[11px] text-[#64748B]">{candidats.length} talent{candidats.length !== 1 ? 's' : ''} dans votre vivier</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/miaa?context=recrutement')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white rounded-xl text-[12px] font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Sparkles size={13} /> MIAA+ Job
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, compétence..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
          />
        </div>
        <button
          onClick={() => setSortBy(s => s === 'score' ? 'date' : 'score')}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
        >
          <Filter size={13} />
          {sortBy === 'score' ? 'Par score' : 'Par date'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <UserRound size={32} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#64748B]">Aucun candidat dans la CV-thèque</p>
          <p className="text-xs text-[#94A3B8] mt-1">Les CVs analysés par MIAA+ apparaîtront ici</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const sc = scoreCls(c.score_global)
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-[#F59E0B]/40"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center shrink-0">
                    <UserRound size={18} className="text-[#F59E0B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#0F172A] truncate">
                      {[c.prenom, c.nom].filter(Boolean).join(' ') || 'Candidat'}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] truncate">{c.email ?? '—'}</p>
                  </div>
                  {c.score_global > 0 ? (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg" style={{ background: sc.bg }}>
                      <Star size={10} style={{ color: sc.color }} />
                      <span className="text-[11px] font-bold" style={{ color: sc.color }}>{c.score_global}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#94A3B8] shrink-0">Non analysé</span>
                  )}
                </div>
                {(c.competences ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(c.competences ?? []).slice(0, 4).map(comp => (
                      <span key={comp} className="text-[9px] font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded-md">
                        {comp}
                      </span>
                    ))}
                    {(c.competences ?? []).length > 4 && (
                      <span className="text-[9px] text-[#94A3B8]">+{(c.competences ?? []).length - 4}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F1F5F9]">
                  <p className="text-[10px] text-[#94A3B8]">
                    {c.nb_candidatures ?? 0} candidature{(c.nb_candidatures ?? 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-[#CBD5E1]">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fiche candidat */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#0F172A]">
                {[selected.prenom, selected.nom].filter(Boolean).join(' ') || 'Candidat'}
              </h2>
              <button onClick={() => setSelected(null)} className="text-[#94A3B8] hover:text-[#374151] text-xl font-bold">×</button>
            </div>
            {selected.email && <p className="text-[12px] text-[#64748B]">{selected.email}</p>}
            {selected.score_global > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: scoreCls(selected.score_global).bg }}>
                <Star size={16} style={{ color: scoreCls(selected.score_global).color }} />
                <span className="text-[14px] font-bold" style={{ color: scoreCls(selected.score_global).color }}>
                  Score MIAA+ : {selected.score_global}/100
                </span>
              </div>
            )}
            {(selected.competences ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-2">Compétences</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.competences ?? []).map(comp => (
                    <span key={comp} className="text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] px-2 py-0.5 rounded-full">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selected.cv_text && (
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-2">Extrait CV</p>
                <p className="text-[12px] text-[#64748B] leading-relaxed bg-[#F8FAFC] rounded-xl p-3">
                  {selected.cv_text.slice(0, 500)}{selected.cv_text.length > 500 ? '…' : ''}
                </p>
              </div>
            )}
            <button
              onClick={() => { setSelected(null); router.push('/dashboard/recrutement/candidatures') }}
              className="w-full py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706]"
            >
              Voir ses candidatures
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
