'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Loader2, ChevronDown, Plus, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Entretien {
  id: string
  date_entretien: string | null
  note_finale: number | null
  statut: string
  created_at: string
  candidatures: {
    id: string
    candidats: { nom: string | null; prenom: string | null; email: string | null } | null
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

export default function EntretiensPage() {
  const { tenantId, loading } = useTenant()
  const [entretiens, setEntretiens] = useState<Entretien[]>([])
  const [candidatureOptions, setCandidatureOptions] = useState<CandidatureOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [newCandidatureId, setNewCandidatureId] = useState('')
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoadingData(true)
    const [eRes, cRes] = await Promise.all([
      supabase
        .from('entretiens')
        .select('id,date_entretien,note_finale,statut,created_at,candidatures(id,candidats(nom,prenom,email),offres_emploi(titre))')
        .eq('tenant_id', tenantId)
        .order('date_entretien', { ascending: true }),
      supabase
        .from('candidatures')
        .select('id,candidats(nom,prenom),offres_emploi(titre)')
        .eq('tenant_id', tenantId)
        .in('statut', ['en_examen', 'entretien']),
    ])
    setEntretiens((eRes.data as unknown as Entretien[]) ?? [])
    setCandidatureOptions((cRes.data as unknown as CandidatureOption[]) ?? [])
    setLoadingData(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

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
    if (error) { alert('Erreur création entretien : ' + error.message); return }
    setShowForm(false); setNewCandidatureId(''); setNewDate('')
    load()
  }

  async function updateStatut(id: string, statut: string) {
    const { error } = await supabase.from('entretiens').update({ statut }).eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    load()
  }

  async function updateNote(id: string, note: number) {
    const { error } = await supabase.from('entretiens').update({ note_finale: note, statut: 'termine' }).eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    load()
  }

  const shown = filterStatut === 'all' ? entretiens : entretiens.filter(e => e.statut === filterStatut)

  if (loading || loadingData) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Entretiens</h1>
          <p className="text-xs text-[#64748B]">{entretiens.length} entretien{entretiens.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors"
        >
          <Plus size={13} /> Planifier
        </button>
      </div>

      {/* Nouveau form */}
      {showForm && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
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
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
              />
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
              filterStatut === s ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
            }`}>
            {s === 'all' ? 'Tous' : STATUT_LABELS[s]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8]">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun entretien {filterStatut !== 'all' ? STATUT_LABELS[filterStatut as Statut]?.toLowerCase() : 'planifié'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(e => {
            const cand = e.candidatures?.candidats
            const nom = cand ? [cand.prenom, cand.nom].filter(Boolean).join(' ') || cand.email || 'Inconnu' : 'Inconnu'
            const color = STATUT_COLORS[e.statut as Statut] ?? '#64748B'
            return (
              <div key={e.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-[#0F172A]">{nom}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color, background: `${color}15` }}>
                        {STATUT_LABELS[e.statut as Statut]}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">{e.candidatures?.offres_emploi?.titre ?? 'Offre inconnue'}</p>
                    {e.date_entretien && (
                      <p className="text-xs text-[#94A3B8] mt-1">
                        {new Date(e.date_entretien).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>

                  {e.statut !== 'termine' && e.statut !== 'annule' && (
                    <div className="relative shrink-0">
                      <select value={e.statut} onChange={ev => updateStatut(e.id, ev.target.value)}
                        className="text-[10px] border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#64748B] outline-none bg-white appearance-none pr-6">
                        {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                      </select>
                      <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                    </div>
                  )}
                </div>

                {e.statut === 'termine' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[#F1F5F9]">
                    <span className="text-xs text-[#64748B] shrink-0">Note finale :</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <button key={i} onClick={() => updateNote(e.id, i + 1)}
                          className="w-6 h-6 rounded text-[10px] font-bold transition-all"
                          style={
                            (e.note_finale ?? 0) >= i + 1
                              ? { background: '#F59E0B', color: 'white' }
                              : { background: '#F1F5F9', color: '#94A3B8' }
                          }
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    {e.note_finale !== null && (
                      <span className="text-sm font-bold text-[#F59E0B]">{e.note_finale}/10</span>
                    )}
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
