'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Users, Loader2, X, Calendar, AlertTriangle, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Candidature {
  id: string
  created_at: string
  statut: string
  score_ia: number
  est_doublon: boolean
  rapport_ia: unknown
  candidat_id: string | null
  candidat_nom: string | null
  candidat_prenom: string | null
  offre_id: string | null
  offre_titre: string | null
}

interface RapportModal {
  loading: boolean
  candidatureId: string | null
  candidat: string
  offreTitre: string | null
  rapport: {
    forces: string[]
    faiblesses: string[]
    risques: string[]
    potentiel: string
    compatibilite_poste: number
    recommandation: string
    justification: string
    prediction_performance: string
    risque_depart: string
  } | null
  scoreDetail: {
    diplome: number; experience: number; competences_obligatoires: number
    competences_souhaitees: number; langues: number; certifications: number
    stabilite: number; total: number; categorie: string
  } | null
}

function scoreCls(s: number) {
  if (s === 0) return 'bg-gray-100 text-gray-500'
  if (s >= 80) return 'bg-green-100 text-green-700'
  if (s >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}
function scoreDot(s: number) {
  if (s === 0) return '⚪'
  if (s >= 80) return '🟢'
  if (s >= 60) return '🟡'
  return '🔴'
}
function scoreCat(s: number) {
  if (s === 0) return 'Non analysé'
  if (s >= 90) return 'Exceptionnel'
  if (s >= 80) return 'Excellent'
  if (s >= 70) return 'Bon'
  if (s >= 60) return 'Moyen'
  return 'Faible'
}

const STATUTS = ['tous', 'recu', 'en_examen', 'entretien', 'retenu', 'rejete']
const STATUT_LABELS: Record<string, string> = {
  tous: 'Tous', recu: 'Reçue', en_examen: 'En examen', entretien: 'Entretien', retenu: 'Retenu', rejete: 'Rejeté',
}
const STATUT_CLS: Record<string, string> = {
  recu: 'bg-gray-100 text-gray-600', en_examen: 'bg-blue-100 text-blue-700',
  entretien: 'bg-purple-100 text-purple-700', retenu: 'bg-green-100 text-green-700',
  rejete: 'bg-red-100 text-red-600',
}

export default function CandidaturesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tenantId, loading: tl } = useTenant()
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [offres, setOffres] = useState<{ id: string; titre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOffre, setFilterOffre] = useState(searchParams.get('offre') ?? 'tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterScore, setFilterScore] = useState('tous')
  const [modal, setModal] = useState<RapportModal>({ loading: false, candidatureId: null, candidat: '', offreTitre: null, rapport: null, scoreDetail: null })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const { data: off } = await supabase.from('offres_emploi').select('id, titre').eq('tenant_id', tenantId).order('titre')
    setOffres(off ?? [])

    let q = supabase.from('candidatures')
      .select('id, created_at, statut, score_ia, est_doublon, rapport_ia, candidat_id, candidats(nom, prenom), offres_emploi(id, titre)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filterOffre !== 'tous') q = q.eq('offre_id', filterOffre)
    if (filterStatut !== 'tous') q = q.eq('statut', filterStatut)

    const { data } = await q.limit(100)
    let rows: Candidature[] = (data ?? []).map(c => ({
      id: c.id, created_at: c.created_at, statut: c.statut, score_ia: c.score_ia ?? 0,
      est_doublon: c.est_doublon ?? false, rapport_ia: c.rapport_ia,
      candidat_id: c.candidat_id as string | null,
      candidat_nom: (c.candidats as unknown as { nom: string | null } | null)?.nom ?? null,
      candidat_prenom: (c.candidats as unknown as { prenom: string | null } | null)?.prenom ?? null,
      offre_id: (c.offres_emploi as unknown as { id: string } | null)?.id ?? null,
      offre_titre: (c.offres_emploi as unknown as { titre: string } | null)?.titre ?? null,
    }))

    if (filterScore !== 'tous') {
      rows = rows.filter(c => {
        if (filterScore === 'exceptionnel') return c.score_ia >= 90
        if (filterScore === 'excellent') return c.score_ia >= 80 && c.score_ia < 90
        if (filterScore === 'bon') return c.score_ia >= 70 && c.score_ia < 80
        if (filterScore === 'moyen') return c.score_ia >= 60 && c.score_ia < 70
        if (filterScore === 'faible') return c.score_ia > 0 && c.score_ia < 60
        if (filterScore === 'non_analyse') return c.score_ia === 0
        return true
      })
    }

    setCandidatures(rows)
    setLoading(false)
  }, [tenantId, filterOffre, filterStatut, filterScore])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  async function openRapport(c: Candidature) {
    const nom = [c.candidat_prenom, c.candidat_nom].filter(Boolean).join(' ') || 'Candidat'
    setModal({ loading: true, candidatureId: c.id, candidat: nom, offreTitre: c.offre_titre, rapport: null, scoreDetail: null })
    const res = await fetch(`/api/jobs/rapport-candidature?candidatureId=${c.id}`)
    const data = await res.json()
    setModal(m => ({ ...m, loading: false, rapport: data.rapport ?? null, scoreDetail: data.scoreDetail ?? null }))
  }

  function closeModal() {
    setModal({ loading: false, candidatureId: null, candidat: '', offreTitre: null, rapport: null, scoreDetail: null })
  }

  async function changerStatut(cId: string, statut: string) {
    await supabase.from('candidatures').update({ statut }).eq('id', cId)
    setCandidatures(prev => prev.map(c => c.id === cId ? { ...c, statut } : c))
  }

  if (tl) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Candidatures</h1>
          <p className="text-xs text-[#64748B]">{candidatures.length} résultat{candidatures.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* FILTRES */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-semibold text-[#64748B] mb-1 block">Offre</label>
          <select value={filterOffre} onChange={e => setFilterOffre(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#F59E0B]/60">
            <option value="tous">Toutes les offres</option>
            {offres.map(o => <option key={o.id} value={o.id}>{o.titre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[#64748B] mb-1 block">Statut</label>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#F59E0B]/60">
            {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[#64748B] mb-1 block">Score IA</label>
          <select value={filterScore} onChange={e => setFilterScore(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#F59E0B]/60">
            <option value="tous">Tous scores</option>
            <option value="exceptionnel">🟢 Exceptionnel (90+)</option>
            <option value="excellent">🟢 Excellent (80+)</option>
            <option value="bon">🟡 Bon (70+)</option>
            <option value="moyen">🟡 Moyen (60+)</option>
            <option value="faible">🔴 Faible (&lt;60)</option>
            <option value="non_analyse">⚪ Non analysé</option>
          </select>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div> : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {candidatures.length === 0 ? (
            <div className="text-center py-16">
              <Users size={28} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm text-[#64748B]">Aucune candidature trouvée</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B]">Candidat</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] hidden md:table-cell">Offre</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#64748B]">Score IA</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#64748B]">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {candidatures.map(c => (
                  <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0F172A]">
                        {[c.candidat_prenom, c.candidat_nom].filter(Boolean).join(' ') || 'Candidat'}
                        {c.est_doublon && <span className="ml-1.5 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><AlertTriangle size={8} />Doublon</span>}
                      </p>
                      <p className="text-[#94A3B8] mt-0.5">{new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] hidden md:table-cell truncate max-w-[180px]">{c.offre_titre ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${scoreCls(c.score_ia)}`}>
                        {scoreDot(c.score_ia)} {c.score_ia > 0 ? `${c.score_ia} · ${scoreCat(c.score_ia)}` : 'Non analysé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select value={c.statut}
                        onChange={e => changerStatut(c.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUT_CLS[c.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {Object.entries(STATUT_LABELS).filter(([k]) => k !== 'tous').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openRapport(c)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                          <FileText size={10} /> Rapport IA
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/rh/recrutement/entretiens?candidature=${c.id}`)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#8B5CF6] bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                          <Calendar size={10} /> Entretien
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL RAPPORT IA */}
      {modal.candidatureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Rapport IA — {modal.candidat}</h2>
                {modal.offreTitre && <p className="text-xs text-[#64748B] mt-0.5">{modal.offreTitre}</p>}
              </div>
              <button onClick={closeModal} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors"><X size={16} className="text-[#64748B]" /></button>
            </div>

            <div className="p-5">
              {modal.loading ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 size={28} className="animate-spin text-[#F59E0B] mb-3" />
                  <p className="text-xs text-[#64748B]">Analyse en cours par MIAA+...</p>
                </div>
              ) : !modal.rapport ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[#64748B]">Rapport non disponible — CV non encore analysé.</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Lancez d&apos;abord l&apos;analyse depuis la CVthèque.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Score + Recommandation */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-center">
                      <p className="text-3xl font-extrabold" style={{ color: (modal.scoreDetail?.total ?? 0) >= 70 ? '#16A34A' : (modal.scoreDetail?.total ?? 0) >= 50 ? '#F59E0B' : '#DC2626' }}>
                        {modal.scoreDetail?.total ?? '—'}
                      </p>
                      <p className="text-[10px] text-[#64748B]">/ 100 · {modal.scoreDetail?.categorie}</p>
                    </div>
                    <div className="flex-1">
                      <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                        modal.rapport.recommandation === 'Très recommandé' ? 'bg-green-100 text-green-700'
                        : modal.rapport.recommandation === 'Recommandé' ? 'bg-blue-100 text-blue-700'
                        : modal.rapport.recommandation === 'À considérer' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{modal.rapport.recommandation}</span>
                      <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{modal.rapport.justification}</p>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  {modal.scoreDetail && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Diplôme', pts: modal.scoreDetail.diplome, max: 20 },
                        { label: 'Expérience', pts: modal.scoreDetail.experience, max: 20 },
                        { label: 'Compétences', pts: modal.scoreDetail.competences_obligatoires, max: 25 },
                        { label: 'Langues', pts: modal.scoreDetail.langues, max: 10 },
                      ].map(({ label, pts, max }) => (
                        <div key={label} className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                          <p className="text-sm font-bold text-[#0F172A]">{pts}<span className="text-[10px] text-[#94A3B8]">/{max}</span></p>
                          <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
                          <div className="h-1 bg-[#E2E8F0] rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${(pts / max) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Forces */}
                    <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                      <p className="text-xs font-bold text-green-800 mb-2">Forces</p>
                      <ul className="space-y-1">
                        {(modal.rapport.forces ?? []).map((f, i) => <li key={i} className="text-xs text-green-700 flex items-start gap-1.5"><span className="shrink-0 mt-0.5">✓</span>{f}</li>)}
                      </ul>
                    </div>
                    {/* Faiblesses */}
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                      <p className="text-xs font-bold text-amber-800 mb-2">Points d&apos;amélioration</p>
                      <ul className="space-y-1">
                        {(modal.rapport.faiblesses ?? []).map((f, i) => <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5"><span className="shrink-0 mt-0.5">△</span>{f}</li>)}
                      </ul>
                    </div>
                    {/* Risques */}
                    <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                      <p className="text-xs font-bold text-red-800 mb-2">Risques</p>
                      <ul className="space-y-1">
                        {(modal.rapport.risques ?? []).map((r, i) => <li key={i} className="text-xs text-red-700 flex items-start gap-1.5"><span className="shrink-0 mt-0.5">⚠</span>{r}</li>)}
                      </ul>
                    </div>
                    {/* Prédictions */}
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 mb-1">Potentiel</p>
                        <p className="text-xs text-blue-700">{modal.rapport.potentiel}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 mb-1">Performance prévue</p>
                        <p className="text-xs text-blue-700">{modal.rapport.prediction_performance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 mb-1">Risque de départ</p>
                        <p className="text-xs text-blue-700">{modal.rapport.risque_depart}</p>
                      </div>
                    </div>
                  </div>

                  {/* Compatibilité */}
                  <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#0F172A]">Compatibilité avec le poste</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${modal.rapport.compatibilite_poste ?? 0}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#0F172A]">{modal.rapport.compatibilite_poste ?? 0}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
