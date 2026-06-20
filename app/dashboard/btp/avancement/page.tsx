'use client'

import { useState, useEffect, useCallback } from 'react'

import Link from 'next/link'
import { HardHat, RefreshCw, Loader2, Plus, X, CheckCircle, Circle, Clock, AlertTriangle } from 'lucide-react'

const PHASES_DEFAUT = ['Fondations','Gros œuvre','Charpente / Toiture','Maçonnerie / Plâtrerie','Électricité','Plomberie','Menuiserie','Revêtements','Finitions','Livraison']

const PHASE_STATUT_ICONS: Record<string, React.ReactNode> = {
  a_faire:    <Circle size={12} className="text-[#94A3B8]" />,
  en_cours:   <Clock size={12} className="text-blue-500" />,
  termine:    <CheckCircle size={12} className="text-green-500" />,
  bloque:     <AlertTriangle size={12} className="text-red-500" />,
}

interface Chantier { id: string; nom: string; client_nom: string | null; avancement_pct: number; statut: string }
interface Phase {
  id: string; chantier_id: string; nom: string; ordre: number; avancement_pct: number
  statut: 'a_faire' | 'en_cours' | 'termine' | 'bloque'; date_prevue: string | null; notes: string | null
  btp_chantiers?: { nom: string; statut: string; client_nom: string | null }
}

function ModalPhase({ chantier, onClose, onSaved }: { chantier: Chantier; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nom: '', ordre: '1', date_prevue: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [preset, setPreset] = useState('')

  async function handleSave() {
    const nomFinal = preset || form.nom
    if (!nomFinal) return
    setSaving(true)
    await fetch('/api/btp/phases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chantier_id: chantier.id, nom: nomFinal, ordre: parseInt(form.ordre) || 1, date_prevue: form.date_prevue || null, notes: form.notes || null }),
    })
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-black text-[14px]">Nouvelle phase — {chantier.nom}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Phase standard</label>
            <select value={preset} onChange={e => setPreset(e.target.value)} className={I}>
              <option value="">Choisir une phase...</option>
              {PHASES_DEFAUT.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Ou saisir un nom personnalisé</label>
            <input value={form.nom} onChange={e => { setForm(f => ({ ...f, nom: e.target.value })); setPreset('') }} className={I} placeholder="Ex: Voirie et Réseaux Divers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Ordre</label>
              <input type="number" min="1" value={form.ordre} onChange={e => setForm(f => ({ ...f, ordre: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Date prévue</label>
              <input type="date" value={form.date_prevue} onChange={e => setForm(f => ({ ...f, date_prevue: e.target.value }))} className={I} />
            </div>
          </div>
          <button onClick={handleSave} disabled={!preset && !form.nom || saving}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter la phase
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BTPAvancementPage() {
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [phases,    setPhases]    = useState<Phase[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<string | null>(null)
  const [modal,     setModal]     = useState<Chantier | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rc, rp] = await Promise.all([
      fetch('/api/btp/chantiers').then(r => r.json()),
      fetch('/api/btp/phases').then(r => r.json()),
    ])
    const ch: Chantier[] = (rc.data ?? []).filter((c: Chantier) => c.statut !== 'annule')
    setChantiers(ch)
    setPhases(rp.data ?? [])
    if (!selected && ch.length > 0) setSelected(ch[0].id)
    setLoading(false)
  }, [selected])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function updatePhase(id: string, updates: Partial<Phase>) {
    await fetch('/api/btp/phases', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    load()
  }

  async function deletePhase(id: string) {
    if (!confirm('Supprimer cette phase ?')) return
    await fetch(`/api/btp/phases?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function syncAvancement(chantier_id: string, phases_list: Phase[]) {
    const avg = phases_list.length === 0 ? 0 : Math.round(phases_list.reduce((s, p) => s + p.avancement_pct, 0) / phases_list.length)
    await fetch('/api/btp/chantiers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: chantier_id, avancement_pct: avg }) })
  }

  const selectedChantier = chantiers.find(c => c.id === selected)
  const selectedPhases   = phases.filter(p => p.chantier_id === selected).sort((a, b) => a.ordre - b.ordre)

  const STATUT_COLORS: Record<string, string> = { planifie: '#94A3B8', en_cours: '#2563EB', termine: '#16A34A', suspendu: '#F59E0B', annule: '#DC2626' }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/btp" className="text-[#64748B] text-[13px]">← BTP</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <HardHat size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black">Avancement par phases</h1>
            </div>
          </div>
          <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-[#94A3B8]"><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

          {/* Sidebar chantiers */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Chantiers actifs</p>
              </div>
              {chantiers.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#94A3B8]">Aucun chantier</div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {chantiers.map(c => {
                    const ph = phases.filter(p => p.chantier_id === c.id)
                    const pct = ph.length > 0 ? Math.round(ph.reduce((s, p) => s + p.avancement_pct, 0) / ph.length) : c.avancement_pct
                    return (
                      <button key={c.id} onClick={() => setSelected(c.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-[#F8FAFC] transition-colors ${selected === c.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
                        <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{c.nom}</p>
                        {c.client_nom && <p className="text-[10px] text-[#94A3B8] mt-0.5">{c.client_nom}</p>}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#16A34A' : '#2563EB' }} />
                          </div>
                          <span className="text-[10px] font-black text-[#64748B]">{pct}%</span>
                        </div>
                        <div className="mt-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: STATUT_COLORS[c.statut] + '20', color: STATUT_COLORS[c.statut] }}>{c.statut}</span>
                          <span className="ml-2 text-[10px] text-[#94A3B8]">{ph.length} phase{ph.length > 1 ? 's' : ''}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail phases */}
          <div className="flex-1">
            {!selectedChantier ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
                <HardHat size={40} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-[#64748B] text-[13px]">Sélectionner un chantier</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#0F172A]">{selectedChantier.nom}</h2>
                    <p className="text-[12px] text-[#64748B]">{selectedPhases.length} phase{selectedPhases.length > 1 ? 's' : ''} configurée{selectedPhases.length > 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setModal(selectedChantier)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-[12px] font-bold hover:bg-blue-700">
                    <Plus size={13} /> Ajouter phase
                  </button>
                </div>

                {selectedPhases.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
                    <p className="text-[#64748B] text-[13px] mb-3">Aucune phase définie pour ce chantier</p>
                    <button onClick={() => setModal(selectedChantier)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[12px] font-bold">
                      <Plus size={12} className="inline mr-1" /> Créer les phases
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPhases.map((p, _i) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[11px] font-black text-[#64748B]">{p.ordre}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="font-bold text-[13px] text-[#0F172A]">{p.nom}</p>
                              <div className="flex items-center gap-1.5">
                                {PHASE_STATUT_ICONS[p.statut]}
                                <select value={p.statut}
                                  onChange={async e => {
                                    const newStatut = e.target.value as Phase['statut']
                                    const newPct = newStatut === 'termine' ? 100 : newStatut === 'a_faire' ? 0 : p.avancement_pct
                                    await updatePhase(p.id, { statut: newStatut, avancement_pct: newPct })
                                    const updated = selectedPhases.map(ph => ph.id === p.id ? { ...ph, statut: newStatut, avancement_pct: newPct } : ph)
                                    await syncAvancement(selectedChantier.id, updated)
                                  }}
                                  className="text-[11px] border border-[#E2E8F0] rounded-lg px-2 py-1 bg-white">
                                  <option value="a_faire">À faire</option>
                                  <option value="en_cours">En cours</option>
                                  <option value="termine">Terminé</option>
                                  <option value="bloque">Bloqué</option>
                                </select>
                                <button onClick={() => deletePhase(p.id)} className="p-1 text-[#DC2626] hover:bg-red-50 rounded">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${p.avancement_pct}%`, background: p.avancement_pct === 100 ? '#16A34A' : p.statut === 'bloque' ? '#DC2626' : '#2563EB' }} />
                              </div>
                              <input type="range" min="0" max="100" step="5" value={p.avancement_pct}
                                onChange={async e => {
                                  const v = parseInt(e.target.value)
                                  const ns = (v === 100 ? 'termine' : v === 0 ? 'a_faire' : 'en_cours') as Phase['statut']
                                  await updatePhase(p.id, { avancement_pct: v, statut: ns })
                                  const updated = selectedPhases.map(ph => ph.id === p.id ? { ...ph, avancement_pct: v, statut: ns } : ph)
                                  await syncAvancement(selectedChantier.id, updated)
                                }}
                                className="w-28 accent-blue-600" />
                              <span className="text-[12px] font-black w-9 text-right text-[#0F172A]">{p.avancement_pct}%</span>
                            </div>
                            {p.date_prevue && (
                              <p className="mt-1 text-[10px] text-[#94A3B8]">
                                Date prévue : {new Date(p.date_prevue).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Récap avancement global */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-black text-blue-800">Avancement global du chantier</p>
                        <p className="text-[20px] font-black text-blue-700">
                          {selectedPhases.length > 0 ? Math.round(selectedPhases.reduce((s, p) => s + p.avancement_pct, 0) / selectedPhases.length) : 0}%
                        </p>
                      </div>
                      <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                        <div className="h-full rounded-full transition-all bg-gradient-to-r from-blue-500 to-indigo-500"
                          style={{ width: `${selectedPhases.length > 0 ? Math.round(selectedPhases.reduce((s, p) => s + p.avancement_pct, 0) / selectedPhases.length) : 0}%` }} />
                      </div>
                      <div className="flex gap-4 mt-3 text-[11px]">
                        <span className="text-green-700"><CheckCircle size={10} className="inline mr-1" />{selectedPhases.filter(p => p.statut === 'termine').length} terminées</span>
                        <span className="text-blue-700"><Clock size={10} className="inline mr-1" />{selectedPhases.filter(p => p.statut === 'en_cours').length} en cours</span>
                        <span className="text-red-700"><AlertTriangle size={10} className="inline mr-1" />{selectedPhases.filter(p => p.statut === 'bloque').length} bloquées</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {modal && <ModalPhase chantier={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}
