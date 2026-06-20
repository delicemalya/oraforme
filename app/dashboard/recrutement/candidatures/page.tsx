'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Users, Search, Loader2, Star,
  ArrowUpDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { Suspense } from 'react'

interface Candidature {
  id: string; created_at: string; statut: string; score_ia: number; est_doublon: boolean
  candidat_prenom: string | null; candidat_nom: string | null; candidat_email: string | null
  offre_titre: string | null; offre_id: string | null
}

function scoreCls(s: number) {
  if (s >= 80) return 'bg-green-100 text-green-700'
  if (s >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const STATUTS: Array<{ key: string; label: string; color: string; bg: string }> = [
  { key: 'all',       label: 'Toutes',    color: '#475569', bg: '#F1F5F9' },
  { key: 'nouveau',   label: 'Nouveaux',  color: '#2563EB', bg: '#EFF6FF' },
  { key: 'en_cours',  label: 'En cours',  color: '#D97706', bg: '#FFFBEB' },
  { key: 'entretien', label: 'Entretien', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'retenu',    label: 'Retenus',   color: '#16A34A', bg: '#F0FDF4' },
  { key: 'refuse',    label: 'Refusés',   color: '#DC2626', bg: '#FEF2F2' },
]

function CandidaturesContent() {
  const searchParams = useSearchParams()
  const offreId = searchParams.get('offre')
  const { tenantId, loading: tl } = useTenant()
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filtreStatut, setFiltreStatut] = useState('all')
  const [sortBy, setSortBy]     = useState<'date' | 'score'>('date')

  async function load() {
    if (!tenantId) return
    setLoading(true)
    let q = supabase
      .from('candidatures')
      .select('id, created_at, statut, score_ia, est_doublon, candidats(nom, prenom, email), offres_emploi(id, titre)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (offreId) q = q.eq('offre_id', offreId)
    const { data } = await q
    setCandidatures((data ?? []).map(c => ({
      id: c.id, created_at: c.created_at, statut: c.statut,
      score_ia: c.score_ia ?? 0, est_doublon: c.est_doublon ?? false,
      candidat_prenom: (c.candidats as unknown as { prenom: string | null } | null)?.prenom ?? null,
      candidat_nom:    (c.candidats as unknown as { nom: string | null } | null)?.nom ?? null,
      candidat_email:  (c.candidats as unknown as { email: string | null } | null)?.email ?? null,
      offre_titre:     (c.offres_emploi as unknown as { titre: string } | null)?.titre ?? null,
      offre_id:        (c.offres_emploi as unknown as { id: string } | null)?.id ?? null,
    })))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tenantId) void load() }, [tenantId, offreId])

  async function updateStatut(id: string, statut: string) {
    await supabase.from('candidatures').update({ statut }).eq('id', id)
    setCandidatures(prev => prev.map(c => c.id === id ? { ...c, statut } : c))
  }

  const filtered = candidatures
    .filter(c => filtreStatut === 'all' || c.statut === filtreStatut)
    .filter(c => !search || [c.candidat_prenom, c.candidat_nom, c.offre_titre, c.candidat_email]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'score' ? b.score_ia - a.score_ia : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (tl) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Candidatures</h1>
          <p className="text-[11px] text-[#64748B]">
            {offreId ? 'Candidatures pour cette offre' : 'Pipeline complet — scoring IA'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(s => s === 'date' ? 'score' : 'date')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
          >
            <ArrowUpDown size={13} />
            {sortBy === 'date' ? 'Trier par score' : 'Trier par date'}
          </button>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap gap-2">
        {STATUTS.map(s => {
          const count = s.key === 'all' ? candidatures.length : candidatures.filter(c => c.statut === s.key).length
          return (
            <button
              key={s.key}
              onClick={() => setFiltreStatut(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all ${filtreStatut === s.key ? 'shadow-sm' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
              style={filtreStatut === s.key ? { background: s.bg, color: s.color, borderColor: s.color + '40' } : {}}
            >
              {s.label}
              <span className="text-[10px] font-bold opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un candidat, une offre..."
          className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <Users size={32} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#64748B]">Aucune candidature</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="divide-y divide-[#F1F5F9]">
            {filtered.map(c => {
              const st = STATUTS.find(s => s.key === c.statut) ?? STATUTS[1]
              return (
                <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-[#FAFAFA] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0">
                    <Users size={14} className="text-[#64748B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] flex items-center gap-2 flex-wrap">
                      {[c.candidat_prenom, c.candidat_nom].filter(Boolean).join(' ') || 'Candidat anonyme'}
                      {c.est_doublon && (
                        <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Doublon</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {c.offre_titre ?? '—'}
                      {c.candidat_email ? ` · ${c.candidat_email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {c.score_ia > 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${scoreCls(c.score_ia)}`}>
                        <Star size={9} /> {c.score_ia}
                      </span>
                    )}
                    <select
                      value={c.statut}
                      onChange={e => updateStatut(c.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer"
                      style={{ background: st.bg, color: st.color, borderColor: st.color + '40' }}
                    >
                      {STATUTS.filter(s => s.key !== 'all').map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#CBD5E1] hidden sm:inline">
                      {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CandidaturesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>}>
      <CandidaturesContent />
    </Suspense>
  )
}
