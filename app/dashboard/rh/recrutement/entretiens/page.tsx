'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Loader2, ChevronDown, Plus, Check, X, Brain, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import Link from 'next/link'

interface Entretien {
  id: string
  date_entretien: string | null
  note_finale: number | null
  statut: string
  questions_ia: unknown
  rapport_prediction: { recommandation?: string } | null
  created_at: string
  candidatures: {
    id: string
    candidats: { nom: string | null; prenom: string | null; email: string | null; score_global: number } | null
    offres_emploi: { titre: string } | null
  } | null
}

interface CandidatureOption {
  id: string
  candidats: { nom: string | null; prenom: string | null } | null
  offres_emploi: { titre: string } | null
}

const STATUTS = ['planifie', 'en_cours', 'termine', 'annule'] as const
type Statut = typeof STATUTS[number]
const STATUT_LABELS: Record<Statut, string> = { planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé' }
const STATUT_COLORS: Record<Statut, string> = { planifie: '#2563EB', en_cours: '#F59E0B', termine: '#16A34A', annule: '#DC2626' }
const RECO_COLORS: Record<string, string> = { 'Embaucher': '#16A34A', "Liste d'attente": '#F59E0B', 'Rejeter': '#DC2626' }

export default function EntretiensPage() {
  const { tenantId } = useTenant()
  const [entretiens, setEntretiens] = useState<Entretien[]>([])
  const [candidatureOptions, setCandidatureOptions] = useState<CandidatureOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [newCandidatureId, setNewCandidatureId] = useState('')
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [eRes, cRes] = await Promise.all([
      supabase
        .from('entretiens')
        .select('id,date_entretien,note_finale,statut,questions_ia,rapport_prediction,created_at,candidatures(id,candidats(nom,prenom,email,score_global),offres_emploi(titre))')
        .eq('tenant_id', tenantId)
        .order('date_entretien', { ascending: true }),
      supabase
        .from('candidatures')
        .select('id,candidats(nom,prenom),offres_emploi(titre)')
        .eq('tenant_id', tenantId)
        .in('statut', ['en_examen', 'entretien', 'recu']),
    ])
    setEntretiens((eRes.data as unknown as Entretien[]) ?? [])
    setCandidatureOptions((cRes.data as unknown as CandidatureOption[]) ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  async function handleCreate() {
    if (!tenantId || !newCandidatureId) return
    setSaving(true)
    const { error } = await supabase.from('entretiens').insert({
      tenant_id: tenantId,
      candidature_id: newCandidatureId,
      date_entretien: newDate || null,
      statut: 'planifie',
    })
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setShowForm(false); setNewCandidatureId(''); setNewDate('')
    void load()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('entretiens').update({ statut }).eq('id', id)
    void load()
  }

  const shown = filterStatut === 'all' ? entretiens : entretiens.filter(e => e.statut === filterStatut)

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Entretiens IA</h1>
          <p className="text-xs text-[#64748B]">{entretiens.length} entretien{entretiens.length !== 1 ? 's' : ''} · {entretiens.filter(e => e.questions_ia).length} préparés par IA</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors shadow-sm"
        >
          <Plus size={13} /> Planifier
        </button>
      </div>

      {/* Nouveau form */}
      {showForm && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#0F172A]">Planifier un entretien</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Candidature <span className="text-[#DC2626]">*</span></label>
              <div className="relative">
                <select value={newCandidatureId} onChange={e => setNewCandidatureId(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none appearance-none pr-8">
                  <option value="">Choisir une candidature...</option>
                  {candidatureOptions.map(c => {
                    const nom = [c.candidats?.prenom, c.candidats?.nom].filter(Boolean).join(' ') || 'Inconnu'
                    return <option key={c.id} value={c.id}>{nom} — {c.offres_emploi?.titre ?? 'Offre inconnue'}</option>
                  })}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Date et heure</label>
              <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setNewCandidatureId(''); setNewDate('') }}
              className="px-4 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors">
              <X size={12} className="inline mr-1" />Annuler
            </button>
            <button onClick={handleCreate} disabled={saving || !newCandidatureId}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#F59E0B] text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-[#E09000] transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'Création...' : 'Planifier'}
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...STATUTS] as const).map(s => (
          <button key={s} onClick={() => setFilterStatut(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatut === s ? 'bg-[#F59E0B] text-white shadow-sm' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
            }`}>
            {s === 'all' ? `Tous (${entretiens.length})` : `${STATUT_LABELS[s]} (${entretiens.filter(e => e.statut === s).length})`}
          </button>
        ))}
      </div>

      {/* Liste */}
      {shown.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#E2E8F0]">
          <Calendar size={36} className="mx-auto mb-3 text-[#CBD5E1]" />
          <p className="text-sm text-[#64748B]">Aucun entretien {filterStatut !== 'all' ? STATUT_LABELS[filterStatut as Statut]?.toLowerCase() : 'planifié'}.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Planifiez un entretien depuis une candidature.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(e => {
            const cand = e.candidatures?.candidats
            const nom = cand ? [cand.prenom, cand.nom].filter(Boolean).join(' ') || cand.email || 'Inconnu' : 'Inconnu'
            const color = STATUT_COLORS[e.statut as Statut] ?? '#64748B'
            const reco = e.rapport_prediction?.recommandation
            const hasQuestions = !!e.questions_ia
            return (
              <div key={e.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-[#0F172A] truncate">{nom}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ color, background: `${color}15` }}>
                        {STATUT_LABELS[e.statut as Statut]}
                      </span>
                      {hasQuestions && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                          IA prête
                        </span>
                      )}
                      {reco && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ color: RECO_COLORS[reco] ?? '#64748B', background: `${RECO_COLORS[reco] ?? '#64748B'}15` }}>
                          {reco}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B]">{e.candidatures?.offres_emploi?.titre ?? 'Offre inconnue'}</p>
                    {e.date_entretien && (
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        {new Date(e.date_entretien).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                    {e.note_finale !== null && e.statut === 'termine' && (
                      <p className="text-[11px] text-[#F59E0B] font-bold mt-0.5">Score entretien : {e.note_finale}/10</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {e.statut !== 'annule' && (
                      <Link
                        href={`/dashboard/rh/recrutement/entretiens/${e.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Brain size={11} />
                        {hasQuestions ? 'Ouvrir' : 'Préparer IA'}
                      </Link>
                    )}
                    {e.statut !== 'termine' && e.statut !== 'annule' && (
                      <div className="relative">
                        <select value={e.statut} onChange={ev => updateStatut(e.id, ev.target.value)}
                          className="text-[10px] border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[#64748B] outline-none bg-white appearance-none pr-5">
                          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                        </select>
                        <ChevronDown size={9} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Barre de score */}
                {e.statut === 'termine' && e.note_finale !== null && (
                  <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#F59E0B] transition-all"
                        style={{ width: `${(e.note_finale / 10) * 100}%` }} />
                    </div>
                    <Link href={`/dashboard/rh/recrutement/entretiens/${e.id}`}
                      className="text-[10px] text-[#64748B] hover:text-[#F59E0B] flex items-center gap-1 transition-colors">
                      Voir rapport <ArrowRight size={10} />
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
