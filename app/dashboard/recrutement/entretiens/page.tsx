'use client'

import { useState, useEffect } from 'react'
import {
  Calendar, Plus, Loader2, Video, Phone, MapPin,
  CheckCircle, Clock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Entretien {
  id: string; date_heure: string; lieu: string | null; type: string; statut: string; notes: string | null
  candidat_prenom: string | null; candidat_nom: string | null; offre_titre: string | null
}

const TYPE_CONFIG: Record<string, { icon: typeof Video; label: string; color: string }> = {
  presentiel: { icon: MapPin,  label: 'Présentiel', color: '#16A34A' },
  visio:      { icon: Video,   label: 'Visio',      color: '#2563EB' },
  telephone:  { icon: Phone,   label: 'Téléphone',  color: '#7C3AED' },
}
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planifie:  { label: 'Planifié',  color: '#2563EB', bg: '#EFF6FF' },
  effectue:  { label: 'Effectué',  color: '#16A34A', bg: '#F0FDF4' },
  annule:    { label: 'Annulé',    color: '#DC2626', bg: '#FEF2F2' },
  reporte:   { label: 'Reporté',   color: '#D97706', bg: '#FFFBEB' },
}

export default function EntretiensPage() {
  const { tenantId, loading: tl } = useTenant()
  const [entretiens, setEntretiens] = useState<Entretien[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filtre, setFiltre] = useState<'tous' | 'planifie' | 'effectue'>('planifie')
  const [form, setForm] = useState({
    candidat_nom_libre: '', offre_titre_libre: '',
    date_heure: '', lieu: '', type: 'presentiel', notes: '',
  })
  const [saving, setSaving] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tenantId) void load() }, [tenantId])

  async function load() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('entretiens')
      .select('id, date_heure, lieu, type, statut, notes, candidats(nom, prenom), offres_emploi(titre)')
      .eq('tenant_id', tenantId)
      .order('date_heure', { ascending: true })
      .limit(50)
    setEntretiens((data ?? []).map(e => ({
      id: e.id, date_heure: e.date_heure, lieu: e.lieu, type: e.type ?? 'presentiel',
      statut: e.statut ?? 'planifie', notes: e.notes,
      candidat_prenom: (e.candidats as unknown as { prenom: string | null } | null)?.prenom ?? null,
      candidat_nom:    (e.candidats as unknown as { nom: string | null } | null)?.nom ?? null,
      offre_titre:     (e.offres_emploi as unknown as { titre: string } | null)?.titre ?? null,
    })))
    setLoading(false)
  }

  async function saveEntretien() {
    if (!tenantId || !form.date_heure) return
    setSaving(true)
    await supabase.from('entretiens').insert({
      tenant_id:  tenantId,
      date_heure: form.date_heure,
      lieu:       form.lieu || null,
      type:       form.type,
      statut:     'planifie',
      notes:      form.notes || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ candidat_nom_libre: '', offre_titre_libre: '', date_heure: '', lieu: '', type: 'presentiel', notes: '' })
    void load()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('entretiens').update({ statut }).eq('id', id).eq('tenant_id', tenantId)
    setEntretiens(prev => prev.map(e => e.id === id ? { ...e, statut } : e))
  }

  const filtered = entretiens.filter(e => filtre === 'tous' || e.statut === filtre)

  if (tl) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Entretiens</h1>
          <p className="text-[11px] text-[#64748B]">Planning & évaluations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm transition-colors"
        >
          <Plus size={14} /> Planifier
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[
          { key: 'planifie', label: 'Planifiés' },
          { key: 'effectue', label: 'Effectués' },
          { key: 'tous',     label: 'Tous' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key as typeof filtre)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${filtre === f.key ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <Calendar size={32} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#64748B]">Aucun entretien planifié</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const tc = TYPE_CONFIG[e.type] ?? TYPE_CONFIG['presentiel']
            const sc = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG['planifie']
            const TypeIcon = tc.icon
            const dateObj = new Date(e.date_heure)
            const isPast  = dateObj < new Date()
            return (
              <div key={e.id} className={`bg-white rounded-xl border p-4 sm:p-5 shadow-sm ${isPast && e.statut === 'planifie' ? 'border-orange-200' : 'border-[#E2E8F0]'}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc.color + '18' }}>
                    <TypeIcon size={18} style={{ color: tc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-[13px] font-bold text-[#0F172A]">
                        {[e.candidat_prenom, e.candidat_nom].filter(Boolean).join(' ') || 'Candidat'}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                      {isPast && e.statut === 'planifie' && (
                        <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">En retard</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B]">{e.offre_titre ?? '—'}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-[#94A3B8]">
                      <span className="flex items-center gap-1"><Clock size={10} />
                        {dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {e.lieu && <span className="flex items-center gap-1"><MapPin size={10} /> {e.lieu}</span>}
                      <span style={{ color: tc.color }}>{tc.label}</span>
                    </div>
                    {e.notes && <p className="text-[11px] text-[#64748B] mt-2 italic">{e.notes}</p>}
                  </div>
                  <select
                    value={e.statut}
                    onChange={ev => updateStatut(e.id, ev.target.value)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer shrink-0"
                    style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '40' }}
                  >
                    {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal planifier */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-[16px] font-bold text-[#0F172A]">Planifier un entretien</h2>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Date & heure *</label>
              <input type="datetime-local" value={form.date_heure} onChange={e => setForm(p => ({ ...p, date_heure: e.target.value }))}
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Type</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([k, v]) => {
                  const Ico = v.icon
                  return (
                    <button key={k} onClick={() => setForm(p => ({ ...p, type: k }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${form.type === k ? 'shadow-sm' : 'border-[#E2E8F0] text-[#64748B]'}`}
                      style={form.type === k ? { background: v.color + '18', color: v.color, borderColor: v.color + '40' } : {}}
                    >
                      <Ico size={13} /> {v.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Lieu / Lien</label>
              <input value={form.lieu} onChange={e => setForm(p => ({ ...p, lieu: e.target.value }))} placeholder="Adresse ou lien Zoom/Meet..."
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Instructions, points à aborder..."
                className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 text-[13px] font-semibold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={saveEntretien} disabled={saving || !form.date_heure}
                className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Planifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
