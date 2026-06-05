'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Loader2, AlertTriangle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Candidature {
  id: string
  score_ia: number
  statut: string
  est_doublon: boolean
  created_at: string
  offres_emploi: { titre: string } | null
  candidats: { nom: string | null; prenom: string | null; email: string | null } | null
}

interface Offre {
  id: string
  titre: string
}

const STATUTS = ['recu', 'en_examen', 'entretien', 'retenu', 'rejete'] as const
type Statut = typeof STATUTS[number]

const STATUT_LABELS: Record<Statut, string> = {
  recu: 'Reçu', en_examen: 'En examen', entretien: 'Entretien', retenu: 'Retenu', rejete: 'Rejeté',
}
const STATUT_COLORS: Record<Statut, string> = {
  recu: '#64748B', en_examen: '#2563EB', entretien: '#F59E0B', retenu: '#16A34A', rejete: '#DC2626',
}

export default function CandidaturesPage() {
  const { tenantId, loading } = useTenant()
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [offres, setOffres] = useState<Offre[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [filterOffre, setFilterOffre] = useState<string>('all')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoadingData(true)
    const [cRes, oRes] = await Promise.all([
      supabase
        .from('candidatures')
        .select('id,score_ia,statut,est_doublon,created_at,offres_emploi(titre),candidats(nom,prenom,email)')
        .eq('tenant_id', tenantId)
        .order('score_ia', { ascending: false }),
      supabase.from('offres_emploi').select('id,titre').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    setCandidatures((cRes.data as unknown as Candidature[]) ?? [])
    setOffres(oRes.data ?? [])
    setLoadingData(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function updateStatut(id: string, statut: string) {
    const { error } = await supabase.from('candidatures').update({ statut }).eq('id', id)
    if (error) { alert('Erreur mise à jour : ' + error.message); return }
    load()
  }

  const shown = candidatures.filter(c => {
    if (filterStatut !== 'all' && c.statut !== filterStatut) return false
    if (filterOffre !== 'all' && c.offres_emploi?.titre !== offres.find(o => o.id === filterOffre)?.titre) return false
    return true
  })

  if (loading || loadingData) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[#0F172A]">Candidatures</h1>
        <p className="text-xs text-[#64748B]">{candidatures.length} candidature{candidatures.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <select value={filterOffre} onChange={e => setFilterOffre(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#64748B] outline-none appearance-none pr-7">
            <option value="all">Toutes les offres</option>
            {offres.map(o => <option key={o.id} value={o.id}>{o.titre}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...STATUTS] as const).map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatut === s
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
              }`}>
              {s === 'all' ? 'Tous' : STATUT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8]">
          <Users size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune candidature pour le moment.</p>
          <p className="text-xs mt-1">Les candidatures apparaissent ici après analyse de CV dans la CVthèque.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Candidat', 'Offre', 'Score IA', 'Statut', 'Date', 'Doublon'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {shown.map(c => {
                  const nom = [c.candidats?.prenom, c.candidats?.nom].filter(Boolean).join(' ') || c.candidats?.email || 'Inconnu'
                  const color = STATUT_COLORS[c.statut as Statut] ?? '#64748B'
                  const scoreColor = c.score_ia >= 70 ? '#16A34A' : c.score_ia >= 50 ? '#F59E0B' : '#DC2626'
                  return (
                    <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: `${scoreColor}20`, color: scoreColor }}
                          >
                            {nom.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#0F172A]">{nom}</p>
                            {c.candidats?.email && <p className="text-[10px] text-[#94A3B8]">{c.candidats.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{c.offres_emploi?.titre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ color: scoreColor, background: `${scoreColor}18` }}>
                          {c.score_ia}/100
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.statut}
                          onChange={e => updateStatut(c.id, e.target.value)}
                          className="text-[10px] font-semibold border rounded px-1.5 py-0.5 outline-none bg-transparent"
                          style={{ borderColor: `${color}50`, color }}
                        >
                          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-[#94A3B8] whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.est_doublon && (
                          <span title="Doublon détecté">
                            <AlertTriangle size={13} className="text-[#F59E0B] mx-auto" />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
