'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Sparkles, Plus, X, Loader2, ChevronLeft, AlertTriangle,
  CheckCircle, Clock, RefreshCw, BedDouble,
} from 'lucide-react'
import Link from 'next/link'

interface Tache {
  id:          string
  chambre_id:  string | null
  chambre_num: string | null
  statut:      string
  priorite:    string
  type_tache:  string
  assignee:    string | null
  notes:       string | null
  date_tache:  string
  heure_debut: string | null
  heure_fin:   string | null
  created_at:  string
}

interface Chambre {
  id:     string
  numero: string
  type:   string | null
}

const STATUTS = ['pending', 'en_cours', 'fait', 'verifie']
const STATUT_LABELS: Record<string, string> = {
  pending: 'En attente', en_cours: 'En cours', fait: 'Fait', verifie: 'Vérifié',
}
const STATUT_COLORS: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending:  { bg: '#FEF2F2', text: '#DC2626', icon: Clock },
  en_cours: { bg: '#FFFBEB', text: '#D97706', icon: RefreshCw },
  fait:     { bg: '#F0FDF4', text: '#16A34A', icon: CheckCircle },
  verifie:  { bg: '#EFF6FF', text: '#2563EB', icon: CheckCircle },
}
const PRIORITES = ['normal', 'urgent', 'vip']
const PRIO_COLORS: Record<string, string> = { normal: '#64748B', urgent: '#DC2626', vip: '#7C3AED' }
const TYPES_TACHE = ['nettoyage', 'change_linge', 'maintenance', 'inspection', 'reappro']
const TYPE_LABELS: Record<string, string> = {
  nettoyage: 'Nettoyage', change_linge: 'Change linge', maintenance: 'Maintenance',
  inspection: 'Inspection', reappro: 'Réapprovisionnement',
}

const today = new Date().toISOString().slice(0, 10)

export default function HousekeepingPage() {
  const { t } = useLocale()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [taches, setTaches] = useState<Tache[]>([])
  const [chambres, setChambres] = useState<Chambre[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  const [form, setForm] = useState({
    chambre_id: '', statut: 'pending', priorite: 'normal', type_tache: 'nettoyage',
    assignee: '', notes: '', date_tache: today, heure_debut: '', heure_fin: '',
  })
  function set<K extends keyof typeof form>(k: K, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('hotel_housekeeping')
        .select('id, chambre_id, statut, priorite, type_tache, assignee, notes, date_tache, heure_debut, heure_fin, created_at')
        .eq('tenant_id', tenantId).gte('date_tache', today).order('priorite').order('created_at').limit(200),
      supabase.from('hotel_chambres')
        .select('id, numero, type').eq('tenant_id', tenantId).eq('actif', true).order('numero').limit(200),
    ])

    const chambreMap = Object.fromEntries((c ?? []).map(ch => [ch.id, ch.numero]))
    setTaches((t ?? []).map(tk => ({ ...tk, chambre_num: chambreMap[tk.chambre_id ?? ''] ?? null })))
    setChambres(c ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  async function handleSave() {
    if (!tenantId) return
    setSaving(true); setError('')
    const payload = {
      tenant_id: tenantId,
      chambre_id: form.chambre_id || null,
      statut: form.statut,
      priorite: form.priorite,
      type_tache: form.type_tache,
      assignee: form.assignee || null,
      notes: form.notes || null,
      date_tache: form.date_tache,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
    }
    const { error: e } = await supabase.from('hotel_housekeeping').insert(payload)
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); setShowModal(false)
    setForm({ chambre_id: '', statut: 'pending', priorite: 'normal', type_tache: 'nettoyage', assignee: '', notes: '', date_tache: today, heure_debut: '', heure_fin: '' })
    load()
  }

  async function changeStatut(id: string, newStatut: string) {
    await supabase.from('hotel_housekeeping').update({ statut: newStatut }).eq('id', id)
    setTaches(prev => prev.map(t => t.id === id ? { ...t, statut: newStatut } : t))
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F59E0B]" /></div>
  }

  const filtered = filterStatut === 'all' ? taches : taches.filter(t => t.statut === filterStatut)
  const counts = STATUTS.reduce((acc, s) => ({ ...acc, [s]: taches.filter(t => t.statut === s).length }), {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/hotel" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Sparkles size={18} className="text-[#F59E0B]" /> Housekeeping
            </h1>
            <p className="text-xs text-[#64748B]">Tâches ménage & entretien — Aujourd'hui</p>
          </div>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }}
          className="flex items-center gap-1.5 bg-[#F59E0B] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#D97706]">
          <Plus size={14} /> Nouvelle tâche
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATUTS.map(s => {
          const c = STATUT_COLORS[s]
          const Icon = c.icon
          return (
            <div key={s} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: c.bg }}>
                <Icon size={14} style={{ color: c.text }} />
              </div>
              <p className="text-[11px] text-[#94A3B8] font-medium">{STATUT_LABELS[s]}</p>
              <p className="text-xl font-bold text-[#0F172A] mt-0.5">{counts[s] ?? 0}</p>
            </div>
          )
        })}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-5">
        {(['all', ...STATUTS] as const).map(s => (
          <button key={s} onClick={() => setFilterStatut(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterStatut === s ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E5E7EB] text-[#64748B] hover:bg-[#FFFBEB]'}`}>
            {s === 'all' ? 'Toutes' : STATUT_LABELS[s]}
            {s !== 'all' && <span className="ml-1.5 opacity-70">{counts[s] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-16">
            <Sparkles size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucune tâche {filterStatut !== 'all' ? `"${STATUT_LABELS[filterStatut]}"` : "aujourd'hui"}</p>
          </div>
        ) : filtered.map(t => {
          const statC = STATUT_COLORS[t.statut]
          const StatIcon = statC.icon
          const nextStatut = { pending: 'en_cours', en_cours: 'fait', fait: 'verifie' }[t.statut]
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-4 hover:shadow-sm transition-all"
              style={{ borderLeft: `4px solid ${PRIO_COLORS[t.priorite]}` }}>
              <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center flex-shrink-0">
                <BedDouble size={16} className="text-[#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[#0F172A]">
                    {TYPE_LABELS[t.type_tache]}
                    {t.chambre_num && <span className="text-[#64748B] font-normal"> — Ch. {t.chambre_num}</span>}
                  </p>
                  {t.priorite !== 'normal' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                      style={{ background: PRIO_COLORS[t.priorite] + '20', color: PRIO_COLORS[t.priorite] }}>
                      {t.priorite}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {t.assignee && <span className="text-[10px] text-[#64748B]">👤 {t.assignee}</span>}
                  {t.heure_debut && <span className="text-[10px] text-[#94A3B8]">🕐 {t.heure_debut}{t.heure_fin ? `–${t.heure_fin}` : ''}</span>}
                  {t.notes && <span className="text-[10px] text-[#94A3B8] truncate max-w-xs">{t.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: statC.bg, color: statC.text }}>
                  <StatIcon size={10} /> {STATUT_LABELS[t.statut]}
                </span>
                {nextStatut && (
                  <button onClick={() => changeStatut(t.id, nextStatut)}
                    className="text-[10px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-1 rounded-lg hover:bg-[#DBEAFE] transition-all">
                    → {STATUT_LABELS[nextStatut]}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouvelle tâche housekeeping</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={12} />{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Chambre</label>
                  <select value={form.chambre_id} onChange={e => set('chambre_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    <option value="">— Zone commune —</option>
                    {chambres.map(c => <option key={c.id} value={c.id}>Ch. {c.numero}{c.type ? ` (${c.type})` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Type de tâche</label>
                  <select value={form.type_tache} onChange={e => set('type_tache', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {TYPES_TACHE.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Priorité</label>
                  <select value={form.priorite} onChange={e => set('priorite', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {PRIORITES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Assigné à</label>
                  <input value={form.assignee} onChange={e => set('assignee', e.target.value)}
                    placeholder="Nom du staff"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">{t('common.date')}</label>
                  <input type="date" value={form.date_tache} onChange={e => set('date_tache', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Heure début</label>
                  <input type="time" value={form.heure_debut} onChange={e => set('heure_debut', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Heure fin</label>
                  <input type="time" value={form.heure_fin} onChange={e => set('heure_fin', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#374151] block mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    rows={2} placeholder="Instructions particulières…"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#F59E0B] text-white rounded-xl hover:bg-[#D97706] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Créer la tâche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
