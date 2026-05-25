'use client'

/**
 * Sanctions RH — Disciplinary actions management
 * Avertissement, mise en demeure, suspension, licenciement
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Shield, Plus, AlertTriangle, X, User,
  ChevronDown, ChevronUp, FileText, Trash2,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe { id: string; nom: string; poste: string; departement: string | null }

interface Sanction {
  id: string
  tenant_id: string
  employe_id: string
  type: string
  motif: string
  date_sanction: string
  date_fin?: string | null
  statut: string
  observations?: string | null
  employes?: { nom: string; poste: string }
  created_at: string
}

/* ─── Config ─────────────────────────────────────────────── */
const TYPES = [
  { value: 'avertissement',    label: 'Avertissement',       color: '#D97706', bg: '#FEF3C7' },
  { value: 'blame',            label: 'Blâme',               color: '#EA580C', bg: '#FED7AA' },
  { value: 'mise_en_demeure',  label: 'Mise en demeure',     color: '#DC2626', bg: '#FEE2E2' },
  { value: 'suspension',       label: 'Suspension',          color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'licenciement',     label: 'Licenciement',        color: '#0F172A', bg: '#F1F5F9' },
]

const STATUTS = [
  { value: 'en_cours',  label: 'En cours',   color: '#DC2626', bg: '#FEE2E2' },
  { value: 'cloture',   label: 'Clôturé',    color: '#16A34A', bg: '#DCFCE7' },
  { value: 'conteste',  label: 'Contesté',   color: '#D97706', bg: '#FEF3C7' },
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPES.find(x => x.value === type) || { label: type, color: '#64748B', bg: '#F1F5F9' }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{ background: t.bg, color: t.color }}>
      {t.label}
    </span>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUTS.find(x => x.value === statut) || { label: statut, color: '#64748B', bg: '#F1F5F9' }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

/* ─── Empty form ─────────────────────────────────────────── */
const EMPTY_FORM = {
  employe_id: '',
  type: 'avertissement',
  motif: '',
  date_sanction: new Date().toISOString().slice(0, 10),
  date_fin: '',
  statut: 'en_cours',
  observations: '',
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function SanctionsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [sanctions, setSanctions]   = useState<Sanction[]>([])
  const [employes, setEmployes]     = useState<Employe[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  /* Load */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [sancR, empR] = await Promise.all([
        supabase
          .from('sanctions')
          .select('*, employes(nom, poste)')
          .eq('tenant_id', tenantId)
          .order('date_sanction', { ascending: false }),
        supabase
          .from('employes')
          .select('id, nom, poste, departement')
          .eq('tenant_id', tenantId)
          .eq('statut', 'actif')
          .order('nom'),
      ])
      if (sancR.error?.code !== '42P01') setSanctions(sancR.data || [])
      setEmployes(empR.data || [])
      setLoading(false)
    })()
  }, [tenantId])

  async function handleSave() {
    if (!tenantId || !form.employe_id || !form.motif.trim()) {
      setError('Employé et motif obligatoires')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('sanctions').insert({
      tenant_id:      tenantId,
      employe_id:     form.employe_id,
      type:           form.type,
      motif:          form.motif.trim(),
      date_sanction:  form.date_sanction,
      date_fin:       form.date_fin || null,
      statut:         form.statut,
      observations:   form.observations.trim() || null,
    })
    if (err) { setError(err.message); setSaving(false); return }

    // Reload
    const { data } = await supabase
      .from('sanctions').select('*, employes(nom, poste)')
      .eq('tenant_id', tenantId).order('date_sanction', { ascending: false })
    setSanctions(data || [])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette sanction ?')) return
    await supabase.from('sanctions').delete().eq('id', id).eq('tenant_id', tenantId)
    setSanctions(prev => prev.filter(s => s.id !== id))
  }

  async function handleCloturer(id: string) {
    await supabase.from('sanctions').update({ statut: 'cloture' }).eq('id', id).eq('tenant_id', tenantId)
    setSanctions(prev => prev.map(s => s.id === id ? { ...s, statut: 'cloture' } : s))
  }

  const filtered = filterType === 'all' ? sanctions : sanctions.filter(s => s.type === filterType)

  /* KPIs */
  const enCours      = sanctions.filter(s => s.statut === 'en_cours').length
  const avertTotal   = sanctions.filter(s => s.type === 'avertissement').length
  const suspensions  = sanctions.filter(s => s.type === 'suspension').length
  const licenciements = sanctions.filter(s => s.type === 'licenciement').length

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Shield size={22} className="text-[#F59E0B]" />
            Sanctions & Discipline
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Gestion des mesures disciplinaires</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg shadow-sm"
        >
          <Plus size={14} />
          Nouvelle sanction
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'En cours',       value: enCours,      color: '#DC2626' },
          { label: 'Avertissements', value: avertTotal,   color: '#D97706' },
          { label: 'Suspensions',    value: suspensions,  color: '#7C3AED' },
          { label: 'Licenciements',  value: licenciements, color: '#0F172A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
            <div className="text-[26px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] text-[15px]">Nouvelle sanction disciplinaire</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Employé */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Employé *</label>
                <select
                  value={form.employe_id}
                  onChange={e => setForm(f => ({ ...f, employe_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                >
                  <option value="">— Sélectionner —</option>
                  {employes.map(e => (
                    <option key={e.id} value={e.id}>{e.nom} — {e.poste}</option>
                  ))}
                </select>
              </div>

              {/* Type + Statut */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  >
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Statut</label>
                  <select
                    value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  >
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de sanction *</label>
                  <input type="date" value={form.date_sanction}
                    onChange={e => setForm(f => ({ ...f, date_sanction: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de fin (optionnel)</label>
                  <input type="date" value={form.date_fin}
                    onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
              </div>

              {/* Motif */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Motif *</label>
                <textarea
                  value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  rows={3}
                  placeholder="Décrire les faits reprochés…"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none"
                />
              </div>

              {/* Observations */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Observations / Suite donnée</label>
                <textarea
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                  rows={2}
                  placeholder="Décision RH, remarques complémentaires…"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none"
                />
              </div>

              {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E2E8F0] p-1">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
            filterType === 'all' ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          Tous ({sanctions.length})
        </button>
        {TYPES.map(t => {
          const count = sanctions.filter(s => s.type === t.value).length
          if (count === 0) return null
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                filterType === t.value ? 'text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
              style={filterType === t.value ? { background: t.color } : {}}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Shield size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[14px] font-semibold text-[#64748B]">Aucune sanction enregistrée</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">Cliquez sur &quot;Nouvelle sanction&quot; pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isExpanded = expanded === s.id
            const emp = s.employes
            return (
              <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden hover:shadow-sm transition-shadow">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <User size={14} className="text-[#64748B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-[#0F172A]">{emp?.nom ?? '—'}</span>
                      <TypeBadge type={s.type} />
                      <StatutBadge statut={s.statut} />
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 truncate">{s.motif}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-semibold text-[#0F172A]">{fmtDate(s.date_sanction)}</div>
                    {isExpanded ? <ChevronUp size={14} className="ml-auto text-[#94A3B8] mt-1" /> : <ChevronDown size={14} className="ml-auto text-[#94A3B8] mt-1" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#F1F5F9] px-4 pb-4 space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div><span className="text-[#94A3B8]">Poste :</span> {emp?.poste ?? '—'}</div>
                      <div><span className="text-[#94A3B8]">Date fin :</span> {s.date_fin ? fmtDate(s.date_fin) : '—'}</div>
                    </div>
                    {s.motif && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">Motif</p>
                        <p className="text-[12px] text-[#0F172A]">{s.motif}</p>
                      </div>
                    )}
                    {s.observations && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">Observations</p>
                        <p className="text-[12px] text-[#0F172A]">{s.observations}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      {s.statut === 'en_cours' && (
                        <button
                          onClick={() => handleCloturer(s.id)}
                          className="px-3 py-1.5 bg-[#DCFCE7] text-[#16A34A] text-[11px] font-semibold rounded-lg hover:bg-[#BBF7D0]"
                        >
                          Clôturer
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-3 py-1.5 bg-[#FEE2E2] text-[#DC2626] text-[11px] font-semibold rounded-lg hover:bg-[#FECACA] flex items-center gap-1"
                      >
                        <Trash2 size={11} /> Supprimer
                      </button>
                    </div>
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
