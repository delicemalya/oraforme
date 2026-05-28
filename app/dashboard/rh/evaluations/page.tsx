'use client'

/**
 * Évaluations — Module RH
 * Évaluations de performance, notes, objectifs.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { Star, Plus, X, Check, TrendingUp, Users, Award, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Evaluation {
  id:           string
  employe_id:   string
  periode:      string           // 'Q1-2026', 'S1-2026', 'A2026'
  note_globale: number           // 1-5
  note_travail: number
  note_ponctualite: number
  note_travail_equipe: number
  note_initiative: number
  commentaire?: string
  objectifs_prochains?: string
  evaluateur?: string
  created_at:   string
  employes?:    { nom: string; poste: string }
}

interface Employe {
  id:    string
  nom:   string
  poste: string
}

function StarRating({ value, onChange, size = 'sm' }: { value: number; onChange?: (n: number) => void; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 18 : 14
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} disabled={!onChange}>
          <Star size={sz} className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-[#CBD5E1]'} />
        </button>
      ))}
    </div>
  )
}

function noteLabel(n: number) {
  if (n >= 4.5) return { label: 'Excellent', color: '#10B981', bg: '#D1FAE5' }
  if (n >= 3.5) return { label: 'Bien',      color: '#2563EB', bg: '#DBEAFE' }
  if (n >= 2.5) return { label: 'Correct',   color: '#F59E0B', bg: '#FEF3C7' }
  if (n >= 1.5) return { label: 'À améliorer', color: '#F97316', bg: '#FFEDD5' }
  return { label: 'Insuffisant', color: '#EF4444', bg: '#FEE2E2' }
}

const PERIODES = [
  'Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026',
  'S1-2026', 'S2-2026', 'A2026',
  'Q1-2025', 'Q2-2025', 'Q3-2025', 'Q4-2025', 'A2025',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [evals,     setEvals]     = useState<Evaluation[]>([])
  const [employes,  setEmployes]  = useState<Employe[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [selected,  setSelected]  = useState<Evaluation | null>(null)

  const [form, setForm] = useState({
    employe_id: '', periode: 'Q2-2026',
    note_travail: 3, note_ponctualite: 3, note_travail_equipe: 3, note_initiative: 3,
    commentaire: '', objectifs_prochains: '', evaluateur: '',
  })

  useEffect(() => {
    if (!tenantId) return
    load()
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [evRes, empRes] = await Promise.all([
      supabase.from('evaluations').select('*, employes(nom, poste)')
        .eq('tenant_id', tenantId!).order('created_at', { ascending: false }).limit(100),
      supabase.from('employes').select('id, nom, poste').eq('tenant_id', tenantId!).eq('statut', 'actif').order('nom'),
    ])
    setEvals((evRes.data  ?? []) as Evaluation[])
    setEmployes((empRes.data ?? []) as Employe[])
    setLoading(false)
  }

  async function saveEval(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employe_id) return
    setSaving(true)
    const moyenne = Math.round(((form.note_travail + form.note_ponctualite + form.note_travail_equipe + form.note_initiative) / 4) * 10) / 10
    await supabase.from('evaluations').insert({
      tenant_id: tenantId!,
      employe_id: form.employe_id,
      periode: form.periode,
      note_globale: moyenne,
      note_travail: form.note_travail,
      note_ponctualite: form.note_ponctualite,
      note_travail_equipe: form.note_travail_equipe,
      note_initiative: form.note_initiative,
      commentaire: form.commentaire || null,
      objectifs_prochains: form.objectifs_prochains || null,
      evaluateur: form.evaluateur || null,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ employe_id:'', periode:'Q2-2026', note_travail:3, note_ponctualite:3, note_travail_equipe:3, note_initiative:3, commentaire:'', objectifs_prochains:'', evaluateur:'' })
    load()
  }

  const avgGlobal = evals.length > 0 ? Math.round(evals.reduce((s, e) => s + e.note_globale, 0) / evals.length * 10) / 10 : 0
  const excellents = evals.filter(e => e.note_globale >= 4).length
  const toImprove  = evals.filter(e => e.note_globale < 2.5).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Star size={18} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">{t('rh.evals.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{evals.length} {t('rh.evals.subtitle')} {avgGlobal}/5</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-amber-600 shadow-sm">
          <Plus size={13} /> {t('rh.evals.newEval')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('rh.evals.avgNote'),   val: `${avgGlobal}/5`,  color: '#F59E0B', icon: <Star size={16} /> },
          { label: t('rh.evals.excellent'), val: excellents,          color: '#10B981', icon: <Award size={16} /> },
          { label: t('rh.evals.toImprove'), val: toImprove,           color: '#EF4444', icon: <TrendingUp size={16} /> },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.color + '18', color: k.color }}>
              {k.icon}
            </div>
            <div>
              <p className="text-[20px] font-bold tabular-nums" style={{ color: k.color }}>{k.val}</p>
              <p className="text-[11px] text-[#64748B]">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Evaluations list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#F1F5F9] rounded-2xl animate-pulse" />)}
        </div>
      ) : evals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-14 text-center">
          <Star size={36} className="mx-auto mb-3 text-[#CBD5E1]" />
          <p className="text-[13px] text-[#64748B]">{t('rh.evals.noData')}</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-[12px] text-[#F59E0B] font-semibold">
            {t('rh.evals.createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {evals.map((ev, i) => {
            const emp = (ev.employes as unknown as { nom: string; poste: string })
            const nl  = noteLabel(ev.note_globale)
            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(selected?.id === ev.id ? null : ev)}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-amber-700">{emp?.nom?.charAt(0) ?? 'E'}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0F172A]">{emp?.nom ?? '—'}</p>
                      <p className="text-[11px] text-[#64748B]">{emp?.poste ?? '—'} · {ev.periode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(ev.note_globale)} />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: nl.color, backgroundColor: nl.bg }}>
                      {ev.note_globale}/5 · {nl.label}
                    </span>
                  </div>
                </div>

                {selected?.id === ev.id && (
                  <div className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-2 gap-3">
                    {[
                      { label: t('rh.evals.labelQuality'),     val: ev.note_travail },
                      { label: t('rh.evals.labelPunctuality'),  val: ev.note_ponctualite },
                      { label: t('rh.evals.labelTeamwork'),     val: ev.note_travail_equipe },
                      { label: t('rh.evals.labelInitiative'),   val: ev.note_initiative },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[11px] text-[#64748B]">{label}</span>
                        <StarRating value={val} />
                      </div>
                    ))}
                    {ev.commentaire && (
                      <div className="col-span-2 bg-[#F8FAFC] rounded-xl p-3">
                        <p className="text-[10px] font-bold text-[#64748B] mb-1">{t('rh.evals.comment')}</p>
                        <p className="text-[12px] text-[#0F172A]">{ev.commentaire}</p>
                      </div>
                    )}
                    {ev.objectifs_prochains && (
                      <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">{t('rh.evals.objectivesLabel')}</p>
                        <p className="text-[12px] text-[#0F172A]">{ev.objectifs_prochains}</p>
                      </div>
                    )}
                    {ev.evaluateur && (
                      <div className="col-span-2 text-[11px] text-[#94A3B8]">{t('rh.evals.evaluatedBy')} {ev.evaluateur}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-[#0F172A]">{t('rh.evals.modalTitle')}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-[#64748B]" /></button>
            </div>
            <form onSubmit={saveEval} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>{t('rh.evals.employee')}</label>
                  <select required value={form.employe_id} onChange={e => setForm(p => ({...p, employe_id: e.target.value}))} className={iCls}>
                    <option value="">{t('rh.evals.selectEmployee')}</option>
                    {employes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lCls}>{t('rh.evals.period')}</label>
                  <select value={form.periode} onChange={e => setForm(p => ({...p, periode: e.target.value}))} className={iCls}>
                    {PERIODES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('rh.evals.notesByCriteria')}</p>
                {[
                  { key: 'note_travail',        label: t('rh.evals.qualityWork') },
                  { key: 'note_ponctualite',     label: t('rh.evals.punctuality') },
                  { key: 'note_travail_equipe',  label: t('rh.evals.teamwork') },
                  { key: 'note_initiative',      label: t('rh.evals.initiative') },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#0F172A]">{label}</span>
                    <StarRating
                      value={(form as unknown as Record<string, number>)[key]}
                      onChange={n => setForm(p => ({ ...p, [key]: n }))}
                      size="lg"
                    />
                  </div>
                ))}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-amber-800">{t('rh.evals.calculatedAvg')}</span>
                  <span className="text-[18px] font-bold text-amber-700">
                    {Math.round(((form.note_travail + form.note_ponctualite + form.note_travail_equipe + form.note_initiative) / 4) * 10) / 10} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className={lCls}>{t('rh.evals.comment')}</label>
                <textarea value={form.commentaire} onChange={e => setForm(p => ({...p, commentaire: e.target.value}))}
                  rows={2} placeholder={t('rh.evals.commentPlaceholder')} className={`${iCls} resize-none`} />
              </div>
              <div>
                <label className={lCls}>{t('rh.evals.nextObjectives')}</label>
                <textarea value={form.objectifs_prochains} onChange={e => setForm(p => ({...p, objectifs_prochains: e.target.value}))}
                  rows={2} placeholder={t('rh.evals.objectivesPlaceholder')} className={`${iCls} resize-none`} />
              </div>
              <div>
                <label className={lCls}>{t('rh.evals.evaluator')}</label>
                <input value={form.evaluateur} onChange={e => setForm(p => ({...p, evaluateur: e.target.value}))}
                  placeholder={t('rh.evals.evaluatorPlaceholder')} className={iCls} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving || !form.employe_id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold disabled:opacity-50 hover:bg-amber-600">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {t('rh.evals.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const lCls = 'text-[10px] font-bold text-[#64748B] uppercase tracking-wide block mb-1'
const iCls = 'w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-[12px] text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-300'
