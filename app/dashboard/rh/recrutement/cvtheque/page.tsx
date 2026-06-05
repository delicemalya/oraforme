'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Users, Loader2, Star, X, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Candidat {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  telephone: string | null
  score_global: number
  competences: string[] | null
  diplomes: string[] | null
  langues: string[] | null
  certifications: string[] | null
  annees_experience: number | null
  niveau_etudes: string | null
  cv_url: string | null
  statut: string
  created_at: string
  nb_candidatures?: number
}

function scoreCls(s: number) {
  if (s === 0) return 'bg-gray-100 text-gray-500'
  if (s >= 80) return 'bg-green-100 text-green-700'
  if (s >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}
function scoreCat(s: number) {
  if (s === 0) return 'Non scoré'
  if (s >= 90) return 'Exceptionnel'
  if (s >= 80) return 'Excellent'
  if (s >= 70) return 'Bon'
  if (s >= 60) return 'Moyen'
  return 'Faible'
}

const TABS = [
  { key: 'tous', label: 'Tous' },
  { key: 'talents', label: 'Talents (≥70)' },
  { key: 'potentiels', label: 'Potentiels (50-70)' },
  { key: 'autres', label: 'Autres' },
]

export default function CVtheque() {
  const { tenantId, loading: tl } = useTenant()
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [filtered, setFiltered] = useState<Candidat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('tous')
  const [selected, setSelected] = useState<Candidat | null>(null)
  const [history, setHistory] = useState<{ offre_titre: string; statut: string; created_at: string; score_ia: number }[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('candidats')
      .select('id, nom, prenom, email, telephone, score_global, competences, diplomes, langues, certifications, annees_experience, niveau_etudes, cv_url, statut, created_at')
      .eq('tenant_id', tenantId)
      .order('score_global', { ascending: false })
    setCandidats(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  useEffect(() => {
    let list = [...candidats]
    if (tab === 'talents') list = list.filter(c => c.score_global >= 70)
    else if (tab === 'potentiels') list = list.filter(c => c.score_global >= 50 && c.score_global < 70)
    else if (tab === 'autres') list = list.filter(c => c.score_global < 50)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        [c.nom, c.prenom].some(v => v?.toLowerCase().includes(q)) ||
        (c.competences ?? []).some(s => s.toLowerCase().includes(q)) ||
        (c.diplomes ?? []).some(s => s.toLowerCase().includes(q)) ||
        (c.langues ?? []).some(s => s.toLowerCase().includes(q))
      )
    }
    setFiltered(list)
  }, [candidats, search, tab])

  async function openFiche(c: Candidat) {
    setSelected(c)
    setHistory([])
    setHistLoading(true)
    const { data } = await supabase
      .from('candidatures')
      .select('statut, score_ia, created_at, offres_emploi(titre)')
      .eq('candidat_id', c.id)
      .order('created_at', { ascending: false })
    setHistory((data ?? []).map(d => ({
      offre_titre: (d.offres_emploi as unknown as { titre: string } | null)?.titre ?? '—',
      statut: d.statut, created_at: d.created_at, score_ia: d.score_ia ?? 0,
    })))
    setHistLoading(false)
  }

  function initiales(c: Candidat) {
    return [(c.prenom ?? '').charAt(0), (c.nom ?? '').charAt(0)].filter(Boolean).join('').toUpperCase() || '?'
  }

  if (tl || loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[#0F172A]">CVthèque</h1>
        <p className="text-xs text-[#64748B]">{candidats.length} candidat{candidats.length !== 1 ? 's' : ''} connu{candidats.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, compétence, diplôme, langue..."
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors" />
        </div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* LISTE */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
              <Users size={28} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm text-[#64748B]">Aucun candidat trouvé</p>
            </div>
          ) : (
            filtered.map(c => (
              <button key={c.id} onClick={() => openFiche(c)}
                className={`w-full bg-white rounded-xl border text-left p-4 shadow-sm hover:border-[#F59E0B]/50 hover:shadow-md transition-all ${selected?.id === c.id ? 'border-[#F59E0B] shadow-md' : 'border-[#E2E8F0]'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initiales(c)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">{[c.prenom, c.nom].filter(Boolean).join(' ') || 'Candidat'}</p>
                    <p className="text-[10px] text-[#64748B] truncate">{c.email ?? '—'}</p>
                    {(c.competences ?? []).length > 0 && (
                      <p className="text-[10px] text-[#94A3B8] truncate mt-0.5">{(c.competences ?? []).slice(0, 3).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {c.score_global > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreCls(c.score_global)}`}>
                        {c.score_global} · {scoreCat(c.score_global)}
                      </span>
                    )}
                    {c.score_global >= 70 && <Star size={11} className="text-[#F59E0B]" />}
                  </div>
                  <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* FICHE CANDIDAT */}
        {selected ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden sticky top-4 h-fit">
            <div className="flex items-center justify-between p-4 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-bold text-[#0F172A]">Fiche candidat</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg"><X size={14} className="text-[#64748B]" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {initiales(selected)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{[selected.prenom, selected.nom].filter(Boolean).join(' ') || 'Candidat'}</p>
                  <p className="text-xs text-[#64748B]">{selected.email ?? '—'}</p>
                  {selected.telephone && <p className="text-xs text-[#94A3B8]">{selected.telephone}</p>}
                </div>
              </div>

              {/* Score */}
              {selected.score_global > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold" style={{ color: selected.score_global >= 70 ? '#16A34A' : selected.score_global >= 50 ? '#F59E0B' : '#DC2626' }}>{selected.score_global}</p>
                    <p className="text-[10px] text-[#94A3B8]">/ 100</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">{scoreCat(selected.score_global)}</p>
                    {selected.annees_experience && <p className="text-[10px] text-[#64748B]">{selected.annees_experience} an{selected.annees_experience > 1 ? 's' : ''} d&apos;expérience</p>}
                    {selected.niveau_etudes && <p className="text-[10px] text-[#64748B]">{selected.niveau_etudes}</p>}
                  </div>
                </div>
              )}

              {/* Compétences */}
              {(selected.competences ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#64748B] mb-1.5">Compétences</p>
                  <div className="flex flex-wrap gap-1">
                    {(selected.competences ?? []).map(s => (
                      <span key={s} className="text-[10px] bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full border border-[#F59E0B]/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Diplômes + Langues */}
              <div className="grid grid-cols-2 gap-3">
                {(selected.diplomes ?? []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] mb-1.5">Diplômes</p>
                    <div className="space-y-0.5">{(selected.diplomes ?? []).map(d => <p key={d} className="text-[10px] text-[#0F172A]">• {d}</p>)}</div>
                  </div>
                )}
                {(selected.langues ?? []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] mb-1.5">Langues</p>
                    <div className="space-y-0.5">{(selected.langues ?? []).map(l => <p key={l} className="text-[10px] text-[#0F172A]">• {l}</p>)}</div>
                  </div>
                )}
              </div>

              {/* CV */}
              {selected.cv_url && (
                <a href={selected.cv_url} target="_blank" rel="noopener noreferrer"
                  className="block text-center py-2 px-4 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] rounded-lg transition-colors">
                  Voir le CV →
                </a>
              )}

              {/* Historique */}
              <div>
                <p className="text-[10px] font-bold text-[#64748B] mb-2">Historique des candidatures</p>
                {histLoading ? <Loader2 size={14} className="animate-spin text-[#F59E0B]" /> : history.length === 0 ? (
                  <p className="text-[10px] text-[#94A3B8]">Aucune candidature enregistrée</p>
                ) : (
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9] last:border-0">
                        <div>
                          <p className="text-[10px] font-semibold text-[#0F172A] truncate max-w-[150px]">{h.offre_titre}</p>
                          <p className="text-[9px] text-[#94A3B8]">{new Date(h.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {h.score_ia > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${scoreCls(h.score_ia)}`}>{h.score_ia}</span>}
                          <span className="text-[9px] text-[#64748B]">{h.statut}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm hidden lg:flex flex-col items-center justify-center">
            <Users size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#64748B]">Sélectionnez un candidat</p>
            <p className="text-xs text-[#94A3B8] mt-1">pour voir sa fiche complète</p>
          </div>
        )}
      </div>
    </div>
  )
}
